import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ExerciseDemo } from '../components/ExerciseDemo';
import { useHashRoute } from '../hooks/useHashRoute';
import { useScreenWakeLock } from '../hooks/useScreenWakeLock';
import { cx } from '../lib/cx';
import { trimNum } from '../lib/format';
import { shownLoad } from '../lib/load';
import { requestScreenWakeLock } from '../lib/screen-wake';
import type { LoadImplement, LoadPieces } from '../types';
import { findPrototypeSession, prototypeSessions, type PrototypeExercise, type PrototypeSession } from './plan';
import './session.css';

const PIECE_CHOICES: { pieces: LoadPieces; implement: LoadImplement; count: string; label: string }[] = [
  { pieces: 1, implement: 'dumbbell', count: '1', label: 'dumbbell' },
  { pieces: 1, implement: 'kettlebell', count: '1', label: 'kettlebell' },
  { pieces: 2, implement: 'dumbbell', count: '2', label: 'dumbbells' },
];

const REST_CHOICES = [45, 60, 90, 120];

interface LoggedSet {
  reps: number;
  kg: number;
  pieces: LoadPieces | null;
  implement: LoadImplement | null;
}

interface Pending {
  kg: number;
  reps: number;
  pieces: LoadPieces | null;
  implement: LoadImplement | null;
}

interface ExerciseWork extends Pending {
  sets: LoggedSet[];
}

type Sheet = 'exit' | 'sessions' | 'switch' | 'saved';

function goToHash(hash: string) {
  window.location.hash = hash;
}

