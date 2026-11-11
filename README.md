# Flight Works Performance Dashboard

The projected scoreboard and Time Keeper input for **Just Plane Business**, a paper-plane flow game that teaches the Kanban Method.

## Use it

Open `index.html` in Chrome or Edge (or the hosted site once it is published). No install needed.

- **Round clock**: pick Round 0–5, Start / Pause / Reset; full-screen STOP at the end of a round.
- **Scoreboard**: one row per factory. Rounds 1–3 use factory words; from Round 4 (the reveal) it switches to Kanban terms and adds flow efficiency, Little's Law, a cumulative flow diagram and a cycle-time scatter.
- **Time Keeper**: pick the factory and round, type or paste the sheet (`7 0:52 2:10 1`), or stamp "Started now" / "Done now" while the clock runs.
- **Compare rounds**, **Rounds** (rules and quality checks) and **Setup** (factory names, round lengths, copy/load session data).

Data is currently stored in the browser only (`localStorage`). Central storage, phone input per factory and session history are planned next.

## Roadmap

1. Host the current dashboard (static site).
2. Central storage with live updates (Firebase Firestore).
3. Time Keeper phone view with a session join code.
4. Sessions list, history and export.
5. Dry run.
