import { useState } from 'react';
import { Field } from './Field';
import { ExerciseDemo } from './ExerciseDemo';
import { StrengthWatchFields } from './WatchFields';
import { cx } from '../lib/cx';
import {
  COMMON_LIFTS,
  blankExercise,
  withPieces,
  type Draft,
  type ExerciseDraft,
  type SetDraft,
} from '../lib/draft';
import { parseNum, trimNum } from '../lib/format';
import { uid } from '../lib/ids';
import { defaultLoad, formatAmount, shownLoad } from '../lib/load';
import type { PlanChoice } from '../lib/plans';
import type { LoadImplement, LoadPieces, Session, TrainingData } from '../types';

const PIECE_CHOICES: { pieces: LoadPieces; implement: LoadImplement; count: string; label: string }[] = [
  { pieces: 1, implement: 'dumbbell', count: '1', label: 'dumbbell' },
  { pieces: 1, implement: 'kettlebell', count: '1', label: 'kettlebell' },
  { pieces: 2, implement: 'dumbbell', count: '2', label: 'dumbbells' },
];

export function StrengthGuide({
  draft,
  setDraft,
  data,
  choices,
  duplicate,
  error,
  existing,
  allowKindChange,
  confirmDelete,
  setConfirmDelete,
  onDelete,
  onChoosePlan,
  onKind,
  onPreset,
}: {
  draft: Draft;
  setDraft: (value: Draft | ((current: Draft) => Draft)) => void;
  data: TrainingData;
  choices: PlanChoice[];
  duplicate: boolean;
  error: string | null;
  existing: Session | undefined;
  allowKindChange: boolean;
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
  onDelete: (id: string) => void;
  onChoosePlan: (planSessionId: string) => void;
  onKind: (kind: 'strength' | 'run') => void;
  onPreset: (presetId: string) => void;
}) {
  const [phase, setPhase] = useState<'work' | 'finish'>(() => (existing && draft.exercises.some((exercise) => exercise.sets.length > 0) ? 'finish' : 'work'));
  const [cursor, setCursor] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [readyKeys, setReadyKeys] = useState<string[]>(() => draft.exercises.filter((exercise) => exercise.name.trim()).map((exercise) => exercise.key));

  const index = Math.min(cursor, Math.max(0, draft.exercises.length - 1));
  const exercise = draft.exercises[index] ?? draft.exercises[0];
  const showNaming = phase === 'work' && exercise !== undefined && !readyKeys.includes(exercise.key);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function patch(key: string, partial: Partial<ExerciseDraft>) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((item) => (item.key === key ? { ...item, ...partial } : item)),
    }));
  }

  function openExercise(next: number) {
    setCursor(next);
    setPhase('work');
    setEditingKey(null);
    setNotice('');
  }

  function goReview() {
    setPhase('finish');
    setEditingKey(null);
    setNotice('');
  }

  if (!exercise) return null;

  return (
    <div className="guide">
      {allowKindChange ? (
        <div className="seg" role="group" aria-label="Session type">
          <button type="button" className="on">
            Strength
          </button>
          <button type="button" onClick={() => onKind('run')}>
            Run
          </button>
        </div>
      ) : null}

      <div className="guide-controls">
        <div className="guide-date-row">
          <span className="kicker">Date</span>
          <input className="guide-date" type="date" value={draft.date} aria-label="Date" required onChange={(event) => update('date', event.target.value)} />
        </div>
        <div className="guide-nav">
          {phase === 'work' && index === 0 ? (
            <a className="btn ghost guide-nav-btn" href="#/today">
              Cancel
            </a>
          ) : (
            <button
              type="button"
              className="btn ghost guide-nav-btn"
              onClick={() => {
                if (phase === 'finish') setPhase('work');
                else openExercise(index - 1);
              }}
            >
              Back
            </button>
          )}
          <p className="kicker guide-count">{phase === 'finish' ? 'Review' : `${index + 1} / ${draft.exercises.length}`}</p>
          <div className="guide-form-slot">{phase === 'work' && !showNaming ? <ExerciseDemo name={exercise.name} /> : null}</div>
        </div>
        <div className="guide-progress">
          <div className="guide-dots" role="group" aria-label="Exercises">
            {draft.exercises.map((item, itemIndex) => (
              <button
                key={item.key}
                type="button"
                className={cx(phase === 'work' && itemIndex === index && 'on', item.sets.length > 0 && 'done')}
                aria-current={phase === 'work' && itemIndex === index ? 'true' : undefined}
                aria-label={item.name.trim() || `Exercise ${itemIndex + 1}`}
                onClick={() => openExercise(itemIndex)}
              >
                <i />
              </button>
            ))}
          </div>
          <button type="button" className={cx('btn ghost guide-nav-btn', phase === 'finish' && 'on')} aria-current={phase === 'finish' ? 'step' : undefined} onClick={goReview}>
            Review
          </button>
        </div>
      </div>

      {phase === 'finish' ? (
        <Review
          draft={draft}
          setDraft={setDraft}
          data={data}
          choices={choices}
          duplicate={duplicate}
          error={error}
          existing={existing}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          onDelete={onDelete}
          onChoosePlan={onChoosePlan}
          update={update}
          onEdit={openExercise}
          onAdd={() => {
            const next = blankExercise();
            setDraft((current) => ({ ...current, exercises: [...current.exercises, next] }));
            setCursor(draft.exercises.length);
            setPhase('work');
            setNotice('');
          }}
          onRemove={(key) => {
            setDraft((current) => {
              const exercises = current.exercises.filter((item) => item.key !== key);
              return { ...current, exercises: exercises.length > 0 ? exercises : [blankExercise()] };
            });
            setCursor(0);
          }}
        />
      ) : showNaming ? (
        <Naming
          exercise={exercise}
          notice={notice}
          presets={allowKindChange ? data.presets : []}
          onPreset={onPreset}
          onName={(name) => patch(exercise.key, { name })}
          onStart={() => acceptName(exercise, patch, setReadyKeys, setNotice)}
        />
      ) : (
        <Work
          exercise={exercise}
          editingKey={editingKey}
          notice={notice}
          isLast={index >= draft.exercises.length - 1}
          onPatch={(partial) => patch(exercise.key, partial)}
          onCommit={() => commitSet(exercise, editingKey, setDraft, setEditingKey, setNotice)}
          onAdvance={() => {
            setEditingKey(null);
            setNotice('');
            if (index >= draft.exercises.length - 1) setPhase('finish');
            else setCursor(index + 1);
          }}
          onEdit={(set) => {
            setEditingKey(set.key);
            patch(exercise.key, { pendingReps: set.reps, pendingKg: set.kgPerPiece || '0', pendingAsTotal: Boolean(set.asTotal) });
            setNotice('');
          }}
          onRemove={(key) => {
            setDraft((current) => ({
              ...current,
              exercises: current.exercises.map((item) => (item.key === exercise.key ? { ...item, sets: item.sets.filter((set) => set.key !== key) } : item)),
            }));
            if (editingKey === key) setEditingKey(null);
          }}
          onNotice={setNotice}
        />
      )}
    </div>
  );
}

