# Connecting Firebase

Firebase is used for **the database only**. Netlify keeps serving the site;
Firestore just holds the content the admin edits so a change on one device shows
up on every other one.

Right now the site works without it — content comes from the files in `data/`
with admin edits saved in that browser's localStorage. Nothing below is
required for the site to run. Do it when you want edits to sync.

**You have to do steps 1–5 yourself** — they need your Google account, and
creating accounts or entering passwords is not something I can do for you.
Step 6 is one paste into one file.

---

## 1. Create the Firestore database

1. Open the [Firebase console](https://console.firebase.google.com) and pick
   your project.
2. Left sidebar → **Build → Firestore Database** → **Create database**.
3. Choose **Start in production mode**. (Test mode leaves the database open to
   the entire internet for 30 days. Step 4 sets the real rules.)
4. Pick a location near your users — `eur3` or `asia-south1` for Dubai. **This
   cannot be changed later.**

## 2. Register a web app

1. **⚙ Project settings → General**.
2. Under **Your apps**, click the web icon **`</>`**.
3. Give it a nickname (`bgs-website`). **Do not** tick "Firebase Hosting" —
   Netlify does the hosting.
4. Firebase shows you a `firebaseConfig` object. Keep this tab open, you need it
   in step 6.

## 3. Turn on Email/Password sign-in

1. **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Email/Password** → enable the first toggle → Save.

## 4. Create your admin account

1. **Authentication → Users → Add user**.
2. Enter the email and password you want to log into `/admin` with. Use a real
   password — this one is actually protecting the content.

This account replaces the `bgs-admin` password. Once Firebase is configured the
admin asks for an email and a password and checks them against Firebase, and
the "change password" box disappears because it no longer does anything.

## 5. Set the security rules

The rules live in [`firestore.rules`](firestore.rules) in this repo. Open that
file, replace `PASTE-THE-OWNER-UID-HERE` with your own Firebase UID, then copy
the whole file into **Firestore Database → Rules** and press **Publish**.

Your UID is in the console under **Authentication → Users**, in the "User UID"
column of your own row.

Do not skip this. With write left open, anyone who views the page source can
find your project id and rewrite every price on the site.

### Why the rule names your UID

An earlier version of this guide used `allow write: if request.auth != null`,
which reads like "only the admin" and is not. It means *any signed-in identity
in this project*, and the Firebase web API key is public by design — it ships
in `js/firebase-config.js` and in the source of every page. With the
Email/Password provider enabled, that key is all a stranger needs to call the
public sign-up endpoint, create themselves an account in your project, and
satisfy that rule. They could then rewrite every price, description and link on
the site. Naming your UID means an identity that is not you is refused whether
or not it is signed in.

While you are in the console, also turn off self-service sign-up:
**Authentication → Settings → User actions → uncheck "Enable create (sign-up)"**.
That closes the endpoint; the UID allowlist then means re-enabling it later is
not a breach. Adding a colleague is a deliberate edit to `firestore.rules` —
one more UID in the list, published again.

## 6. Paste the config

Open [`js/firebase-config.js`](js/firebase-config.js) and fill in the six values
from step 2:

```js
export const FIREBASE_CONFIG = {
  apiKey: "AIza…",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123",
};
```

These are not secrets. A Firebase web config is public by design and ships in
every client that uses it — the rules in step 5 are what protect the data, not
the config.

Then bump the `?v=` number across the HTML, JS and CSS files so browsers pick up
the change:

```bash
find . \( -name "*.html" -o -name "*.js" -o -name "*.css" \) -not -path "./.git/*" -exec sed -i '' 's/?v=84/?v=85/g' {} +
```

## 7. Push your current content up

The database starts empty, and an empty database changes nothing — pages fall
back to the files in `data/`. To seed it with what you have now:

1. Open `/admin` and sign in with the account from step 4.
2. **Export** first, and keep the file. It is your undo.
3. Make any small edit and save it. That collection is now in Firestore.
4. Repeat per collection, or paste the exported JSON into **Import**, which
   writes all of them at once.

---

## How it behaves once connected

- **Reads** — a page paints immediately from the last content it saw, then the
  Firestore snapshot arrives and it re-renders if anything changed. No spinner,
  no blank flash, and the site still works with the network off.
- **Writes** — saving in the admin updates the page instantly and sends the
  change to Firestore in the background. Every open tab, on any device,
  updates within a second or so.
- **Firestore down, blocked, or misconfigured** — the site logs a warning and
  keeps serving local content. It does not break.

## Checking it worked

Open the site with the browser console visible:

- `store: could not sync …` on save → the rules are rejecting the write, or you
  are not signed in.
- `cloud: content listener stopped …` → the read rule is wrong; check step 5.
- `cloud: Firebase unavailable, staying local` → the config is wrong or the CDN
  is blocked.
- Silence, and an edit in one browser appearing in another → it is working.

## What this costs

Nothing, realistically. The free Spark plan allows 50,000 document reads and
20,000 writes a day. This site reads seven documents per visitor and writes only
when you edit something.
