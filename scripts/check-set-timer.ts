import {
  FINISH_MS,
  LEAD_MS,
  SWITCH_MS,
  holdElapsed,
  holdSeconds,
  pauseSetTimer,
  readSetTimer,
  resumeSetTimer,
  startSetTimer,
  viewSetTimer,
} from '../src/lib/set-timer';
import { timerSound } from '../src/lib/timer-cues';

const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

check('a single duration is that many seconds', holdSeconds('30') === 30);
check('a range counts down from its first number', holdSeconds('20-30') === 20);
check('a blank duration is not a timer', holdSeconds('  ') === null);
check('zero is not a timer', holdSeconds('0') === null);

const start = 1_000_000;
const timer = startSetTimer('ex-1', 20, 45, start);
const lead = viewSetTimer(timer, start + 1000);
check('the first second is still the lead-in', lead?.phase === 'lead' && lead.secondsLeft === 3 && lead.caption === 'Get ready');
check('the lead-in ring has started', lead !== null && lead.progress > 0 && lead.progress < 0.5);

const working = viewSetTimer(timer, start + LEAD_MS + 5000);
check('after the lead-in the hold is running', working?.phase === 'work' && working.secondsLeft === 15 && working.caption === 'Hold');

const paused = pauseSetTimer(timer, start + LEAD_MS + 5000);
const pausedView = viewSetTimer(paused, start + LEAD_MS + 20_000);
check('pause freezes the hold', pausedView?.phase === 'work' && pausedView.secondsLeft === 15);
const resumed = resumeSetTimer(paused, start + LEAD_MS + 20_000);
const resumedView = viewSetTimer(resumed, start + LEAD_MS + 20_000);
check('resume continues from the frozen second', resumedView?.phase === 'work' && resumedView.secondsLeft === 15);

const late = start + LEAD_MS + 20_000 + 60_000;
check('a locked screen does not stop the clock', holdElapsed(resumed, late));
check('the hold is logged once the clock passes it', viewSetTimer({ ...resumed, logged: false }, late)?.phase === 'done');
const flashed = viewSetTimer({ ...resumed, logged: true }, resumed.workEndsAt + 100);
check('finish holds the logged ring', flashed?.phase === 'done' && flashed.caption === 'Logged' && flashed.progress === 1);
const resting = viewSetTimer({ ...resumed, logged: true }, resumed.flashEndsAt + 1000);
check('rest uses the same clock after the flash', resting?.phase === 'rest' && resting.caption === 'Rest' && resting.secondsLeft === 44);
check('the timer ends when rest ends', viewSetTimer({ ...resumed, logged: true }, resumed.restEndsAt! + 1) === null);

const noRest = startSetTimer('ex-2', 8, null, start);
check('without rest there is no rest phase', noRest.restEndsAt === null);
check(
  'without rest the timer clears after the flash',
  viewSetTimer({ ...noRest, logged: true }, noRest.flashEndsAt + 1) === null,
);
check('the flash is the documented length', noRest.flashEndsAt - noRest.workEndsAt === FINISH_MS);

const stored = readSetTimer(JSON.parse(JSON.stringify(timer)));
check('a saved timer round-trips', stored?.exerciseKey === 'ex-1' && stored.seconds === 20 && stored.restEndsAt === timer.restEndsAt);
check('a broken timer is ignored', readSetTimer({ exerciseKey: 'ex-1' }) === null);

check('get-ready is quiet until the last three seconds', timerSound('lead', 4, 20) === null);
check('the last three get-ready seconds tick', timerSound('lead', 3, 20) === 'tick' && timerSound('lead', 1, 20) === 'tick');
check('the hold opens with a start tone', timerSound('work', 20, 20) === 'start');
check('the middle of a hold is quiet', timerSound('work', 15, 20) === null);
check('the last three hold seconds warn', timerSound('work', 3, 20) === 'warn' && timerSound('work', 1, 20) === 'warn');
check('a three second hold starts instead of warning', timerSound('work', 3, 3) === 'start');
check('logging plays the done tone', timerSound('done', 20, 20) === 'done');
check('rest itself stays quiet', timerSound('rest', 44, 20) === null);

const both = startSetTimer('side', 30, 20, start, true);
check('a per-side lead-in is unchanged', viewSetTimer(both, start + 1000)?.caption === 'Get ready');
const left = viewSetTimer(both, start + LEAD_MS + 1000);
check('the first hold is the left side', left?.phase === 'side1' && left.caption === 'Left' && left.detail === 'Side 1' && left.secondsLeft === 29);
check('the left side does not log the set', !holdElapsed(both, both.workEndsAt));
const switching = viewSetTimer(both, both.workEndsAt + 500);
check('a switch countdown sits between the sides', switching?.phase === 'switch' && switching.caption === 'Switch' && switching.secondsLeft === 4);
check('the switch does not log the set', both.switchEndsAt !== undefined && !holdElapsed(both, both.switchEndsAt - 1));
const right = viewSetTimer(both, (both.switchEndsAt ?? 0) + 1000);
check('the second hold is the right side', right?.phase === 'side2' && right.caption === 'Right' && right.detail === 'Side 2' && right.secondsLeft === 29);
check('the set logs only after the right side', both.side2EndsAt !== undefined && holdElapsed(both, both.side2EndsAt) && !holdElapsed(both, both.side2EndsAt - 1));
check('the logged seconds stay the per-side length', both.seconds === 30 && (both.side2EndsAt ?? 0) - (both.switchEndsAt ?? 0) === 30_000);
check('the flash follows the right side', both.side2EndsAt !== undefined && both.flashEndsAt - both.side2EndsAt === FINISH_MS);
const pausedSide = pauseSetTimer(both, (both.switchEndsAt ?? 0) + 1000);
check('pause freezes the right side', viewSetTimer(pausedSide, (both.side2EndsAt ?? 0) + 5000)?.phase === 'side2' && viewSetTimer(pausedSide, (both.side2EndsAt ?? 0) + 5000)?.secondsLeft === 29);
const resumedSide = resumeSetTimer(pausedSide, (both.side2EndsAt ?? 0) + 5000);
check('resume keeps the right side on the clock', viewSetTimer(resumedSide, (resumedSide.switchEndsAt ?? 0) + 1000)?.phase === 'side2');
check('the switch is its own length', both.switchEndsAt !== undefined && both.switchEndsAt - both.workEndsAt === SWITCH_MS);
const storedSides = readSetTimer(JSON.parse(JSON.stringify(both)));
check('a saved per-side timer keeps both ends', storedSides?.perSide === true && storedSides.switchEndsAt === both.switchEndsAt && storedSides.side2EndsAt === both.side2EndsAt);
check('a per-side timer with a missing side is ignored', readSetTimer({ ...both, side2EndsAt: undefined }) === null);
check('the switch opens with its own tone', timerSound('switch', 4, 30) === 'switch');
check('the switch counts down with ticks', timerSound('switch', 3, 30) === 'tick' && timerSound('switch', 1, 30) === 'tick');
check('each side opens with the start tone', timerSound('side1', 30, 30) === 'start' && timerSound('side2', 30, 30) === 'start');
check('the end of a side warns', timerSound('side2', 2, 30) === 'warn');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('set timer checks passed');