function clock(total: number): string {
  const safe = Math.max(0, Math.trunc(total));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function targetLine(exercise: PrototypeExercise): string {
  const amount = `${exercise.sets} × ${exercise.repsLabel}`;
  return exercise.count === 'seconds' ? `${amount} sec` : amount;
}

function setToken(exercise: PrototypeExercise, set: LoggedSet): string {
  if (exercise.bodyweight) return exercise.count === 'seconds' ? `${set.reps}s` : String(set.reps);
  return `${trimNum(set.kg)}×${set.reps}`;
}

export function SessionPrototype() {
  const route = useHashRoute();
  const session = findPrototypeSession(route.id);
  return <SessionScreen key={session.id} session={session} />;
}

function SessionScreen({ session }: { session: PrototypeSession }) {
  const sessions = prototypeSessions();
  const [cursor, setCursor] = useState(0);
  const [work, setWork] = useState<ExerciseWork[]>(() =>
    session.exercises.map((exercise) => ({
      kg: exercise.seedKg,
      reps: exercise.seedReps,
      pieces: exercise.pieces,
      implement: exercise.implement,
      sets: [],
    })),
  );
  const [editing, setEditing] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const [notice, setNotice] = useState('');
  const [restOn, setRestOn] = useState(false);
  const [restChoice, setRestChoice] = useState(90);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const snapshot = useRef<Pending | null>(null);
  const swipe = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressClick = useRef(false);

  const reviewing = cursor >= session.exercises.length;
  const exercise = session.exercises[cursor];
  const entry = work[cursor];
  const dirty = work.some((item) => item.sets.length > 0);

  useScreenWakeLock();

  useEffect(() => {
    document.title = `${session.short} · Session preview`;
    const meta = document.querySelector('meta[name="viewport"]');
    const previous = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    document.documentElement.classList.add('proto-lock');
    const onPointerDown = () => requestScreenWakeLock();
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.documentElement.classList.remove('proto-lock');
      document.removeEventListener('pointerdown', onPointerDown, true);
      if (meta && previous !== null) meta.setAttribute('content', previous);
    };
  }, [session.short]);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const ending = remaining === 1;
    const id = window.setTimeout(() => {
      setRemaining((current) => (current === null || current <= 0 ? current : current - 1));
      if (ending) setLive('Rest done');
    }, 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  function patch(partial: Partial<Pending>) {
    setWork((current) => current.map((item, index) => (index === cursor ? { ...item, ...partial } : item)));
  }

  function restorePending() {
    const snap = snapshot.current;
    const edit = editing;
    snapshot.current = null;
    setEditing(null);
    if (!snap || !edit) return;
    setWork((current) => current.map((item, index) => (index === edit.exerciseIndex ? { ...item, ...snap } : item)));
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(session.exercises.length, next));
    if (clamped === cursor) return;
    restorePending();
    setNotice('');
    setCursor(clamped);
  }

  function beginEdit(setIndex: number) {
    const logged = entry?.sets[setIndex];
    if (!entry || !logged) return;
    if (editing?.exerciseIndex === cursor && editing.setIndex === setIndex) {
      restorePending();
      setNotice('');
      return;
    }
    if (!editing) snapshot.current = { kg: entry.kg, reps: entry.reps, pieces: entry.pieces, implement: entry.implement };
    setEditing({ exerciseIndex: cursor, setIndex });
    setNotice('');
    patch({ kg: logged.kg, reps: logged.reps, pieces: logged.pieces, implement: logged.implement });
  }

  function commit() {
    if (!exercise || !entry) return;
    if (entry.reps <= 0) {
      setNotice(exercise.count === 'seconds' ? 'Add seconds, then log the set.' : 'Add reps, then log the set.');
      return;
    }
    const nextSet: LoggedSet = {
      reps: entry.reps,
      kg: exercise.bodyweight ? 0 : entry.kg,
      pieces: exercise.bodyweight ? null : entry.pieces,
      implement: exercise.bodyweight ? null : entry.implement,
    };
    const edit = editing?.exerciseIndex === cursor ? editing : null;
    setWork((current) =>
      current.map((item, index) => {
        if (index !== cursor) return item;
        const sets = edit ? item.sets.map((set, setIndex) => (setIndex === edit.setIndex ? nextSet : set)) : [...item.sets, nextSet];
        return { ...item, sets };
      }),
    );
    const setNumber = edit ? edit.setIndex + 1 : entry.sets.length + 1;
    snapshot.current = null;
    setEditing(null);
    setNotice('');
    if (!edit && restOn) {
      setRemaining(restChoice);
      setLive(`Logged set ${setNumber}. Rest ${clock(restChoice)}.`);
    } else {
      setLive(edit ? `Updated set ${setNumber}.` : `Logged set ${setNumber}.`);
    }
    requestScreenWakeLock();
  }

  function bumpKg(delta: number) {
    if (!exercise || exercise.bodyweight) return;
    setNotice('');
    setWork((current) => current.map((item, index) => (index === cursor ? { ...item, kg: Math.max(0, item.kg + delta) } : item)));
  }

  function bumpReps(delta: number) {
    setNotice('');
    setWork((current) => current.map((item, index) => (index === cursor ? { ...item, reps: Math.max(0, item.reps + delta) } : item)));
  }

  function chooseSession(id: string) {
    if (id === session.id) {
      setSheet(null);
      return;
    }
    if (dirty) {
      setPendingId(id);
      setSheet('switch');
      return;
    }
    goToHash(`#/prototype/session/${id}`);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    suppressClick.current = false;
    if (event.button !== 0 || sheet) return;
    swipe.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.pointerId !== event.pointerId || sheet) return;
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

  const nextLabel = reviewing ? '' : cursor >= session.exercises.length - 1 ? 'Review' : session.exercises[cursor + 1]?.name ?? 'Review';
  const restLabel = !restOn ? 'Off' : remaining === null ? clock(restChoice) : clock(remaining);
  const restRunning = remaining !== null && remaining > 0;

  return (
    <div className="proto-screen" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)} onClickCapture={onClickCapture}>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      <header className="proto-header">
        <button type="button" className="proto-exit" onClick={() => setSheet('exit')}>
          Exit
        </button>
        <button
          type="button"
          className="proto-progress"
          onClick={() => setSheet('sessions')}
          aria-label={reviewing ? `Review, ${session.short}. Change session.` : `Exercise ${cursor + 1} of ${session.exercises.length}, ${session.short}. Change session.`}
        >
          <small>{session.short}</small>
          <strong>{reviewing ? 'Review' : `${cursor + 1} of ${session.exercises.length}`}</strong>
        </button>
        <div className="proto-header-side">{exercise && !reviewing ? <ExerciseDemo name={exercise.name} className="proto-form" /> : null}</div>
      </header>

      {reviewing ? (
        <Review session={session} work={work} onOpen={(index) => goTo(index)} />
      ) : exercise && entry ? (
        <ExercisePane
          exercise={exercise}
          entry={entry}
          editing={editing?.exerciseIndex === cursor ? editing.setIndex : null}
          notice={notice}
          nextLabel={nextLabel}
          onPieces={(pieces, implement) => patch({ pieces, implement: pieces === 2 ? 'dumbbell' : implement })}
          onBumpKg={bumpKg}
          onBumpReps={bumpReps}
          onResetKg={() => patch({ kg: exercise.seedKg })}
          onResetReps={() => patch({ reps: exercise.seedReps })}
          onEdit={beginEdit}
        />
      ) : null}

      <footer className="proto-footer">
        {reviewing ? null : (
          <div className="proto-rest" aria-label="Rest timer">
            <button
              type="button"
              className={cx(restOn && 'on')}
              aria-pressed={restOn}
              onClick={() => {
                setRestOn((on) => !on);
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
                setRestChoice(REST_CHOICES[(index + 1) % REST_CHOICES.length] ?? 90);
              }}
            >
              <span className="proto-clock">{restLabel}</span>
            </button>
            <button type="button" disabled={!restRunning && remaining !== 0} onClick={() => setRemaining(null)}>
              Stop
            </button>
          </div>
        )}
        {reviewing ? (
          <div className="proto-nav proto-nav-single">
            <button type="button" onClick={() => goTo(cursor - 1)}>
              Back
            </button>
          </div>
        ) : (
          <div className="proto-nav">
            <button type="button" disabled={cursor === 0} onClick={() => goTo(cursor - 1)}>
              Prev
            </button>
            <button type="button" onClick={() => goTo(cursor + 1)}>
              Skip
            </button>
            <button type="button" onClick={() => goTo(cursor + 1)} aria-label={`Next: ${nextLabel}`}>
              Next
            </button>
          </div>
        )}
        {reviewing ? (
          <button type="button" className="proto-log" onClick={() => setSheet('saved')}>
            Save
          </button>
        ) : (
          <button type="button" className="proto-log" onClick={commit}>
            {editing?.exerciseIndex === cursor ? 'Update set' : 'Log set'}
          </button>
        )}
      </footer>

      {sheet ? (
        <Sheet label={sheetTitle(sheet)} onClose={() => setSheet(null)}>
          {sheet === 'exit' ? (
            <>
              <h2>Exit session?</h2>
              <p>Logged sets stay on this screen only. Nothing is saved to the log.</p>
              <div className="proto-dialog-actions">
                <button type="button" onClick={() => setSheet(null)}>
                  Stay
                </button>
                <button
                  type="button"
                  className="proto-log"
                  onClick={() => {
                    goToHash('#/today');
                  }}
                >
                  Exit
                </button>
              </div>
            </>
          ) : null}
          {sheet === 'sessions' ? (
            <>
              <h2>Home sessions</h2>
              <p>Preview only. These are the strength days on the home plan.</p>
              <div className="proto-session-list">
                {sessions.map((item) => (
                  <button key={item.id} type="button" className={cx(item.id === session.id && 'on')} aria-current={item.id === session.id ? 'true' : undefined} onClick={() => chooseSession(item.id)}>
                    <strong>{item.short}</strong>
                    <small>
                      {item.exercises.length} exercises · {item.title}
                    </small>
                  </button>
                ))}
              </div>
              <div className="proto-dialog-actions">
                <button type="button" onClick={() => setSheet(null)}>
                  Close
                </button>
              </div>
            </>
          ) : null}
          {sheet === 'switch' ? (
            <>
              <h2>Change session?</h2>
              <p>This clears the sets on this screen. Nothing is saved.</p>
              <div className="proto-dialog-actions">
                <button type="button" onClick={() => setSheet(null)}>
                  Stay
                </button>
                <button
                  type="button"
                  className="proto-log"
                  onClick={() => {
                    if (pendingId) goToHash(`#/prototype/session/${pendingId}`);
                  }}
                >
                  Change
                </button>
              </div>
            </>
          ) : null}
          {sheet === 'saved' ? (
            <>
              <h2>Preview only</h2>
              <p>This prototype does not write to the log, the gist, or this browser.</p>
              <div className="proto-dialog-actions">
                <button type="button" className="proto-log" onClick={() => setSheet(null)}>
                  Back to review
                </button>
              </div>
            </>
          ) : null}
        </Sheet>
      ) : null}
    </div>
  );
}

