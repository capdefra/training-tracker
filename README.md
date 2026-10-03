# Training Tracker

A static training log for strength workouts, runs, and plans tied to a goal. The starter program is ski-season prep for 15 December 2026: a 10-week home plan (6 October–13 December) with five training days. The same week repeats, and phases change the runs and the last week’s sets. The log starts empty. Workout presets are included; past sample sessions are not.

The app runs entirely in the browser. There is no server and no database. The log is a JSON file in this repo, `public/data/training.json`, which is the same general approach as the [Cardmarket wishlist tracker](https://github.com/capdefra/magiccardmarket-wishlist-tracker): a client-side Vite app, data you can commit, and GitHub Pages for hosting.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43217

Use the dev server (or `npm run preview` after a build). Opening `index.html` as a file will not load the JSON log.

| Script | What it does |
| --- | --- |
| `npm run dev` | Local site on port 43217 |
| `npm run build` | Typecheck and production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Lint with oxlint |
| `npm run sample-data` | Rewrite the starter log: goal, plan, presets, and no sessions |

## What you can do

**Today** shows the active goal, this week’s targets, workout presets, and recent sessions. The week is a calendar: swipe or scroll sideways between weeks, and tap a day to open what is planned (the session, the exercises or the run, and whether it is done). A today glance stays on screen on a phone, including while you are looking at another week. Open a planned session or start a preset. The layout is meant for a phone: large tap targets, the page itself does not scroll sideways, and the save button stays above the tab bar while you log.

**Workouts** are reusable presets. The starter set is Lower A, an easy run, full upper, Lower B, and a longer run. Strength presets include a short demo when one exists for that exercise (the movement, the steps, and what to watch). Starting a preset fills the log. If that workout is still open on this week’s plan, the entry counts toward it, including the phase for that date.

**Log** takes a strength workout or a run. Strength targets are sets and reps (or seconds for a hold such as a side plank). Kilograms are optional and are not the weekly target. A run counts as soon as you save it; distance, time, climb, and effort are optional. Each strength exercise can open its demo while you train.

**Plans** is where goals and the repeating week live. A goal has a name, a target date, and focus tags. A plan has a start date, a length in weeks, and sessions on chosen days. Phases are inclusive date windows that replace a session’s notes, duration, or set count. The home ski plan uses them for the run phases and the 2-set taper. “Start with the home ski plan” fills that week. Editing a strength session sets sets and reps, not a weight. A run counts when it is logged; the phase says how long it should be.

**Progress** leads with this week: sets completed against the target, and runs done. After you have logged load or distance, the charts still show one lift at a time (top set and an estimated 1RM) and weekly running distance plus pace. Estimated 1RM uses the Epley formula: `weight × (1 + reps / 30)`.

**Data** syncs the log to a private GitHub gist so the phone and laptop share one copy. See below.

The starter goal is **Ski season prep**, aimed at 15 December 2026. The week is Lower A, an easy run, full upper, Lower B, and a longer run, from 6 October through 13 December 2026. There are no historical sessions.

## How data is stored

1. The site loads `data/training.json`, built from `public/data/training.json`. That file is the starter program: the goal, the plan, and the presets.
2. Edits are cached in `localStorage`, so logging works offline and survives a refresh.
3. A private GitHub gist is the copy shared across devices. The gist id and token live only in that browser.

The gist token is never written into `training.json` or committed to this repository.

### Sync with a gist

On the Data tab, connect the same gist on each device:

1. Create a [classic personal access token](https://github.com/settings/tokens/new?scopes=gist&description=Training%20tracker) with only the `gist` scope. A fine-grained token does not have that scope.
2. Create a [secret gist](https://gist.github.com/). Name the file `training-tracker.json`. The contents can be `{}`.
3. Copy the gist id from the URL (`gist.github.com/<you>/<id>`) and paste the id and token into the Data tab.

The app loads the gist when it opens, merges it with the cache, and saves back a couple of seconds after you change something. `Sync now` does the same immediately. Disconnecting stops the sync and leaves the cache on that device.

Sessions, goals, plans, and presets merge by id. The later edit wins. A delete is recorded, so removing a session on the phone removes it on the laptop at the next sync.

This follows the same idea as the [Cardmarket wishlist tracker](https://github.com/capdefra/magiccardmarket-wishlist-tracker): the browser calls the GitHub API directly, and the gist is the shared JSON file. Here you paste the gist id yourself so both devices are aimed at the one gist.

### Publish the log back to the repo

On the Data tab, download `training.json`, replace the file in the repo, and commit:

```bash
cp ~/Downloads/training.json public/data/training.json
git add public/data/training.json
git commit -m "Update training log"
git push
```

The Pages workflow rebuilds the site from that commit. That publishes the starter program. Day-to-day sessions belong in the gist, not in this commit, unless you want them in the repository too.

You can also paste a fine-grained GitHub personal access token on the Data tab and commit the file from the app. Give the token **Contents: Read and write** on this repository only. It stays in the browser’s `localStorage`.

Import accepts a JSON file or pasted JSON. “Reload the site file” drops browser-only edits and reads the committed file again.

## GitHub Pages

`.github/workflows/deploy.yml` builds the app and deploys `dist/` on every push to `main`.

One-time setup on the GitHub repository:

1. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Push to `main`.

The site will be at `https://<user>.github.io/<repo>/`. Vite’s `base` is relative (`./`), so a project site works without hardcoding the repository name.

For a repo named `training-tracker` under `capdefra`, that URL is:

https://capdefra.github.io/training-tracker/

## Project layout

```
public/data/training.json     starter goal, plan, and presets (no sessions)
src/views                     Today, Log, Plans, Progress, Data
src/lib                       dates, targets, gist sync, storage, exercise demos
.github/workflows/deploy.yml  Pages deploy
scripts/sample-data.mjs       rewrites the starter file
```

## Data model

`training.json` is version 1:

- **goals** — name, target date, focus tags, notes, status (`active`, `paused`, `done`)
- **plans** — linked to a goal, with a start date, a number of weeks, an optional end date, a weekly template, and optional phases (inclusive dates that change a session’s notes, minutes, or set count)
- **presets** — reusable workouts you can start from Today or the log
- **sessions** — a strength workout or a run, optionally linked to a plan session
- **deleted** — ids removed on one device, so a sync does not bring them back

A strength target is sets and reps of an exercise (seconds for a hold). It does not include weight. A run on the plan is done when a run is logged against it that week. Logged kilograms, distance, and pace are history, not the target.
