EGG & WOOL 🐑🥚 — how to get it online (no coding needed)
What you get
A farm game where you hatch sheep, sell wool, upgrade buildings and battle your friends' teams (3 sheep each, turn-based). Accounts and progress are saved on the server (database), so you can log in from any device. Friends battle your saved team whenever they hit "Find a match" (battles are not live head-to-head, so nobody has to be online at the same time).
1. Put it on GitHub
Make a free account at github.com and click New repository. Name it `egg-and-wool`, keep it Public, click Create.
On the new repo page click uploading an existing file.
Unzip the game, open the folder, select EVERYTHING inside it (`server.js`, `package.json`, `render.yaml`, `README.md`, and the `public` folder) and drag it all into the browser. Make sure `render.yaml` and `package.json` end up at the top level of the repo, not inside another folder.
Click Commit changes.
2. Publish it on Render
Make a free account at render.com (sign in with GitHub).
Click New + → Blueprint, pick your `egg-and-wool` repo, and click Apply. Render reads `render.yaml` and creates the game server AND a database for saves automatically.
Wait a few minutes. When the service says Live, click its link (looks like `https://egg-and-wool.onrender.com`). That's your game — send the link to your friends!
3. Updating later
Change files on GitHub (open the file → pencil icon → Commit, or upload the new version). Render redeploys by itself in a couple of minutes. Player data is kept.
Good to know (free tier)
The free server falls asleep after ~15 min of nobody playing; the first visit afterwards takes ~1 minute to wake up. Saves are not lost.
Render's free database is deleted after 30 days. Before then, upgrade it to the cheapest paid plan in the Render dashboard (a few dollars a month) to keep everyone's farms permanently.
Test on your own computer (optional)
Install Node.js, open a terminal in the folder, run `npm install` then `npm start`, and visit http://localhost:3000 (saves go to a local `data.json`).
Saves disappeared? (read this)
Render's free web server forgets any files it wrote whenever it sleeps or redeploys. Saves only survive if the game is connected to a database. If the game shows a red "No database connected" banner, it is not connected.
Fix A (Render database): In Render, open your Postgres database, copy its Internal Database URL. Open the web service → Environment → add `DATABASE\_URL` = that URL → Save (it redeploys). Using New + → Blueprint with this repo does this automatically.
Fix B (free forever, recommended): Render's free database is deleted after 30 days. A free Postgres at neon.tech never expires: sign up, create a project, copy the connection string (it starts with `postgresql://`), and put it in the web service's `DATABASE\_URL` environment variable instead. Accounts made before the database was connected can't be recovered; make them again once.
The server log says `(postgres storage)` when it is connected correctly.
Saving Render hours
The free server already goes to sleep after ~15 minutes with no visitors, and sleeping time is not counted. The game itself stops talking to the server when a tab is hidden or untouched for 10 minutes, so an forgotten open tab won't keep it awake. To switch it off yourself: Render dashboard -> your web service -> Settings -> Suspend Service (use Resume to turn it back on). Don't use "uptime pinger" sites, they keep it awake.
