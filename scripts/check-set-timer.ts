import { holdSeconds, pauseSetTimer, readSetTimer, resumeSetTimer, startSetTimer, viewSetTimer } from '../src/lib/set-timer';
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
const timer = startSetTimer('ex-1', 20, 10, start);
check('rest before the hold is the chosen length', timer.leadEndsAt - start === 10_000 && timer.restSec === 10);
const lead = viewSetTimer(timer, start + 1000);
check('the opening countdown is rest, not a fixed get-ready', lead?.phase === 'lead' && lead.caption === 'Rest' && lead.detail === 'Then hold' && lead.secondsLeft === 9);

const working = viewSetTimer(timer, timer.leadEndsAt + 5000);
check('after the rest the hold is running', working?.phase === 'work' && working.secondsLeft === 15 && working.caption === 'Hold');
check('the hold is the full length', timer.workEndsAt - timer.leadEndsAt === 20_000);

const paused = pauseSetTimer(timer, timer.leadEndsAt + 5000);
const pausedView = viewSetTimer(paused, timer.leadEndsAt + 20_000);
check('pause freezes the hold', pausedView?.phase === 'work' && pausedView.secondsLeft === 15);
const resumed = resumeSetTimer(paused, timer.leadEndsAt + 20_000);
const resumedView = viewSetTimer(resumed, timer.leadEndsAt + 20_000);
check('resume continues from the frozen second', resumedView?.phase === 'work' && resumedView.secondsLeft === 15);

const afterHold = viewSetTimer(resumed, resumed.workEndsAt + 1000);
check('the timer does not show a logged beat', afterHold?.phase === 'rest' && afterHold.caption === 'Rest' && afterHold.detail === 'Then log the set' && afterHold.secondsLeft === 9);
check('there is no logged phase', afterHold?.caption !== 'Logged');
check('rest after the hold uses the same length', resumed.restEndsAt !== null && resumed.restEndsAt - resumed.workEndsAt === 10_000);
check('the timer ends when that rest ends', viewSetTimer(resumed, resumed.restEndsAt! + 1) === null);
check('a locked screen does not stop the clock', viewSetTimer(resumed, resumed.restEndsAt! + 60_000) === null);

const noRest = startSetTimer('ex-2', 8, 0, start);
check('zero rest skips the opening countdown', viewSetTimer(noRest, start)?.phase === 'work' && noRest.leadEndsAt === start);
check('zero rest skips the countdown after the hold', noRest.restEndsAt === null && viewSetTimer(noRest, noRest.workEndsAt) === null);

const stored = readSetTimer(JSON.parse(JSON.stringify(timer)));
check('a saved timer round-trips', stored?.exerciseKey === 'ex-1' && stored.seconds === 20 && stored.restSec === 10 && stored.restEndsAt === timer.restEndsAt);
check('a broken timer is ignored', readSetTimer({ exerciseKey: 'ex-1' }) === null);
check('a timer saved before restSec is ignored', readSetTimer({ exerciseKey: 'ex-1', seconds: 20, leadEndsAt: 1, workEndsAt: 2, flashEndsAt: 3 }) === null);

check('the opening rest announces itself', timerSound('lead', 10, 10) === 'rest');
check('the last three rest seconds tick', timerSound('lead', 3, 10) === 'tick' && timerSound('lead', 1, 10) === 'tick');
check('the middle of a rest is quiet', timerSound('lead', 7, 10) === null);
check('a two second rest opens instead of ticking', timerSound('lead', 2, 2) === 'rest' && timerSound('lead', 1, 2) === 'tick');
check('the hold opens with a start tone', timerSound('work', 20, 20) === 'start');
check('the middle of a hold is quiet', timerSound('work', 15, 20) === null);
check('the last three hold seconds warn', timerSound('work', 3, 20) === 'warn' && timerSound('work', 1, 20) === 'warn');
check('a three second hold starts instead of warning', timerSound('work', 3, 3) === 'start');
check('rest after the hold uses the rest tone', timerSound('rest', 10, 10) === 'rest');

const single = startSetTimer('plain', 30, 10, start, false);
check('without per-side there is one 30 second hold', single.switchEndsAt === undefined && single.side2EndsAt === undefined && single.workEndsAt - single.leadEndsAt === 30_000);

const both = startSetTimer('side', 30, 10, start, true);
const opening = viewSetTimer(both, start + 1000);
check('a per-side opening rest names the left side', opening?.caption === 'Rest' && opening.detail === 'Then left');
const left = viewSetTimer(both, both.leadEndsAt + 1000);
check('the first hold is the left side for the full time', left?.phase === 'side1' && left.caption === 'Left' && left.detail === 'Side 1' && left.secondsLeft === 29);
check('the left side is the full hold', both.workEndsAt - both.leadEndsAt === 30_000);
const switching = viewSetTimer(both, both.workEndsAt + 500);
check('the switch is the same rest, counting toward the right side', switching?.phase === 'switch' && switching.caption === 'Switch' && switching.detail === 'Then right' && switching.secondsLeft === 10);
check('the switch is not a fixed four seconds', both.switchEndsAt !== undefined && both.switchEndsAt - both.workEndsAt === 10_000);
const right = viewSetTimer(both, (both.switchEndsAt ?? 0) + 1000);
check('the second hold is the right side for the full time', right?.phase === 'side2' && right.caption === 'Right' && right.detail === 'Side 2' && right.secondsLeft === 29);
check('the right side is the full hold', both.side2EndsAt !== undefined && both.switchEndsAt !== undefined && both.side2EndsAt - both.switchEndsAt === 30_000);
const afterSides = both.side2EndsAt === undefined ? null : viewSetTimer(both, both.side2EndsAt + 1000);
check('after the right side the timer rests and does not log', afterSides?.phase === 'rest' && afterSides.caption === 'Rest' && afterSides.detail === 'Then log the set');
check('the stored seconds stay the per-side length', both.seconds === 30);
const pausedSide = pauseSetTimer(both, (both.switchEndsAt ?? 0) + 1000);
const pausedRight = viewSetTimer(pausedSide, (both.side2EndsAt ?? 0) + 5000);
check('pause freezes the right side', pausedRight?.phase === 'side2' && pausedRight.secondsLeft === 29);
const resumedSide = resumeSetTimer(pausedSide, (both.side2EndsAt ?? 0) + 5000);
check('resume keeps the right side on the clock', viewSetTimer(resumedSide, (resumedSide.switchEndsAt ?? 0) + 1000)?.phase === 'side2');
const storedSides = readSetTimer(JSON.parse(JSON.stringify(both)));
check('a saved per-side timer keeps both ends', storedSides?.perSide === true && storedSides.switchEndsAt === both.switchEndsAt && storedSides.side2EndsAt === both.side2EndsAt && storedSides.restSec === 10);
check('a per-side timer with a missing side is ignored', readSetTimer({ ...both, side2EndsAt: undefined }) === null);
check('the switch opens with its own tone', timerSound('switch', 10, 10) === 'switch');
check('the switch counts down with ticks', timerSound('switch', 3, 10) === 'tick' && timerSound('switch', 1, 10) === 'tick');
check('each side opens with the start tone', timerSound('side1', 30, 30) === 'start' && timerSound('side2', 30, 30) === 'start');
check('the end of a side warns', timerSound('side2', 2, 30) === 'warn');

const tight = startSetTimer('side', 30, 0, start, true);
check('zero rest skips the switch gap', tight.switchEndsAt === tight.workEndsAt && viewSetTimer(tight, tight.workEndsAt)?.phase === 'side2');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('set timer checks passed');
