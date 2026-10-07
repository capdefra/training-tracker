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

**Today** is the phone screen for the plan. It opens on a short card for the selected day: what was planned, what was logged, and whether that is done. That card stays open. Sets, watch metrics, form links, and the rest of the session open from View session, Start, Continue, or Log. The week and its controls stay put above that card, so choosing another day does not move them. Previous and next are arrows above the week and each move one week. Today sits between them and opens the current week with today selected. Tapping a day opens that day under the week. While another day is open, today stays one tap away at the top of the page. A day shows what was planned, marked not done until a log fulfills it, and what was done that day, including a session that was never on the plan. A planned session that was logged reads as done once, not as a second card. A session can move to another day for one week. The card sits on the new day, and its label says which weekday it left, such as “Moved from Wed”. A log linked to that plan session still marks the moved card done. Strength uses Start, a run uses Log, an unfinished entry uses Continue, and a finished one uses View session. Runs are logged after the fact. Sets, the goal, presets, and recent sessions stay folded until you open them.

**Activity** is its own tab. Weeks stack from top to bottom, and the week that contains today is the top row. Older weeks sit under it. There are no weeks after the current one. Each day is empty, planned and not done, partly done, or done. A day with only an unplanned log still counts. Tapping a day opens that day on Today.

**Workouts** are reusable presets. The starter set is Lower A, an easy run, full upper, Lower B, and a longer run. Each strength exercise plays a short form clip in the app. Starting a strength preset fills the log. Logging a run preset does too, after the run. If that workout is still open on this week’s plan, the entry counts toward it, including the phase for that date.

**Log** takes a strength workout or a run. A strength session shows one exercise at a time: pick one dumbbell, one kettlebell, or two dumbbells, then tap the weight and the reps. The large number is kilograms per piece. The line under it is the total. Log each set, then move to the next exercise. Form still plays that exercise’s clip on this page, and the week controls stay put when Form is opened from Today. Save sits on the review after the last exercise. Strength targets are sets and reps (or seconds for a hold such as a side plank). Kilograms are optional and are not the weekly target. A run counts as soon as you save it. Runs are logged after the fact: distance, workout time, pace, heart rate, active and total calories, elevation, cadence, power, effort, place, source, start and finish, weather, and per-kilometre splits (time, pace, heart rate) are all optional. A strength session can also store workout time, heart rate, calories, and effort when a watch recorded them.

**Plans** is where goals and the repeating week live. A goal has a name, a target date, and focus tags. A plan has a start date, a length in weeks, and sessions on chosen days. Phases are inclusive date windows that replace a session’s notes, duration, or set count. The home ski plan uses them for the run phases and the 2-set taper. “Start with the home ski plan” fills that week. Editing a strength session sets sets and reps, not a weight. A run counts when it is logged; the phase says how long it should be.

