import {
  FINISH_MS,
  LEAD_MS,
  holdElapsed,
  holdSeconds,
  pauseSetTimer,
  readSetTimer,
  resumeSetTimer,
  startSetTimer,
  viewSetTimer,
} from '../src/lib/set-timer';

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

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('set timer checks passed');
