import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ExerciseDemo } from './ExerciseDemo';
import { useScreenWakeLock } from '../hooks/useScreenWakeLock';
import { cx } from '../lib/cx';
import { blankExercise, withPieces, type Draft, type ExerciseDraft, type SetDraft } from '../lib/draft';
import { parseNum, trimNum } from '../lib/format';
import { uid } from '../lib/ids';
import { defaultLoad, shownLoad } from '../lib/load';
import { requestScreenWakeLock } from '../lib/screen-wake';
import { sessionFromDraft } from '../lib/session-save';
import {
  holdElapsed,
  pauseSetTimer,
  resumeSetTimer,
  startSetTimer,
  viewSetTimer,
  type TimerView,
} from '../lib/set-timer';
import { timerSound, type TimerSound } from '../lib/timer-cues';
import {
  allPlannedSetsLogged,
  clearPendingLaunch,
  isDirty,
  loadStrengthProgress,
  progressHasSets,
  saveStrengthProgress,
  decideLaunch,
  type StrengthProgress,
} from '../lib/session-progress';
import type { LoadImplement, LoadPieces, Session } from '../types';
import './session.css';

const PIECE_CHOICES: { pieces: LoadPieces; implement: LoadImplement; count: string; label: string }[] = [
  { pieces: 1, implement: 'dumbbell', count: '1', label: 'dumbbell' },
  { pieces: 1, implement: 'kettlebell', count: '1', label: 'kettlebell' },
  { pieces: 2, implement: 'dumbbell', count: '2', label: 'dumbbells' },
];

const REST_CHOICES = [45, 60, 90, 120];

interface PendingSnap {
  pendingKg: string;
  pendingReps: string;
  pendingAsTotal: boolean;
  pieces: LoadPieces | null;
  implement: LoadImplement | null;
  bodyweight: boolean;
}

type Ask = { current: StrengthProgress; next: StrengthProgress };

function shortTitle(title: string): string {
  const cut = title.split('(')[0]?.trim() || 'Strength';
  return cut.length > 22 ? `${cut.slice(0, 21).trimEnd()}…` : cut;
}

function clock(total: number): string {
  const safe = Math.max(0, Math.trunc(total));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

let sharedAudio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  sharedAudio = sharedAudio ?? new Ctx();
  return sharedAudio;
}

const REST_PRESETS = [0, 30, 45, 60, 90, 120];

/** Create and resume the audio context inside the Start tap so iOS Safari will play later tones. */
function unlockAudio() {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* the resume above is the important part */
  }
}

function playTimerSound(sound: TimerSound) {
  try {
    if (sound === 'start') navigator.vibrate?.(30);
    else if (sound === 'done') navigator.vibrate?.([80, 40, 80]);
    else if (sound === 'rest') navigator.vibrate?.([40, 30, 40]);
  } catch {
    /* this browser has no vibration */
  }
  try {
    const ctx = audioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (sound === 'tick') tone(ctx, now, 988, 0.045, 0.05, 'sine');
    if (sound === 'start') {
      tone(ctx, now, 523, 0.09, 0.06, 'sine');
      tone(ctx, now + 0.1, 784, 0.12, 0.06, 'sine');
    }
    if (sound === 'warn') tone(ctx, now, 440, 0.08, 0.055, 'triangle');
    if (sound === 'done') {
      tone(ctx, now, 659, 0.12, 0.07, 'sine');
      tone(ctx, now + 0.14, 880, 0.18, 0.07, 'sine');
    }
    if (sound === 'rest') tone(ctx, now, 392, 0.2, 0.06, 'sine');
  } catch {
    /* audio is optional */
  }
}