**Progress** leads with this week: sets completed against the target, and runs done. After you have logged load or distance, the charts still show one lift at a time (top set as total kilograms, and an estimated 1RM) and weekly running distance plus pace. Estimated 1RM uses the Epley formula on that total: `weight × (1 + reps / 30)`. A set that knows its pieces also reads as kilograms per piece.

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
public/form-demos/            short form clips, one per strength exercise
src/views                     Today, Log, Plans, Progress, Data
src/lib                       dates, targets, gist sync, storage, form clips
.github/workflows/deploy.yml  Pages deploy
scripts/sample-data.mjs       rewrites the starter file
scripts/form-placeholders.py  redraws the placeholder clips
```

## Form clips

Form on a strength exercise opens a sheet and plays a short loop. The week controls and the log stay where they are. Nothing about that button opens a new tab.

Clips live in `public/form-demos/`, one file per exercise on the presets and the ski plan. `src/lib/demos.ts` maps the exercise name to that file. WebM is what the files use now. A GIF with the same name also plays.

Goblet squat, flat dumbbell bench press, incline press, and dumbbell curl are short trims from the [wger](https://wger.de/) library under CC BY-SA 4.0. Credits are in `public/form-demos/CREDITS.txt` and on the sheet. The other exercises are placeholder stick figures, labeled Placeholder, so a demo still plays with the phone offline. They are not filmed form.

To drop in a real clip, replace the WebM at that exercise’s path with a short, muted file about 480px wide. A GIF named the same way works too. Then set that exercise’s `source` to `wger` and add a `credit` line in `src/lib/demos.ts`. `python3 scripts/form-placeholders.py` redraws only the placeholders, and only if ffmpeg is installed. It does not touch the four filmed files.

Learn more, at the bottom of the sheet, still opens the wger page for that exercise.

## Data model

`training.json` is version 1:

- **goals** — name, target date, focus tags, notes, status (`active`, `paused`, `done`)
- **plans** — linked to a goal, with a start date, a number of weeks, an optional end date, a weekly template, optional phases (inclusive dates that change a session’s notes, minutes, or set count), and optional one-off `moves` (see below)
- **presets** — reusable workouts you can start from Today or the log
- **sessions** — a strength workout or a run, optionally linked to a plan session. A run can hold a watch summary: pace, heart rate, active and total calories, cadence, power, elevation, effort, place, source, activity, start and finish, weather, and splits. Older sessions that lack those fields still load. Strength uses the same time, heart rate, calorie, and effort fields when they are present. A strength exercise can also store how the load was held.
- **deleted** — ids removed on one device, so a sync does not bring them back

A strength target is sets and reps of an exercise (seconds for a hold). It does not include weight. A run on the plan is done when a run is logged against it that week. Logged kilograms, distance, and pace are history, not the target.

### One-off moves

The repeating week stays on `dayOfWeek`. To show one occurrence on another date, the planner adds `moves` on that plan. Leave `moves` off and the week is unchanged. The site does not edit this list.

```json
"moves": [
  {
    "sessionId": "ps-upper",
    "fromDate": "2026-10-07",
    "toDate": "2026-10-08",
    "updatedAt": "2026-10-07T08:00:00.000Z"
  }
]
```

`fromDate` is the day that occurrence would have used. `toDate` is where the card shows. Both are `YYYY-MM-DD`. `updatedAt` can be omitted. When the same session and `fromDate` appear twice, the later stamp wins, and an equal stamp keeps the later entry.

The site does not shift any other session. If the new day already has a workout, the planner writes a move for that workout too. Thursday 8 October 2026 is empty, so Full upper needs only the entry above. Moving the Tuesday easy run onto Wednesday, which already has Full upper, needs both of these:

```json
"moves": [
  {
    "sessionId": "ps-easy",
    "fromDate": "2026-10-06",
    "toDate": "2026-10-07",
    "updatedAt": "2026-10-06T09:00:00.000Z"
  },
  {
    "sessionId": "ps-upper",
    "fromDate": "2026-10-07",
    "toDate": "2026-10-08",
    "updatedAt": "2026-10-06T09:00:00.000Z"
  }
]
```

A move is ignored when `moves` is missing or not an array, the session id is unknown, a date is not a real calendar day, `fromDate` is not that session’s weekday, `fromDate` equals `toDate`, or `fromDate` falls outside the plan. Other weeks stay on their usual days. The phase stays the one that covers `fromDate`. The card label reads “Moved from Wed”.

### Kilograms

`weightKg` on a set is always the **total** load. When the set used a bell, the exercise also stores `pieces` (`1` or `2`) and `implement` (`dumbbell` or `kettlebell`), and each weighted set stores `kgPerPiece`. Two pieces are always dumbbells. One piece is a dumbbell or a kettlebell. The logger shows kilograms per piece as the large number and the total underneath. Those two never swap.

Older sets stored only `weightKg`. That number stays the total. On load, the app fills a one-piece choice only when the total and the per-piece weight are the same number:

- a name containing “kettlebell”, plus Goblet squat and Suitcase carry → one kettlebell (those two names follow the home plan notes)
- a name containing “one-arm” or “single-arm” → one dumbbell

A pair of dumbbells is not guessed, because the old number does not say whether it was one bell or both. Those sets stay labeled as a total until you pick pieces while editing.