function acceptName(
  exercise: ExerciseDraft,
  patch: (key: string, partial: Partial<ExerciseDraft>) => void,
  setReadyKeys: (value: string[] | ((current: string[]) => string[])) => void,
  setNotice: (value: string) => void,
) {
  const name = exercise.name.trim();
  if (!name) {
    setNotice('Name the exercise first.');
    return;
  }
  const load = defaultLoad(name);
  if (exercise.sets.length === 0 && load.kind === 'bodyweight') {
    patch(exercise.key, { name, bodyweight: true, pieces: null, implement: null, pendingKg: '0', pendingAsTotal: false, seedKg: '0', seedAsTotal: false, lastNote: '' });
  } else if (exercise.sets.length === 0 && load.kind === 'loaded') {
    patch(exercise.key, { name, bodyweight: false, pieces: load.pieces, implement: load.implement, pendingAsTotal: false, seedAsTotal: false });
  } else {
    patch(exercise.key, { name });
  }
  setReadyKeys((keys) => (keys.includes(exercise.key) ? keys : [...keys, exercise.key]));
  setNotice('');
}

function Naming({
  exercise,
  notice,
  presets,
  onPreset,
  onName,
  onStart,
}: {
  exercise: ExerciseDraft;
  notice: string;
  presets: TrainingData['presets'];
  onPreset: (presetId: string) => void;
  onName: (name: string) => void;
  onStart: () => void;
}) {
  return (
    <>
      <div className="guide-title-block">
        <p className="kicker">Strength</p>
        <h1>Which exercise?</h1>
      </div>
      {presets.length > 0 ? (
        <div className="stack">
          <p className="kicker">Start from a preset</p>
          <div className="chips" aria-label="Workout presets">
            {presets.map((preset) => (
              <button key={preset.id} type="button" className="chip" onClick={() => onPreset(preset.id)}>
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <article className="guide-card">
        <Field label="Exercise">
          <input value={exercise.name} onChange={(event) => onName(event.target.value)} placeholder="Goblet squat" maxLength={80} autoComplete="off" />
        </Field>
        <div className="chips" aria-label="Common exercises">
          {COMMON_LIFTS.map((name) => (
            <button key={name} type="button" className={cx('chip', exercise.name === name && 'on')} onClick={() => onName(name)}>
              {name}
            </button>
          ))}
        </div>
        <button type="button" className="btn primary" onClick={onStart}>
          Start sets
        </button>
        <p className="guide-status" role="status">
          {notice || 'Pick a name, then start the sets.'}
        </p>
      </article>
    </>
  );
}

function Work({
  exercise,
  editingKey,
  notice,
  isLast,
  onPatch,
  onCommit,
  onAdvance,
  onEdit,
  onRemove,
  onNotice,
}: {
  exercise: ExerciseDraft;
  editingKey: string | null;
  notice: string;
  isLast: boolean;
  onPatch: (partial: Partial<ExerciseDraft>) => void;
  onCommit: () => void;
  onAdvance: () => void;
  onEdit: (set: SetDraft) => void;
  onRemove: (key: string) => void;
  onNotice: (value: string) => void;
}) {
  const weight = shownLoad(exercise.pieces, exercise.implement, exercise.pendingKg, exercise.pendingAsTotal);
  const detail = !exercise.pieces && exercise.lastNote ? exercise.lastNote : weight.detail;
  const unit = exercise.count === 'seconds' ? 'Seconds' : 'Reps';

  function acceptKg(raw: string) {
    const cleaned = raw.replace(',', '.');
    if (cleaned !== '' && !/^\d{0,4}(\.\d?)?$/.test(cleaned)) return;
    onPatch({ pendingKg: cleaned, pendingAsTotal: exercise.pieces ? false : true });
    onNotice('');
  }

  function acceptReps(raw: string) {
    const cleaned = raw.replace(',', '.');
    if (cleaned !== '' && !/^\d{0,4}$/.test(cleaned)) return;
    onPatch({ pendingReps: cleaned });
    onNotice('');
  }

  return (
    <>
      <div className="guide-title-block">
        <p className="kicker">{exercise.targetLabel ? `Target ${exercise.targetLabel}` : 'Strength'}</p>
        <h1>{exercise.name}</h1>
      </div>
      <article className="guide-card">
        {exercise.bodyweight ? (
          <p className="guide-bodyweight">Bodyweight</p>
        ) : (
          <>
            <div className="piece-pick" role="group" aria-label="Pieces">
              {PIECE_CHOICES.map((choice) => {
                const on = exercise.pieces === choice.pieces && (choice.pieces === 2 || exercise.implement === choice.implement);
                return (
                  <button
                    key={`${choice.pieces}-${choice.implement}`}
                    type="button"
                    className={cx(on && 'on')}
                    aria-pressed={on}
                    onClick={() => {
                      const next = withPieces(exercise, choice.pieces, choice.implement);
                      onPatch({ pieces: next.pieces, implement: next.implement, bodyweight: false });
                    }}
                  >
                    <strong>{choice.count}</strong>
                    <small>{choice.label}</small>
                  </button>
                );
              })}
            </div>
            <div className="guide-measure">
              <p className="kicker">{weight.caption}</p>
              <Stepper label={weight.caption} value={weight.value} onChange={acceptKg} onReset={() => onPatch({ pendingKg: exercise.seedKg, pendingAsTotal: exercise.seedAsTotal })} />
              <p className="guide-detail">{detail}</p>
            </div>
          </>
        )}
        <div className="guide-measure">
          <p className="kicker">{unit}</p>
          <Stepper label={unit} value={exercise.pendingReps} onChange={acceptReps} onReset={() => onPatch({ pendingReps: exercise.seedReps })} />
          <p className="guide-detail">{exercise.targetLabel ? `Target ${exercise.targetLabel}` : 'Log each set, then move on'}</p>
        </div>
        <div className="guide-actions">
          <button type="button" className="btn primary" onClick={onCommit}>
            {editingKey ? 'Update set' : 'Log set'}
          </button>
          <button type="button" className="btn ghost" onClick={onAdvance}>
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
        <p className="guide-status" role="status">
          {notice || `${exercise.sets.length} of ${exercise.targetSets} sets`}
        </p>
      </article>
      <section className="logged-sets" aria-label="Logged sets">
        <p className="kicker">Sets</p>
        {exercise.sets.length === 0 ? (
          <p className="guide-detail">None yet</p>
        ) : (
          <ul>
            {exercise.sets.map((set, setIndex) => (
              <li key={set.key} className={cx('logged-set', editingKey === set.key && 'on')}>
                <button type="button" onClick={() => onEdit(set)}>
                  <span>Set {setIndex + 1}</span>
                  <small>{setLine(exercise, set)}</small>
                </button>
                <button type="button" className="icon-btn" aria-label={`Remove set ${setIndex + 1}`} onClick={() => onRemove(set.key)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function commitSet(
  exercise: ExerciseDraft,
  editingKey: string | null,
  setDraft: (value: Draft | ((current: Draft) => Draft)) => void,
  setEditingKey: (value: string | null) => void,
  setNotice: (value: string) => void,
) {
  const reps = parseNum(exercise.pendingReps);
  if (reps === null || reps <= 0) {
    setNotice(exercise.count === 'seconds' ? 'Add seconds, then log the set.' : 'Add reps, then log the set.');
    return;
  }
  const next: SetDraft = {
    key: editingKey ?? uid('set'),
    reps: String(Math.round(reps)),
    kgPerPiece: exercise.bodyweight ? '' : exercise.pendingKg,
    asTotal: exercise.bodyweight ? false : !exercise.pieces || exercise.pendingAsTotal,
  };
  setDraft((current) => ({
    ...current,
    exercises: current.exercises.map((item) => {
      if (item.key !== exercise.key) return item;
      const sets = editingKey ? item.sets.map((set) => (set.key === editingKey ? next : set)) : [...item.sets, next];
      return { ...item, sets };
    }),
  }));
  setEditingKey(null);
  setNotice('');
}

function setLine(exercise: ExerciseDraft, set: SetDraft): string {
  const unit = exercise.count === 'seconds' ? 'sec' : 'reps';
  const load = exercise.bodyweight ? '' : formatAmount(exercise.pieces, exercise.implement, set.kgPerPiece, Boolean(set.asTotal));
  return load ? `${load} × ${set.reps} ${unit}` : `${set.reps} ${unit}`;
}

function Stepper({ label, value, onChange, onReset }: { label: string; value: string; onChange: (value: string) => void; onReset: () => void }) {
  function bump(delta: number) {
    const current = parseNum(value) ?? 0;
    onChange(trimNum(Math.max(0, current + delta)));
  }
  return (
    <div className="stepper">
      <button type="button" onClick={() => bump(-2)} aria-label={`Decrease ${label} by 2`}>
        −2
      </button>
      <button type="button" onClick={() => bump(-1)} aria-label={`Decrease ${label} by 1`}>
        −1
      </button>
      <input
        inputMode="decimal"
        aria-label={label}
        value={value}
        autoComplete="off"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="button" onClick={() => bump(1)} aria-label={`Increase ${label} by 1`}>
        +1
      </button>
      <button type="button" onClick={() => bump(2)} aria-label={`Increase ${label} by 2`}>
        +2
      </button>
      <button type="button" className="step-reset" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}

function Review({
  draft,
  setDraft,
  data,
  choices,
  duplicate,
  error,
  existing,
  confirmDelete,
  setConfirmDelete,
  onDelete,
  onChoosePlan,
  update,
  onEdit,
  onAdd,
  onRemove,
}: {
  draft: Draft;
  setDraft: (value: Draft | ((current: Draft) => Draft)) => void;
  data: TrainingData;
  choices: PlanChoice[];
  duplicate: boolean;
  error: string | null;
  existing: Session | undefined;
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
  onDelete: (id: string) => void;
  onChoosePlan: (planSessionId: string) => void;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  onEdit: (index: number) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  return (
    <>
      <div className="guide-title-block">
        <p className="kicker">Strength</p>
        <h1>{draft.title.trim() || 'Session'}</h1>
      </div>
      <ul className="review-list">
        {draft.exercises.map((exercise, exerciseIndex) => (
          <li key={exercise.key} className="review-exercise">
            <div className="split">
              <strong>{exercise.name.trim() || 'Exercise'}</strong>
              <span className="review-actions">
                <button type="button" className="btn ghost small" onClick={() => onEdit(exerciseIndex)}>
                  Edit
                </button>
                <button type="button" className="btn ghost small" onClick={() => onRemove(exercise.key)}>
                  Remove
                </button>
              </span>
            </div>
            {exercise.sets.length === 0 ? (
              <p className="muted fine">Not logged. It stays out of the session until you add a set.</p>
            ) : (
              <ul>
                {exercise.sets.map((set, setIndex) => (
                  <li key={set.key}>
                    Set {setIndex + 1} · {setLine(exercise, set)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="btn ghost" onClick={onAdd}>
        Add exercise
      </button>

      <Field label="Title">
        <input value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="Lower body" maxLength={80} />
      </Field>
      <div className="form-grid two">
        <Field label="Goal">
          <select
            value={draft.goalId}
            onChange={(event) => {
              const goalId = event.target.value;
              setDraft((current) => ({
                ...current,
                goalId,
                planId: current.goalId === goalId ? current.planId : '',
                planSessionId: current.goalId === goalId ? current.planSessionId : '',
              }));
            }}
          >
            <option value="">None</option>
            {data.goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plan session this week">
          <select value={draft.planSessionId} onChange={(event) => onChoosePlan(event.target.value)}>
            <option value="">Not part of the plan</option>
            {choices
              .filter((choice) => !draft.goalId || choice.plan.goalId === draft.goalId)
              .map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
          </select>
        </Field>
      </div>
      {duplicate ? <p className="muted">This plan session already has a log this week. Saving adds another.</p> : null}
      <Field label="Notes">
        <textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} rows={3} maxLength={2000} placeholder="How it felt, what to change next time" />
      </Field>
      <StrengthWatchFields draft={draft} setDraft={setDraft} />
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-actions save-bar">
        <button type="submit" name="save-session" className="btn primary">
          Save session
        </button>
        <a className="btn ghost" href="#/today">
          Cancel
        </a>
        {existing && !confirmDelete ? (
          <button type="button" className="btn danger ghost" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        ) : null}
        {existing && confirmDelete ? (
          <span className="confirm">
            Delete this session?
            <button type="button" className="btn danger small" onClick={() => onDelete(existing.id)}>
              Delete
            </button>
            <button type="button" className="btn ghost small" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </span>
        ) : null}
      </div>
    </>
  );
}