function tone(ctx: AudioContext, when: number, freq: number, duration: number, level: number, type: OscillatorType) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(level, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function withName(exercise: ExerciseDraft): ExerciseDraft {
  return { ...exercise, name: exercise.name.trim() };
}

function loadForName(exercise: ExerciseDraft): Partial<ExerciseDraft> {
  const name = exercise.name.trim();
  if (!name || exercise.sets.length > 0) return { name };
  const load = defaultLoad(name);
  if (load.kind === 'bodyweight') {
    return { name, bodyweight: true, pieces: null, implement: null, pendingKg: '0', pendingAsTotal: false, seedKg: '0', seedAsTotal: false };
  }
  return { name, bodyweight: false, pieces: load.pieces, implement: load.implement, pendingAsTotal: false, seedAsTotal: false };
}

function setToken(exercise: ExerciseDraft, set: SetDraft): string {
  const kg = parseNum(set.kgPerPiece) ?? 0;
  if (exercise.bodyweight || kg <= 0) return exercise.count === 'seconds' ? `${set.reps}s` : set.reps;
  return `${trimNum(kg)}×${set.reps}`;
}

function bootSession(incoming: StrengthProgress | null): { progress: StrengthProgress | null; ask: Ask | null } {
  const stored = loadStrengthProgress();
  if (!incoming && !stored) return { progress: null, ask: null };
  if (!incoming && stored) return { progress: stored, ask: null };
  if (!incoming) return { progress: null, ask: null };
  const decision = decideLaunch(incoming, stored);
  if (decision.kind === 'ask') return { progress: null, ask: { current: decision.current, next: decision.next } };
  return { progress: decision.progress, ask: null };
}

export function StrengthSession({
  incoming,
  existing,
  onSave,
  onDelete,
  onExit,
  resolvePlannedDone,
  onMarkPlanned,
}: {
  /** A workout the user just asked to open. Null resumes whatever is stored. */
  incoming: StrengthProgress | null;
  existing?: Session;
  onSave: (session: Session) => void;
  onDelete?: (id: string) => void;
  onExit: () => void;
  resolvePlannedDone: (planId: string, sessionId: string, date: string) => boolean | null;
  onMarkPlanned: (planId: string, sessionId: string, date: string, done: boolean) => void;
}) {
  const [boot] = useState(() => bootSession(incoming));
  const [ask, setAsk] = useState<Ask | null>(boot.ask);
  const [progress, setProgress] = useState<StrengthProgress | null>(boot.progress);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'exit' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [live, setLive] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [askTimer, setAskTimer] = useState(false);
  const [modalRest, setModalRest] = useState(60);
  const snapshot = useRef<PendingSnap | null>(null);
  const swipe = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressClick = useRef(false);
  const loggedHold = useRef<number | null>(null);
  const restCued = useRef<number | null>(null);
  const playedSound = useRef(new Set<string>());
  const progressRef = useRef(progress);

  useScreenWakeLock();

  useEffect(() => {
    if (ask || !progress) return;
    saveStrengthProgress(progress);
    clearPendingLaunch();
  }, [ask, progress]);

  useEffect(() => {
    if (boot.progress || boot.ask) return;
    onExit();
  }, [boot, onExit]);

  useEffect(() => {
    const title = progress?.draft.title.trim() || 'Strength';
    document.title = `${shortTitle(title)} · Training Tracker`;
    const meta = document.querySelector('meta[name="viewport"]');
    const previous = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    document.documentElement.classList.add('sess-lock');
    const onPointerDown = () => requestScreenWakeLock();
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.documentElement.classList.remove('sess-lock');
      document.removeEventListener('pointerdown', onPointerDown, true);
      if (meta && previous !== null) meta.setAttribute('content', previous);
    };
  }, [progress?.draft.title]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const timerRunning = Boolean(progress?.timer);
  useEffect(() => {
    if (!timerRunning) return;
    const tick = () => {
      const current = progressRef.current;
      const timer = current?.timer;
      const at = Date.now();
      if (!timer?.pausedAt) setNow(at);
      if (!current || !timer) return;
      const frozen = timer.pausedAt ?? at;
      const shown = viewSetTimer(timer, frozen);
      if (shown && timer.pausedAt === null) {
        const sound = timerSound(shown.phase, shown.secondsLeft, timer.seconds);
        if (sound) {
          const key = `${timer.workEndsAt}:${sound}:${sound === 'done' ? 0 : shown.secondsLeft}`;
          if (!playedSound.current.has(key)) {
            playedSound.current.add(key);
            playTimerSound(sound);
          }
        }
      }
      const exerciseIndex = current.draft.exercises.findIndex((item) => item.key === timer.exerciseKey);
      if (exerciseIndex < 0) {
        setProgress((prev) => (prev?.timer ? { ...prev, timer: null } : prev));
        return;
      }
      if (holdElapsed(timer, frozen)) {
        if (loggedHold.current === timer.workEndsAt || timer.logged) return;
        loggedHold.current = timer.workEndsAt;
        const exercise = current.draft.exercises[exerciseIndex];
        const atCap = Boolean(exercise && exercise.targetSets > 0 && exercise.sets.length >= exercise.targetSets);
        const canWrite = Boolean(exercise && exercise.name.trim() && timer.seconds > 0 && !atCap);
        if (canWrite) {
          const key = `${timer.workEndsAt}:done:0`;
          if (!playedSound.current.has(key)) {
            playedSound.current.add(key);
            playTimerSound('done');
          }
        }
        setProgress((prev) => {
          if (!prev?.timer || prev.timer.logged || prev.timer.workEndsAt !== timer.workEndsAt) return prev;
          const index = prev.draft.exercises.findIndex((item) => item.key === prev.timer?.exerciseKey);
          const item = prev.draft.exercises[index];
          if (!item) return { ...prev, timer: null };
          const blocked = item.targetSets > 0 && item.sets.length >= item.targetSets;
          if (blocked || !item.name.trim() || prev.timer.seconds <= 0) {
            return { ...prev, cursor: index, timer: { ...prev.timer, logged: true } };
          }
          const ready = { ...item, name: item.name.trim() };
          const sets = [
            ...ready.sets,
            {
              key: uid('set'),
              reps: String(prev.timer.seconds),
              kgPerPiece: ready.bodyweight ? '' : ready.pendingKg,
              asTotal: ready.bodyweight ? false : !ready.pieces || ready.pendingAsTotal,
            },
          ];
          return {
            ...prev,
            cursor: index,
            timer: { ...prev.timer, logged: true },
            draft: {
              ...prev.draft,
              exercises: prev.draft.exercises.map((entry) => (entry.key === ready.key ? { ...ready, sets } : entry)),
            },
          };
        });
        if (canWrite && exercise) setLive(`Logged set ${exercise.sets.length + 1}.`);
        setEditingKey(null);
        setNotice('');
        return;
      }
      if (current.cursor !== exerciseIndex) {
        setProgress((prev) => {
          if (!prev?.timer || prev.timer.workEndsAt !== timer.workEndsAt) return prev;
          const index = prev.draft.exercises.findIndex((item) => item.key === prev.timer?.exerciseKey);
          if (index < 0 || prev.cursor === index) return prev;
          return { ...prev, cursor: index };
        });
        return;
      }
      if (viewSetTimer(timer, frozen) === null) {
        if (timer.logged && timer.restEndsAt !== null && restCued.current !== timer.restEndsAt) {
          restCued.current = timer.restEndsAt;
          const key = `${timer.restEndsAt}:rest`;
          if (!playedSound.current.has(key)) {
            playedSound.current.add(key);
            playTimerSound('rest');
          }
          setLive('Rest done');
        }
        setAskTimer(false);
        setProgress((prev) => {
          if (!prev?.timer || prev.timer.workEndsAt !== timer.workEndsAt) return prev;
          if (viewSetTimer(prev.timer, prev.timer.pausedAt ?? Date.now()) !== null) return prev;
          return { ...prev, timer: null };
        });
      }
    };
    const kick = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 200);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', tick);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', tick);
    };
  }, [timerRunning]);

  useEffect(() => {
    if (progress?.timer) return;
    if (remaining === null || remaining <= 0) return;
    const ending = remaining === 1;
    const id = window.setTimeout(() => {
      setRemaining((current) => (current === null || current <= 0 ? current : current - 1));
      if (ending) setLive('Rest done');
    }, 1000);
    return () => window.clearTimeout(id);
  }, [remaining, progress?.timer]);

  if (ask) {
    return (
      <Conflict
        ask={ask}
        onResume={() => {
          clearPendingLaunch();
          setAsk(null);
          setProgress(ask.current);
        }}
        onReplace={() => {
          clearPendingLaunch();
          setAsk(null);
          setProgress(ask.next);
        }}
      />
    );
  }

  if (!progress) return null;

  const workout = progress;
  const { draft, cursor, restOn, restChoice } = workout;
  const reviewing = cursor >= draft.exercises.length;
  const exercise = draft.exercises[cursor];
  const dirty = isDirty(workout);
  const onLastExercise = !reviewing && draft.exercises.length > 0 && cursor >= draft.exercises.length - 1;
  const upcoming = onLastExercise || reviewing ? '' : draft.exercises[cursor + 1]?.name.trim() || 'Next exercise';
  const timer = workout.timer ?? null;
  const timerHere = Boolean(exercise && timer && timer.exerciseKey === exercise.key);
  const hold = timerHere && timer ? viewSetTimer(timer, timer.pausedAt ?? now) : null;
  const timerOpen = Boolean(exercise && exercise.count === 'seconds' && (askTimer || hold));
  const restLabel = !restOn ? 'Off' : remaining === null ? clock(restChoice) : clock(remaining);
  const restRunning = remaining !== null && remaining > 0;
  const repsNow = exercise ? (parseNum(exercise.pendingReps) ?? 0) : 0;
  // Cap is the exercise target: the plan's set count, or 3 on a blank exercise.
  const atSetCap = Boolean(exercise && exercise.targetSets > 0 && exercise.sets.length >= exercise.targetSets);
  const overSetCap = Boolean(exercise && exercise.targetSets > 0 && exercise.sets.length > exercise.targetSets);
  const canLog = Boolean(exercise && exercise.name.trim() && repsNow > 0 && (editingKey || !atSetCap) && !timerHere);
  const workoutComplete = allPlannedSetsLogged(draft);
  const plannedDone = draft.planId && draft.planSessionId ? resolvePlannedDone(draft.planId, draft.planSessionId, draft.date) : null;

  function update(next: StrengthProgress) {
    setProgress(next);
  }

  function patchExercise(key: string, partial: Partial<ExerciseDraft>) {
    update({
      ...workout,
      draft: {
        ...workout.draft,
        exercises: workout.draft.exercises.map((item) => (item.key === key ? { ...item, ...partial } : item)),
      },
    });
  }

  function restorePending() {
    const snap = snapshot.current;
    const key = editingKey;
    snapshot.current = null;
    setEditingKey(null);
    if (!snap || !key) return;
    patchExercise(workout.draft.exercises[workout.cursor]?.key ?? '', snap);
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(draft.exercises.length, next));
    if (clamped === cursor) return;
    const key = exercise?.key;
    const name = exercise?.name.trim();
    snapshot.current = null;
    setEditingKey(null);
    setNotice('');
    setAskTimer(false);
    setProgress((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cursor: Math.max(0, Math.min(prev.draft.exercises.length, clamped)),
        timer: null,
        draft: key
          ? {
              ...prev.draft,
              exercises: prev.draft.exercises.map((item) => (item.key === key ? { ...item, name: name || item.name } : item)),
            }
          : prev.draft,
      };
    });
  }

  function openTimer() {
    if (!exercise || exercise.count !== 'seconds' || editingKey || atSetCap || !exercise.name.trim()) return;
    setModalRest(restOn ? restChoice : 60);
    setAskTimer(true);
  }

  function closeTimer() {
    setAskTimer(false);
    if (!workout.timer) return;
    const logged = workout.timer.logged;
    setProgress((prev) => (prev?.timer ? { ...prev, timer: null } : prev));
    setLive(logged ? 'Timer stopped.' : 'Timer cancelled.');
  }

  function startTimer() {
    if (!exercise || exercise.count !== 'seconds' || editingKey || atSetCap) return;
    const seconds = Math.max(1, Math.min(300, Math.round(parseNum(exercise.pendingReps) ?? 0)));
    if (!exercise.name.trim()) return;
    unlockAudio();
    setRemaining(null);
    const started = Date.now();
    setNow(started);
    const restSec = modalRest > 0 ? modalRest : null;
    setProgress((prev) => (prev ? { ...prev, timer: startSetTimer(exercise.key, seconds, restSec, started) } : prev));
    setLive(`Get ready. ${seconds} second hold.`);
    requestScreenWakeLock();
  }

  function setHoldSeconds(next: number) {
    if (!exercise || hold) return;
    patchExercise(exercise.key, { pendingReps: String(Math.max(1, Math.min(300, next))) });
  }

  function pauseTimer() {
    if (!workout.timer || workout.timer.pausedAt !== null) return;
    const pausedAt = Date.now();
    setNow(pausedAt);
    update({ ...workout, timer: pauseSetTimer(workout.timer, pausedAt) });
    setLive('Timer paused.');
  }

  function resumeTimer() {
    if (!workout.timer?.pausedAt) return;
    const resumedAt = Date.now();
    setNow(resumedAt);
    update({ ...workout, timer: resumeSetTimer(workout.timer, resumedAt) });
    setLive('Timer resumed.');
    requestScreenWakeLock();
  }

  function beginEdit(set: SetDraft) {
    if (!exercise) return;
    if (editingKey === set.key) {
      restorePending();
      setNotice('');
      return;
    }
    if (!editingKey) {
      snapshot.current = {
        pendingKg: exercise.pendingKg,
        pendingReps: exercise.pendingReps,
        pendingAsTotal: exercise.pendingAsTotal,
        pieces: exercise.pieces,
        implement: exercise.implement,
        bodyweight: exercise.bodyweight,
      };
    }
    setEditingKey(set.key);
    setNotice('');
    patchExercise(exercise.key, {
      pendingReps: set.reps,
      pendingKg: set.kgPerPiece || '0',
      pendingAsTotal: Boolean(set.asTotal),
    });
  }

  function commit() {
    if (!exercise || !canLog) return;
    if (!editingKey && exercise.targetSets > 0 && exercise.sets.length >= exercise.targetSets) return;
    const reps = parseNum(exercise.pendingReps);
    if (reps === null || reps <= 0) return;
    const ready = withName(exercise);
    const next: SetDraft = {
      key: editingKey ?? uid('set'),
      reps: String(Math.round(reps)),
      kgPerPiece: ready.bodyweight ? '' : ready.pendingKg,
      asTotal: ready.bodyweight ? false : !ready.pieces || ready.pendingAsTotal,
    };
    const sets = editingKey ? ready.sets.map((set) => (set.key === editingKey ? next : set)) : [...ready.sets, next];
    const setNumber = editingKey ? ready.sets.findIndex((set) => set.key === editingKey) + 1 : sets.length;
    snapshot.current = null;
    setEditingKey(null);
    setNotice('');
    update({
      ...workout,
      draft: { ...draft, exercises: draft.exercises.map((item) => (item.key === ready.key ? { ...ready, sets } : item)) },
    });
    if (!editingKey && restOn) {
      setRemaining(restChoice);
      setLive(`Logged set ${setNumber}. Rest ${clock(restChoice)}.`);
    } else {
      setLive(editingKey ? `Updated set ${setNumber}.` : `Logged set ${setNumber}.`);
    }
    requestScreenWakeLock();
  }

  function removeSet(key: string) {
    if (!exercise) return;
    const index = exercise.sets.findIndex((set) => set.key === key);
    if (index < 0) return;
    const snap = snapshot.current;
    snapshot.current = null;
    setEditingKey(null);
    const restored = snap ? { ...exercise, ...snap, name: exercise.name.trim() } : withName(exercise);
    const sets = restored.sets.filter((set) => set.key !== key);
    setNotice('');
    update({
      ...workout,
      draft: {
        ...draft,
        exercises: draft.exercises.map((item) => (item.key === restored.key ? { ...restored, sets } : item)),
      },
    });
    setLive(`Removed set ${index + 1}.`);
  }

  function bumpKg(delta: number) {
    if (!exercise || exercise.bodyweight) return;
    const current = parseNum(exercise.pendingKg) ?? 0;
    setNotice('');
    patchExercise(exercise.key, { pendingKg: trimNum(Math.max(0, current + delta)), pendingAsTotal: exercise.pieces ? false : exercise.pendingAsTotal });
  }

  function bumpReps(delta: number) {
    if (!exercise) return;
    const current = parseNum(exercise.pendingReps) ?? 0;
    setNotice('');
    patchExercise(exercise.key, { pendingReps: trimNum(Math.max(0, current + delta)) });
  }

  function save() {
    const built = sessionFromDraft(draft, workout.sessionId, workout.createdAt);
    if (typeof built === 'string') {
      setNotice(built);
      setLive(built);
      return;
    }
    clearPendingLaunch();
    onSave(built);
  }

  function exit() {
    if (progressHasSets(workout)) {
      setConfirmDelete(false);
      setSheet('exit');
      return;
    }
    onExit();
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    suppressClick.current = false;
    if (event.button !== 0 || sheet || timerOpen) return;
    swipe.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.pointerId !== event.pointerId || sheet || timerOpen) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    suppressClick.current = true;
    goTo(dx < 0 ? cursor + 1 : cursor - 1);
  }

  function onClickCapture(event: MouseEvent<HTMLElement>) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  const label = shortTitle(draft.title);

  return (
    <div className="sess-screen" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)} onClickCapture={onClickCapture}>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      <header className="sess-header">
        <button type="button" className="sess-exit" onClick={exit}>
          Exit
        </button>
        <div className="sess-progress" aria-label={reviewing ? `Review, ${label}` : `Exercise ${cursor + 1} of ${draft.exercises.length}, ${label}`}>
          <small>{label}</small>
          <strong>{reviewing ? 'Review' : `${cursor + 1} of ${draft.exercises.length}`}</strong>
        </div>
        <div className="sess-header-side">{exercise && !reviewing ? <ExerciseDemo name={exercise.name} className="sess-form" /> : null}</div>
      </header>

      {reviewing ? (
        <Review
          draft={draft}
          notice={notice}
          complete={workoutComplete}
          plannedDone={plannedDone}
          onMarkPlanned={
            plannedDone === null
              ? null
              : () => onMarkPlanned(draft.planId, draft.planSessionId, draft.date, !plannedDone)
          }
          onOpen={(index) => goTo(index)}
          onAdd={
            draft.planSessionId
              ? null
              : () => {
                  const next = blankExercise();
                  update({ ...workout, cursor: draft.exercises.length, draft: { ...draft, exercises: [...draft.exercises, next] } });
                }
          }
        />
      ) : exercise ? (
        <ExercisePane
          exercise={exercise}
          editing={editingKey ? exercise.sets.findIndex((set) => set.key === editingKey) : null}
          notice={notice}
          canOpenTimer={exercise.count === 'seconds' && !editingKey && !atSetCap && Boolean(exercise.name.trim())}
          onOpenTimer={openTimer}
          onName={(name) => patchExercise(exercise.key, { name })}
          onNameCommit={() => patchExercise(exercise.key, loadForName(exercise))}
          onPieces={(pieces, implement) => {
            const next = withPieces(exercise, pieces, implement);
            patchExercise(exercise.key, { pieces: next.pieces, implement: next.implement, bodyweight: false, pendingAsTotal: false });
          }}
          onBumpKg={bumpKg}
          onBumpReps={bumpReps}
          onResetKg={() => patchExercise(exercise.key, { pendingKg: exercise.seedKg, pendingAsTotal: exercise.seedAsTotal })}
          onResetReps={() => patchExercise(exercise.key, { pendingReps: exercise.seedReps })}
          onEdit={(index) => {
            const set = exercise.sets[index];
            if (set) beginEdit(set);
          }}
        />
      ) : null}

      <footer className="sess-footer">
        {reviewing ? null : (
          <div className="sess-rest" aria-label="Rest timer">
            <button
              type="button"
              className={cx(restOn && 'on')}
              aria-pressed={restOn}
              onClick={() => {
                update({ ...workout, restOn: !restOn });
                setRemaining(null);
              }}
            >
              Rest
            </button>
            <button
              type="button"
              disabled={!restOn || remaining !== null}
              aria-label={restOn ? `Rest ${restLabel}. Change duration.` : 'Rest timer off'}
              onClick={() => {
                const index = REST_CHOICES.indexOf(restChoice);
                update({ ...workout, restChoice: REST_CHOICES[(index + 1) % REST_CHOICES.length] ?? 90 });
              }}
            >
              <span className="sess-clock">{restLabel}</span>
            </button>
            <button type="button" disabled={!restRunning && remaining !== 0} onClick={() => setRemaining(null)}>
              Stop
            </button>
          </div>
        )}
        {reviewing ? (
          <div className="sess-nav sess-nav-single">
            <button type="button" onClick={() => goTo(cursor - 1)}>
              Back
            </button>
          </div>
        ) : (
          <div className="sess-nav">
            <button type="button" disabled={cursor === 0} onClick={() => goTo(cursor - 1)}>
              Prev
            </button>
            <button type="button" onClick={() => goTo(cursor + 1)}>
              Skip
            </button>
            <button type="button" onClick={() => goTo(cursor + 1)} aria-label={onLastExercise ? (workoutComplete ? 'Next, finish the session' : 'Next, review the session') : `Next: ${upcoming}`}>
              Next
            </button>
          </div>
        )}
        {reviewing ? (
          <button type="button" className="sess-log" onClick={save}>
            {workoutComplete ? 'Complete workout' : 'Save'}
          </button>
        ) : (
          <div className={cx('sess-commit', editingKey && 'is-split')}>
            {editingKey ? (
              <button type="button" className="sess-remove" aria-label="Remove set" onClick={() => removeSet(editingKey)}>
                Remove
              </button>
            ) : null}
            {overSetCap && !editingKey ? (
              <button
                type="button"
                className="sess-extra"
                onClick={() => {
                  const last = exercise?.sets.at(-1);
                  if (last) removeSet(last.key);
                }}
              >
                Remove extra set
              </button>
            ) : (
              <button type="button" className={cx('sess-log', atSetCap && !editingKey && 'is-complete')} disabled={!canLog} onClick={commit}>
                {editingKey ? 'Update set' : atSetCap ? 'Exercise complete' : 'Log set'}
              </button>
            )}
          </div>
        )}
        {reviewing ? null : (
          <p className="sess-upcoming">
            {onLastExercise ? (
              <span>{workoutComplete ? 'Review to finish' : 'Last exercise'}</span>
            ) : (
              <>
                <span className="kicker">Next</span>
                <span>{upcoming}</span>
              </>
            )}
          </p>
        )}
      </footer>

      {timerOpen && exercise ? (
        <TimerModal
          name={exercise.name.trim() || 'Hold'}
          holdSeconds={Math.max(0, Math.round(parseNum(exercise.pendingReps) ?? 0))}
          restSec={modalRest}
          view={hold}
          paused={Boolean(timer?.pausedAt)}
          canStart={!editingKey && !atSetCap && repsNow > 0}
          onHold={setHoldSeconds}
          onRest={(next) => setModalRest(Math.max(0, Math.min(300, next)))}
          onStart={startTimer}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onClose={closeTimer}
        />
      ) : null}

      {sheet === 'exit' ? (
        <Sheet label="Exit session?" onClose={() => setSheet(null)}>
          <h2>Exit session?</h2>
          <p>
            {dirty
              ? existing
                ? 'Exiting drops the changes on this phone. The saved session stays as it was.'
                : 'Exiting drops the sets on this phone. They are not saved.'
              : 'This returns to Today. The saved session stays.'}
          </p>
          <div className="sess-dialog-actions">
            <button type="button" onClick={() => setSheet(null)}>
              Stay
            </button>
            <button type="button" className="sess-log" onClick={onExit}>
              Exit
            </button>
            {existing && onDelete && !confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}>
                Delete session
              </button>
            ) : null}
            {existing && onDelete && confirmDelete ? (
              <button type="button" className="sess-log" onClick={() => onDelete(existing.id)}>
                Delete this session
              </button>
            ) : null}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function Conflict({ ask, onResume, onReplace }: { ask: Ask; onResume: () => void; onReplace: () => void }) {
  const current = ask.current.draft.title.trim() || 'the unfinished workout';
  const next = ask.next.draft.title.trim() || 'the new workout';
  return (
    <div className="sess-screen">
      <header className="sess-header">
        <span />
        <div className="sess-progress">
          <small>Strength</small>
          <strong>Unfinished</strong>
        </div>
        <span />
      </header>
      <main className="sess-work">
        <h1 className="sess-name">{shortTitle(current)} is unfinished</h1>
        <p className="sess-next">
          <span>Starting {shortTitle(next)} drops those sets.</span>
        </p>
      </main>
      <footer className="sess-footer">
        <div className="sess-dialog-actions">
          <button type="button" className="sess-log" onClick={onResume}>
            Resume
          </button>
          <button type="button" onClick={onReplace}>
            Start new
          </button>
        </div>
      </footer>
    </div>
  );
}

