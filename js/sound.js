/* Flight Works sound department: everything is synthesised in the browser,
   so there are no audio files and no licences to worry about.
   - music(): deadpan lounge loop for while the round runs
   - tick(): clock tick-tock for the last ten seconds
   - horn(): factory horn at STOP
   - chime(): ding-dong when the round starts */
(function () {
  "use strict";
  const KEY = "jpb-sound-v1";
  let prefs = { muted: false, volume: 0.7, music: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  const savePrefs = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} };

  let ctx = null, master = null, musicBus = null, fxBus = null, noiseBuf = null;
  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    fxBus = ctx.createGain(); fxBus.gain.value = 0.9; fxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolume();
    return ctx;
  }
  function applyVolume() { if (master) master.gain.setTargetAtTime(prefs.muted ? 0 : prefs.volume, ctx.currentTime, 0.05); }

  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function tone(bus, when, midi, len, { type = "sine", gain = 0.2, attack = 0.01, release = 0.25, vibrato = 0, detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = hz(midi); o.detune.value = detune;
    if (vibrato) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2; lg.gain.value = vibrato; l.connect(lg); lg.connect(o.frequency); l.start(when); l.stop(when + len + release + 0.05); }
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    g.gain.setTargetAtTime(gain * 0.6, when + attack, len / 3);
    g.gain.setTargetAtTime(0, when + len, release / 3);
    o.connect(g); g.connect(bus); o.start(when); o.stop(when + len + release + 0.1);
  }
  function noise(bus, when, len, { gain = 0.05, freq = 6000, q = 0.8, type = "highpass" } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.0001, when + len);
    s.connect(f); f.connect(g); g.connect(bus); s.start(when, Math.random() * 0.5); s.stop(when + len + 0.02);
  }

  /* ---------- lounge loop ---------- */
  // Fmaj7 Dm7 Gm7 C7 | Am7 D7 Gm7 C7(b9) at 92 bpm, swung.
  const BPM = 92, BEAT = 60 / BPM;
  const CHORDS = [
    { root: 41, notes: [57, 60, 64, 69] }, { root: 38, notes: [57, 60, 62, 65] },
    { root: 43, notes: [58, 62, 65, 67] }, { root: 36, notes: [58, 60, 64, 67] },
    { root: 45, notes: [55, 60, 64, 67] }, { root: 38, notes: [57, 60, 62, 66] },
    { root: 43, notes: [58, 62, 65, 67] }, { root: 36, notes: [58, 61, 64, 67] }
  ];
  const SCALE = [65, 67, 69, 72, 74, 77, 79, 81]; // F major pentatonic-ish, vibraphone range
  let playing = false, nextBeat = 0, beatIdx = 0, timer = null;
  function scheduleBeat(t, i) {
    const bar = Math.floor(i / 4) % CHORDS.length, beat = i % 4, ch = CHORDS[bar], swing = BEAT * 0.66;
    // brushes and ride
    noise(musicBus, t, 0.05, { gain: 0.018, freq: 7000 });
    noise(musicBus, t + swing, 0.04, { gain: 0.012, freq: 8000 });
    if (beat === 1 || beat === 3) noise(musicBus, t, 0.22, { gain: 0.03, freq: 2500, type: "bandpass", q: 0.5 });
    // walking bass
    const walk = [0, 7, 4, 5][beat], next = CHORDS[(bar + 1) % CHORDS.length].root;
    const bn = beat === 3 ? next - 1 : ch.root + walk;
    tone(musicBus, t, bn, BEAT * 0.8, { type: "triangle", gain: 0.22, attack: 0.01, release: 0.08 });
    // electric piano comping on 1 and the "and" of 2
    if (beat === 0 || beat === 1) {
      const when = beat === 0 ? t : t + swing, len = beat === 0 ? BEAT * 1.2 : BEAT * 0.9;
      ch.notes.forEach((n, k) => { tone(musicBus, when + k * 0.008, n, len, { type: "sine", gain: 0.045, attack: 0.01, release: 0.4, detune: k * 3 }); tone(musicBus, when, n + 12, len * 0.5, { type: "sine", gain: 0.008, release: 0.2 }); });
    }
    // sparse vibraphone line
    if (Math.random() < 0.42) {
      const pick = SCALE[Math.floor(Math.random() * SCALE.length)];
      const when = t + (Math.random() < 0.5 ? 0 : swing);
      tone(musicBus, when, pick, BEAT * 1.4, { type: "sine", gain: 0.06, attack: 0.005, release: 0.9, vibrato: 2.5 });
    }
  }
  function pump() {
    if (!playing) return;
    while (nextBeat < ctx.currentTime + 0.4) { scheduleBeat(nextBeat, beatIdx++); nextBeat += BEAT; }
  }
  function music(on) {
    if (on) {
      if (!prefs.music || playing || !ensure()) return;
      playing = true; nextBeat = ctx.currentTime + 0.12; beatIdx = 0;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
      musicBus.gain.exponentialRampToValueAtTime(0.32, ctx.currentTime + 1.5);
      timer = setInterval(pump, 100); pump();
    } else if (playing) {
      playing = false; clearInterval(timer);
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    }
  }
  function duck(on) { if (ctx && playing) musicBus.gain.setTargetAtTime(on ? 0.1 : 0.32, ctx.currentTime, 0.3); }

  /* ---------- effects ---------- */
  function tick(high) {
    if (!ensure()) return; const t = ctx.currentTime + 0.01;
    tone(fxBus, t, high ? 96 : 89, 0.03, { type: "square", gain: 0.12, attack: 0.001, release: 0.05 });
    noise(fxBus, t, 0.04, { gain: 0.25, freq: high ? 3200 : 2200, type: "bandpass", q: 6 });
  }
  function horn() {
    if (!ensure()) return; const t = ctx.currentTime + 0.02, len = 1.6;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1400; f.Q.value = 2; f.connect(fxBus);
    [[50, 0], [54, 4], [57, -3]].forEach(([m, det]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(hz(m) * 0.97, t); o.frequency.linearRampToValueAtTime(hz(m), t + 0.12);
      o.frequency.setValueAtTime(hz(m), t + len - 0.2); o.frequency.linearRampToValueAtTime(hz(m) * 0.94, t + len + 0.2);
      o.detune.value = det;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.08); g.gain.setValueAtTime(0.16, t + len); g.gain.linearRampToValueAtTime(0, t + len + 0.3);
      o.connect(g); g.connect(f); o.start(t); o.stop(t + len + 0.4);
    });
  }
  function chime() {
    if (!ensure()) return; const t = ctx.currentTime + 0.02;
    [[79, 0], [75, 0.42]].forEach(([m, dt]) => { tone(fxBus, t + dt, m, 0.5, { gain: 0.16, attack: 0.003, release: 1.2 }); tone(fxBus, t + dt, m + 19, 0.2, { gain: 0.03, attack: 0.003, release: 0.5 }); });
  }

  window.JPBSound = {
    unlock: ensure, music, duck, tick, horn, chime,
    get muted() { return prefs.muted; },
    get volume() { return prefs.volume; },
    get musicOn() { return prefs.music; },
    get playing() { return playing; },
    setMuted(v) { prefs.muted = !!v; savePrefs(); if (ctx) applyVolume(); },
    setVolume(v) { prefs.volume = Math.max(0, Math.min(1, +v)); savePrefs(); if (ctx) applyVolume(); },
    setMusic(v) { prefs.music = !!v; savePrefs(); if (!v) music(false); }
  };
})();
