# EGG & WOOL 🐑🥚 — how to get it online (no coding needed)

## What you get
A farm game where you hatch sheep, sell wool, upgrade buildings and battle your friends' teams (3 sheep each, turn-based). Accounts and progress are saved on the server (database), so you can log in from any device. Friends battle your saved team whenever they hit "Find a match" (battles are not live head-to-head, so nobody has to be online at the same time).

## 1. Put it on GitHub
1. Make a free account at github.com and click **New repository**. Name it `egg-and-wool`, keep it Public, click **Create**.
2. On the new repo page click **uploading an existing file**.
3. Unzip the game, open the folder, select EVERYTHING inside it (`server.js`, `package.json`, `render.yaml`, `README.md`, and the `public` folder) and drag it all into the browser. Make sure `render.yaml` and `package.json` end up at the top level of the repo, not inside another folder.
4. Click **Commit changes**.

## 2. Publish it on Render
1. Make a free account at render.com (sign in with GitHub).
2. Click **New +** → **Blueprint**, pick your `egg-and-wool` repo, and click **Apply**. Render reads `render.yaml` and creates the game server AND a database for saves automatically.
3. Wait a few minutes. When the service says **Live**, click its link (looks like `https://egg-and-wool.onrender.com`). That's your game — send the link to your friends!

## 3. Updating later
Change files on GitHub (open the file → pencil icon → Commit, or upload the new version). Render redeploys by itself in a couple of minutes. Player data is kept.

## Good to know (free tier)
- The free server falls asleep after ~15 min of nobody playing; the first visit afterwards takes ~1 minute to wake up. Saves are not lost.
- Render's free database is deleted after 30 days. Before then, upgrade it to the cheapest paid plan in the Render dashboard (a few dollars a month) to keep everyone's farms permanently.

## Test on your own computer (optional)
Install Node.js, open a terminal in the folder, run `npm install` then `npm start`, and visit http://localhost:3000 (saves go to a local `data.json`).