function ExercisePane({
  exercise,
  editing,
  notice,
  canOpenTimer,
  onOpenTimer,
  onName,
  onNameCommit,
  onPieces,
  onBumpKg,
  onBumpReps,
  onResetKg,
  onResetReps,
  onEdit,
}: {
  exercise: ExerciseDraft;
  editing: number | null;
  notice: string;
  canOpenTimer: boolean;
  onOpenTimer: () => void;
  onName: (name: string) => void;
  onNameCommit: () => void;
  onPieces: (pieces: LoadPieces, implement: LoadImplement) => void;
  onBumpKg: (delta: number) => void;
  onBumpReps: (delta: number) => void;
  onResetKg: () => void;
  onResetReps: () => void;
  onEdit: (setIndex: number) => void;
}) {
  const weight = shownLoad(exercise.pieces, exercise.implement, exercise.pendingKg, exercise.pendingAsTotal);
  const unit = exercise.count === 'seconds' ? 'Seconds' : 'Reps';
  const logged = exercise.sets.length;
  const repsDetail = notice
    ? notice
    : editing !== null && editing >= 0
      ? `Editing set ${editing + 1}`
      : logged > exercise.targetSets
        ? `${logged} logged, plan is ${exercise.targetSets}`
        : exercise.targetSets > 0 && logged >= exercise.targetSets
          ? 'All sets logged'
          : exercise.targetLabel
            ? `Target ${exercise.targetLabel}`
            : 'Log each set, then move on';
  const unnamed = exercise.name.trim() === '';

  return (
    <main className="sess-work">
      {unnamed ? (
        <input
          className="sess-name-input"
          aria-label="Exercise name"
          placeholder="Exercise name"
          value={exercise.name}
          maxLength={80}
          autoComplete="off"
          onChange={(event) => onName(event.target.value)}
          onBlur={() => onNameCommit()}
        />
      ) : (
        <h1 className="sess-name">{exercise.name}</h1>
      )}
      <div className="sess-target">
        <div className="sess-target-copy">
          <strong>{exercise.targetLabel || `${exercise.targetSets} sets`}</strong>
          <span>{exercise.comparisonHint || (exercise.bodyweight ? 'Bodyweight' : exercise.lastNote || weight.detail)}</span>
        </div>
        <div className="sess-dots" role="group" aria-label="Sets">
          {Array.from({ length: exercise.targetSets }, (_, setIndex) => {
            const done = setIndex < logged;
            const now = editing === null && logged < exercise.targetSets && setIndex === logged;
            const edit = editing === setIndex;
            return (
              <button
                key={setIndex}
                type="button"
                className={cx(done && 'done', now && 'now', edit && 'edit')}
                aria-disabled={!done}
                aria-current={now ? 'true' : undefined}
                aria-label={done ? `Edit set ${setIndex + 1}` : now ? `Set ${setIndex + 1}, current` : `Set ${setIndex + 1}`}
                onClick={() => {
                  if (done) onEdit(setIndex);
                }}
              >
                <i />
              </button>
            );
          })}
        </div>
      </div>
      {exercise.bodyweight ? (
        <p className="sess-bw">Bodyweight</p>
      ) : (
        <div className="sess-pieces" role="group" aria-label="Pieces">
          {PIECE_CHOICES.map((choice) => {
            const on = exercise.pieces === choice.pieces && (choice.pieces === 2 || exercise.implement === choice.implement);
            return (
              <button key={`${choice.pieces}-${choice.implement}`} type="button" className={cx(on && 'on')} aria-pressed={on} onClick={() => onPieces(choice.pieces, choice.implement)}>
                <strong>{choice.count}</strong>
                <small>{choice.label}</small>
              </button>
            );
          })}
        </div>
      )}
      <section className={cx('sess-measure', exercise.bodyweight && 'is-body')} aria-label={exercise.bodyweight ? 'Bodyweight' : weight.caption}>
        <p className="kicker sess-caption">{exercise.bodyweight ? 'Bodyweight' : weight.caption}</p>
        <button type="button" className="sess-reset" disabled={exercise.bodyweight} onClick={onResetKg}>
          Reset
        </button>
        <p className="sess-value">
          <strong>{exercise.bodyweight ? 'BW' : weight.value}</strong>
        </p>
        <div className="sess-stepper">
          <StepButton label={exercise.bodyweight ? 'Bodyweight' : weight.caption} delta={-2} disabled={exercise.bodyweight} onBump={onBumpKg} />
          <StepButton label={exercise.bodyweight ? 'Bodyweight' : weight.caption} delta={-1} disabled={exercise.bodyweight} onBump={onBumpKg} />
          <StepButton label={exercise.bodyweight ? 'Bodyweight' : weight.caption} delta={1} disabled={exercise.bodyweight} onBump={onBumpKg} />
          <StepButton label={exercise.bodyweight ? 'Bodyweight' : weight.caption} delta={2} disabled={exercise.bodyweight} onBump={onBumpKg} />
        </div>
        <p className="sess-detail">{exercise.bodyweight ? 'Bodyweight' : weight.detail}</p>
      </section>
      <section className={cx('sess-measure', exercise.count === 'seconds' && 'has-timer')} aria-label={unit}>
        <p className="kicker sess-caption">{unit}</p>
        {exercise.count === 'seconds' ? (
          <button type="button" className="sess-timer-open" aria-label="Timer" disabled={!canOpenTimer} onClick={onOpenTimer}>
            Timer
          </button>
        ) : null}
        <button type="button" className="sess-reset" onClick={onResetReps}>
          Reset
        </button>
        <p className="sess-value">
          <strong>{exercise.pendingReps || '0'}</strong>
        </p>
        <div className="sess-stepper">
          <StepButton label={unit} delta={-2} onBump={onBumpReps} />
          <StepButton label={unit} delta={-1} onBump={onBumpReps} />
          <StepButton label={unit} delta={1} onBump={onBumpReps} />
          <StepButton label={unit} delta={2} onBump={onBumpReps} />
        </div>
        <p className={cx('sess-detail', notice && 'is-alert')}>{repsDetail}</p>
      </section>
    </main>
  );
}