function ExercisePane({
  exercise,
  entry,
  editing,
  notice,
  nextLabel,
  onPieces,
  onBumpKg,
  onBumpReps,
  onResetKg,
  onResetReps,
  onEdit,
}: {
  exercise: PrototypeExercise;
  entry: ExerciseWork;
  editing: number | null;
  notice: string;
  nextLabel: string;
  onPieces: (pieces: LoadPieces, implement: LoadImplement) => void;
  onBumpKg: (delta: number) => void;
  onBumpReps: (delta: number) => void;
  onResetKg: () => void;
  onResetReps: () => void;
  onEdit: (setIndex: number) => void;
}) {
  const weight = shownLoad(entry.pieces, entry.implement, trimNum(entry.kg), false);
  const unit = exercise.count === 'seconds' ? 'Seconds' : 'Reps';
  const logged = entry.sets.length;
  const repsDetail = notice
    ? notice
    : editing !== null
      ? `Editing set ${editing + 1}`
      : logged > exercise.sets
        ? `${logged} logged`
        : exercise.count === 'seconds'
          ? `Target ${exercise.repsLabel} sec`
          : `Target ${exercise.repsLabel}`;

  return (
    <main className="proto-work">
      <h1 className="proto-name">{exercise.name}</h1>
      <p className="proto-next">
        <span className="kicker">Next</span>
        <span>{nextLabel}</span>
      </p>
      <div className="proto-target">
        <div className="proto-target-copy">
          <strong>{targetLine(exercise)}</strong>
          <span>{exercise.loadLabel}</span>
        </div>
        <div className="proto-dots" role="group" aria-label="Sets">
          {Array.from({ length: exercise.sets }, (_, setIndex) => {
            const done = setIndex < logged;
            const now = editing === null && logged < exercise.sets && setIndex === logged;
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
        <p className="proto-bw">Bodyweight</p>
      ) : (
        <div className="proto-pieces" role="group" aria-label="Pieces">
          {PIECE_CHOICES.map((choice) => {
            const on = entry.pieces === choice.pieces && (choice.pieces === 2 || entry.implement === choice.implement);
            return (
              <button key={`${choice.pieces}-${choice.implement}`} type="button" className={cx(on && 'on')} aria-pressed={on} onClick={() => onPieces(choice.pieces, choice.implement)}>
                <strong>{choice.count}</strong>
                <small>{choice.label}</small>
              </button>
            );
          })}
        </div>
      )}
      <section className={cx('proto-measure', exercise.bodyweight && 'is-body')} aria-label={exercise.bodyweight ? 'Bodyweight' : weight.caption}>
        <p className="kicker proto-caption">{exercise.bodyweight ? 'Bodyweight' : weight.caption}</p>
        <button type="button" className="proto-reset" disabled={exercise.bodyweight} onClick={onResetKg}>
          Reset
        </button>
        <p className="proto-value">
          <strong>{exercise.bodyweight ? 'BW' : weight.value}</strong>
        </p>
        <div className="proto-stepper">
          <StepButton label={exercise.bodyweight ? 'Bodyweight' : weight.caption} delta={-2} disabled={exercise.bodyweight} onBump={onBumpKg} />
          <StepButton label={exercise.bodyweight ? 'Bodyweight' : weight.caption} delta={-1} disabled={exercise.bodyweight} onBump={onBumpKg} />
          <StepButton label={exercise.bodyweight ? 'Bodyweight' : weight.caption} delta={1} disabled={exercise.bodyweight} onBump={onBumpKg} />
          <StepButton label={exercise.bodyweight ? 'Bodyweight' : weight.caption} delta={2} disabled={exercise.bodyweight} onBump={onBumpKg} />
        </div>
        <p className="proto-detail">{exercise.bodyweight ? exercise.loadLabel : weight.detail}</p>
      </section>
      <section className="proto-measure" aria-label={unit}>
        <p className="kicker proto-caption">{unit}</p>
        <button type="button" className="proto-reset" onClick={onResetReps}>
          Reset
        </button>
        <p className="proto-value">
          <strong>{entry.reps}</strong>
        </p>
        <div className="proto-stepper">
          <StepButton label={unit} delta={-2} onBump={onBumpReps} />
          <StepButton label={unit} delta={-1} onBump={onBumpReps} />
          <StepButton label={unit} delta={1} onBump={onBumpReps} />
          <StepButton label={unit} delta={2} onBump={onBumpReps} />
        </div>
        <p className={cx('proto-detail', notice && 'is-alert')}>{repsDetail}</p>
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

function Review({ session, work, onOpen }: { session: PrototypeSession; work: ExerciseWork[]; onOpen: (index: number) => void }) {
  return (
    <main className="proto-work">
      <h1 className="proto-name proto-name-short">Review</h1>
      <p className="proto-next">
        <span>Preview only. Nothing is saved.</span>
      </p>
      <ul className="proto-review">
        {session.exercises.map((exercise, index) => {
          const sets = work[index]?.sets ?? [];
          const summary = sets.length === 0 ? 'Not logged' : sets.map((set) => setToken(exercise, set)).join(' · ');
          return (
            <li key={exercise.name}>
              <button type="button" onClick={() => onOpen(index)} aria-label={`Edit ${exercise.name}`}>
                <span className="proto-review-name">
                  <span>{exercise.name}</span>
                  <span>
                    {sets.length}/{exercise.sets}
                  </span>
                </span>
                <span className="proto-review-sets">{summary}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function sheetTitle(sheet: Sheet): string {
  if (sheet === 'exit') return 'Exit session?';
  if (sheet === 'sessions') return 'Home sessions';
  if (sheet === 'switch') return 'Change session?';
  return 'Preview only';
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
      className="proto-dialog"
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
