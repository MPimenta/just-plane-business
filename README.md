# Flight Works Performance Dashboard

The projected scoreboard and Time Keeper input for **Just Plane Business**, a paper-plane flow game that teaches the Kanban Method.

## Use it

- **Facilitator / projector:** `index.html`
- **Time Keepers' phones:** `keeper.html` (they get there by scanning the QR code on the join screen)

### On the projector

- **Round clock:** pick Round 0–5, then Start. The screen turns into a full-screen clock with the round name. The last ten seconds count down in red, then STOP EVERYTHING.
- **Sound:** elevator music while the round runs, a ticking clock for the last ten seconds, a factory horn at STOP. Everything is generated in the browser (no audio files). Turn it on or off in the header, and set the volume in Setup.
- **Scoreboard:** one row per factory. Rounds 1–3 use factory words. From Round 4 (the reveal) it switches to Kanban terms and adds flow efficiency, Little's Law, a cumulative flow diagram and a cycle-time scatter.
- **Compare rounds**, **Rounds** (rules and quality checks), **Time Keeper** (typing or fixing times) and **Setup**.

### Online sessions (Firebase)

With Firebase set up, the facilitator signs in with Google and starts an online session. The projector shows a QR code and a 4-letter code. Each Time Keeper scans it, picks their factory, and taps **Plane started**, **Done** and **Rejected** on their phone as planes move. The projector updates live, every screen runs on the same clock, and every session is kept for later.

Time Keepers can only write to their own factory, in the current round, while the session is live (see `firestore.rules`).

Without Firebase settings the dashboard works on one computer, as before (data in the browser's local storage).

## Set up Firebase (one time, about 10 minutes)

1. Go to <https://console.firebase.google.com>, click **Create a project**. Analytics isn't needed.
2. **Build → Authentication → Get started.** Under *Sign-in method*, enable **Google** and **Anonymous**. Under *Settings → Authorized domains*, add the domain the site runs on (for example `mpimenta.github.io`).
3. **Build → Firestore Database → Create database.** Pick a European location, start in **production mode**. Open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.
4. **Project settings → General → Your apps → Web (`</>`).** Register an app (no hosting). Copy the `firebaseConfig` object into `firebase-config.js`:
   ```js
   window.JPB_FIREBASE_CONFIG = { apiKey: "…", authDomain: "…", projectId: "…", storageBucket: "…", messagingSenderId: "…", appId: "…" };
   ```
   These values are meant to be public; the security rules protect the data.
5. Open the dashboard, **Setup → Sign in with Google**. It shows your user ID and says you're not a facilitator yet. In **Firestore → Data**, create a collection `admins` with one document whose ID is that user ID (any field, e.g. `name: "Manuel"`). Reload. Repeat for other trainers.

The free Spark plan is plenty: a session writes a few hundred documents.

## Test locally with the Firebase emulator

```sh
npx firebase-tools emulators:start --only auth,firestore --project demo-jpb
python3 -m http.server 5050
```

Open `http://127.0.0.1:5050/index.html?emu=127.0.0.1&testUser=manuel`. Sign in, add the shown user ID to `admins` (in the emulator), and start a session. Phones on the same network use the join link it shows.

## Files

- `index.html`: projector and facilitator
- `keeper.html`: Time Keeper phone page
- `js/cloud.js`: Firebase data layer (sessions, planes, shared clock)
- `js/sound.js`: synthesised music and sound effects
- `firebase-config.js`: the project's web settings (null = this computer only)
- `firestore.rules`: who may read and write what
- `vendor/`: Firebase JS SDK 10.14.1 and qrcode-generator 1.4.4, served from this site
