// Flight Works Performance Dashboard: online sessions (Firebase).
// Loaded as an ES module by index.html (facilitator) and keeper.html (Time Keepers).
// Without a Firebase config the dashboard keeps working in this-browser-only mode.
import { initializeApp } from "../vendor/firebase-10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup, signInWithCredential,
  GoogleAuthProvider, signOut, connectAuthEmulator
} from "../vendor/firebase-10.14.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  doc, collection, getDoc, getDocs, getDocFromServer, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, serverTimestamp
} from "../vendor/firebase-10.14.1/firebase-firestore.js";

const params = new URLSearchParams(location.search);
const EMU = params.has("emu");
const CONFIG = EMU ? { apiKey: "demo-key", authDomain: "demo-jpb.firebaseapp.com", projectId: "demo-jpb", appId: "demo" }
                   : (window.JPB_FIREBASE_CONFIG || null);

let app = null, auth = null, db = null, offset = 0, user = null;
const userCbs = new Set();

function start() {
  if (app || !CONFIG) return;
  app = initializeApp(CONFIG);
  auth = getAuth(app);
  let cache;
  try { cache = persistentLocalCache({ tabManager: persistentMultipleTabManager() }); } catch (e) { cache = undefined; }
  db = initializeFirestore(app, cache ? { localCache: cache } : {});
  if (EMU) {
    const host = params.get("emu") || "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
  }
  onAuthStateChanged(auth, u => { user = u; if (u) syncClock(); userCbs.forEach(cb => cb(u)); });
}

/* ---------- clock: every screen uses the server's time ---------- */
async function syncClock() {
  try {
    const ref = doc(db, "pings", user.uid);
    const t0 = Date.now();
    await setDoc(ref, { t: serverTimestamp() });
    const snap = await getDocFromServer(ref);
    const t1 = Date.now();
    const server = snap.get("t");
    if (server && server.toMillis) offset = server.toMillis() - (t0 + t1) / 2;
  } catch (e) { /* keep the last offset */ }
}
setInterval(() => { if (user) syncClock(); }, 5 * 60 * 1000);

/* ---------- join codes ---------- */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O
const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
const cleanCode = c => String(c || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

const sRef = code => doc(db, "sessions", code);
const planesCol = code => collection(db, "sessions", code, "planes");
const frRef = (code, f, r) => doc(db, "sessions", code, "factoryRounds", `${f}_${r}`);

const API = {
  available: !!CONFIG,
  emulator: EMU,
  get user() { return user; },
  now: () => Date.now() + offset,
  syncClock,
  cleanCode,
  onUser(cb) { start(); userCbs.add(cb); if (auth && auth.currentUser !== undefined) cb(user); return () => userCbs.delete(cb); },

  async signInFacilitator() {
    start();
    if (EMU && params.get("testUser")) {
      const u = params.get("testUser");
      const cred = GoogleAuthProvider.credential(JSON.stringify({ sub: u, email: `${u}@example.com`, email_verified: true, name: u }));
      return signInWithCredential(auth, cred);
    }
    return signInWithPopup(auth, new GoogleAuthProvider());
  },
  async signInKeeper() { start(); if (auth.currentUser) return auth.currentUser; const c = await signInAnonymously(auth); return c.user; },
  signOut() { start(); return signOut(auth); },

  async isAdmin() {
    if (!user || user.isAnonymous) return false;
    try { return (await getDoc(doc(db, "admins", user.uid))).exists(); } catch (e) { return false; }
  },

  /* ----- sessions (facilitator) ----- */
  async createSession(name, settings) {
    for (let i = 0; i < 8; i++) {
      const code = newCode();
      const ex = await getDoc(sRef(code)).catch(() => null);
      if (ex && ex.exists()) continue;
      await setDoc(sRef(code), {
        ...settings, name: name || "Session " + code, owner: user.uid,
        status: "live", createdAt: serverTimestamp(), round: 0,
        clock: { running: false, startedAt: 0, elapsed: 0 }
      });
      return code;
    }
    throw new Error("Could not find a free join code");
  },
  async mySessions() {
    const snap = await getDocs(query(collection(db, "sessions"), where("owner", "==", user.uid)));
    return snap.docs.map(d => ({ code: d.id, ...d.data(), created: d.get("createdAt")?.toMillis?.() || 0 }))
      .sort((a, b) => b.created - a.created);
  },
  updateSession(code, fields) { return updateDoc(sRef(code), fields); },
  async exportSession(code) {
    const [s, p, fr] = await Promise.all([getDoc(sRef(code)), getDocs(planesCol(code)), getDocs(collection(db, "sessions", code, "factoryRounds"))]);
    return { code, session: s.data(), planes: p.docs.map(d => ({ id: d.id, ...d.data() })), factoryRounds: fr.docs.map(d => ({ id: d.id, ...d.data() })) };
  },

  /* ----- live data (both screens) ----- */
  getSession(code) { start(); return getDoc(sRef(code)); },
  watchSession(code, cb, err) { return onSnapshot(sRef(code), s => cb(s.exists() ? s.data() : null), err); },
  watchPlanes(code, f, cb, err) {
    const q = f == null ? planesCol(code) : query(planesCol(code), where("f", "==", f));
    return onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err);
  },
  watchFactoryRounds(code, cb, err) {
    return onSnapshot(collection(db, "sessions", code, "factoryRounds"), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err);
  },
  watchKeepers(code, cb, err) {
    return onSnapshot(collection(db, "sessions", code, "keepers"), s => cb(s.docs.map(d => ({ uid: d.id, ...d.data() }))), err);
  },
  joinFactory(code, f) { return setDoc(doc(db, "sessions", code, "keepers", user.uid), { f: String(f), at: serverTimestamp() }); },

  newPlaneId(code) { return doc(planesCol(code)).id; },
  setPlane(code, id, plane) { return setDoc(doc(planesCol(code), id), plane); },
  updatePlane(code, id, fields) { return updateDoc(doc(planesCol(code), id), fields); },
  deletePlane(code, id) { return deleteDoc(doc(planesCol(code), id)); },
  setFactoryRound(code, f, r, fields) { return setDoc(frRef(code, f, r), { f, r, ...fields }, { merge: true }); }
};

window.JPBCloud = API;
window.dispatchEvent(new Event("jpb-cloud-ready"));
