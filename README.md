# Training Tracker

A static training log for strength workouts, runs, and plans tied to a goal. The sample program is ski-season prep: legs, balance, and cardio, with about two months of sessions already filled in so the progress charts have a slope.

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
| `npm run sample-data` | Rebuild the original sample log (overwrites `public/data/training.json`) |

## What you can do

**Today** shows the active goal, this week’s plan, and recent sessions. Open a planned session and log it, or record something that was not on the plan.

**Log** takes a strength workout (exercises, sets, reps, load in kilograms) or a run (distance, time, optional climb, effort from 1 to 10). Logging from the plan prefills the template and your last loads for those lifts.

**Plans** is where goals and weekly templates live. A goal has a name, a target date, and focus tags. A plan has a start date, a length in weeks, and sessions on chosen days. “Start with a ski-base week” fills a legs, balance, and cardio template you can edit.

**Progress** charts one lift at a time (top set and an estimated 1RM) and shows weekly running distance plus pace. The history list opens any session for edits. Estimated 1RM uses the Epley formula: `weight × (1 + reps / 30)`.

**Data** is how the log gets back into git. See below.

The sample goal is **Ski season prep**, aimed at 19 December 2026. The week template is lower body, an easy run, balance work, posterior chain, and a long run. Friday 21 August is missing on purpose (a travel day), so the history is not a perfect streak.

## How data is stored

1. The site loads `data/training.json`, built from `public/data/training.json`.
2. Edits are written to `localStorage` in the browser, so logging works with no backend and survives a refresh.
3. A different browser, or a fresh profile, still sees the committed file until you publish your copy.

When the browser copy differs from the file this site was built with, the Data tab says so. The token for the optional GitHub commit (below) is stored separately and is never written into `training.json`.

### Publish the log back to the repo

On the Data tab, download `training.json`, replace the file in the repo, and commit:

```bash
cp ~/Downloads/training.json public/data/training.json
git add public/data/training.json
git commit -m "Update training log"
git push
```

The Pages workflow rebuilds the site from that commit. Until you do this, the new sessions stay on the device that recorded them.

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
public/data/training.json     committed log and sample data
src/views                     Today, Log, Plans, Progress, Data
src/lib                       dates, stats, storage, optional GitHub commit
.github/workflows/deploy.yml  Pages deploy
scripts/sample-data.mjs       rebuilds the original sample
```

## Data model

`training.json` is version 1:

- **goals** — name, target date, focus tags, notes, status (`active`, `paused`, `done`)
- **plans** — linked to a goal, with a start date, a number of weeks, and a weekly template
- **sessions** — a strength workout or a run, optionally linked to a plan session

Strength load is in kilograms. Run distance is in kilometres. A plan session counts as done for the week when a log in that Monday–Sunday is linked to it.