function StepButton({ label, delta, disabled, onBump }: { label: string; delta: number; disabled?: boolean; onBump: (delta: number) => void }) {
  const sign = delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
  const verb = delta > 0 ? 'Increase' : 'Decrease';
  return (
    <button type="button" disabled={disabled} aria-label={`${verb} ${label} by ${Math.abs(delta)}`} onClick={() => onBump(delta)}>
      {sign}
    </button>
  );
}

function Review({
  draft,
  notice,
  complete,
  plannedDone,
  onMarkPlanned,
  onOpen,
  onAdd,
}: {
  draft: Draft;
  notice: string;
  complete: boolean;
  plannedDone: boolean | null;
  onMarkPlanned: (() => void) | null;
  onOpen: (index: number) => void;
  onAdd: (() => void) | null;
}) {
  return (
    <main className="sess-work">
      {onMarkPlanned && plannedDone !== null ? (
        <button type="button" className="sess-mark" aria-pressed={plannedDone} onClick={onMarkPlanned}>
          {plannedDone ? 'Mark not done' : 'Mark done'}
        </button>
      ) : null}
      <h1 className="sess-name sess-name-short">Review</h1>
      <p className="sess-next">
        <span>{notice || (complete ? 'Every set is logged.' : 'Only logged sets are saved.')}</span>
      </p>
      <ul className="sess-review">
        {draft.exercises.map((exercise, index) => {
          const summary = exercise.sets.length === 0 ? 'Not logged' : exercise.sets.map((set) => setToken(exercise, set)).join(' · ');
          return (
            <li key={exercise.key}>
              <button type="button" onClick={() => onOpen(index)} aria-label={`Edit ${exercise.name || 'exercise'}`}>
                <span className="sess-review-name">
                  <span>{exercise.name.trim() || 'Exercise'}</span>
                  <span>
                    {exercise.sets.length}/{exercise.targetSets}
                  </span>
                </span>
                <span className="sess-review-sets">{summary}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {onAdd ? (
        <button type="button" className="sess-add" onClick={onAdd}>
          Add exercise
        </button>
      ) : null}
    </main>
  );
}

function TimerModal({
  name,
  holdSeconds,
  restSec,
  view,
  paused,
  canStart,
  onHold,
  onRest,
  onStart,
  onPause,
  onResume,
  onClose,
}: {
  name: string;
  holdSeconds: number;
  restSec: number;
  view: TimerView | null;
  paused: boolean;
  canStart: boolean;
  onHold: (next: number) => void;
  onRest: (next: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const ignoreClose = useRef(false);
  const running = view !== null;
  const figure = !view ? '' : view.phase === 'rest' ? clock(view.secondsLeft) : String(view.secondsLeft);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      ignoreClose.current = true;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="sess-dialog timer-modal"
      aria-label={running ? `${view.caption} timer` : 'Set timer'}
      data-timer-phase={view?.phase ?? 'setup'}
      onPointerDown={(event) => event.stopPropagation()}
      onClose={() => {
        if (ignoreClose.current) return;
        onClose();
      }}
      onClick={(event) => {
        if (running) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) onClose();
      }}
    >
      <div className="timer-head">
        <p className={cx('kicker', running && `is-${view.phase}`)}>{running ? view.caption : 'Timer'}</p>
        <h2>{name}</h2>
      </div>
      {running ? (
        <>
          <div className="timer-actions">
            <button type="button" onClick={paused ? onResume : onPause}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
          <p className={cx('timer-face', `is-${view.phase}`, paused && 'is-paused')}>
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle className="timer-track" cx="50" cy="50" r="42" />
              <circle className="timer-arc" cx="50" cy="50" r="42" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - view.progress} />
            </svg>
            <strong>{figure}</strong>
            {paused ? <small>Paused</small> : null}
          </p>
        </>
      ) : (
        <>
          <p className="kicker">Hold</p>
          <p className="timer-setup-value">{holdSeconds}</p>
          <div className="timer-adjust" aria-label="Hold length">
            <button type="button" onClick={() => onHold(holdSeconds - 5)} aria-label="Decrease hold by 5">
              −5
            </button>
            <button type="button" onClick={() => onHold(holdSeconds - 1)} aria-label="Decrease hold by 1">
              −1
            </button>
            <button type="button" onClick={() => onHold(holdSeconds + 1)} aria-label="Increase hold by 1">
              +1
            </button>
            <button type="button" onClick={() => onHold(holdSeconds + 5)} aria-label="Increase hold by 5">
              +5
            </button>
          </div>
          <p className="kicker">Rest</p>
          <div className="timer-presets" role="group" aria-label="Rest presets">
            {REST_PRESETS.map((preset) => (
              <button key={preset} type="button" className={cx(restSec === preset && 'on')} aria-pressed={restSec === preset} onClick={() => onRest(preset)}>
                {preset === 0 ? 'Off' : preset}
              </button>
            ))}
          </div>
          <div className="timer-adjust timer-adjust-rest" aria-label="Rest length">
            <button type="button" onClick={() => onRest(restSec - 15)} aria-label="Decrease rest by 15 seconds">
              −15
            </button>
            <strong>{restSec === 0 ? 'Off' : clock(restSec)}</strong>
            <button type="button" onClick={() => onRest(restSec + 15)} aria-label="Increase rest by 15 seconds">
              +15
            </button>
          </div>
          <button type="button" className="sess-log" disabled={!canStart} aria-label="Start timer" onClick={onStart}>
            Start
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </>
      )}
    </dialog>
  );
}

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const ignoreClose = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      ignoreClose.current = true;
      if (dialog.open) dialog.close();
    };
  }, []);

  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) onClose();
  }

  return (
    <dialog
      ref={ref}
      className="sess-dialog"
      aria-label={label}
      onClose={() => {
        if (ignoreClose.current) return;
        onClose();
      }}
      onClick={onDialogClick}
    >
      {children}
    </dialog>
  );
}
