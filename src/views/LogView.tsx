import { useState } from 'react';
import type { FormEvent } from 'react';
import { Field } from '../components/Field';
import {
  COMMON_LIFTS,
  RUN_TITLES,
  applyTemplateMeta,
  blankExercise,
  blankSet,
  draftFromPreset,
  draftFromSession,
  exercisesFromTemplate,
  blankDraft,
  type Draft,
} from '../lib/draft';
import { isISODate, startOfWeek, todayISO } from '../lib/dates';
import { parseNum } from '../lib/format';
import { findPlanSession, logFromPreset, planChoices } from '../lib/plans';
import { cx } from '../lib/cx';
import { ExerciseDemo } from '../components/ExerciseDemo';
import { findDemo } from '../lib/demos';
import type { DraftRequest } from './draft-request';
import type { Session, TrainingData } from '../types';

export function LogView({
  data,
  sessionId,
  request,
  onSave,
  onDelete,
}: {
  data: TrainingData;
  sessionId?: string;
  request: DraftRequest;
  onSave: (session: Session) => void;
  onDelete: (id: string) => void;
}) {
  const existing = sessionId ? data.sessions.find((session) => session.id === sessionId) : undefined;
  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) {
      const base = draftFromSession(existing);
      const template = existing.planSessionId ? findPlanSession(data, existing.planSessionId, existing.date)?.session.exercises ?? [] : [];
      return applyTemplateMeta(base, template);
    }
    if (request.mode === 'preset') return draftFromPreset(request.preset, data.sessions);
    return blankDraft(todayISO());
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const draftId = existing?.id ?? `log-${request.token}`;

  if (sessionId && !existing) {
    return (
      <div className="stack page">
        <h1>Session not found</h1>
        <p className="muted">That entry is not in this browser’s log.</p>
        <a className="btn ghost" href="#/today">
          Back to today
        </a>
      </div>
    );
  }

  const choices = planChoices(data, draft.date || todayISO(), draft.planSessionId || null);
  const weekStart = isISODate(draft.date) ? startOfWeek(draft.date) : '';
  const duplicate = draft.planSessionId
    ? data.sessions.some((session) => {
        if (session.id === draftId || session.planSessionId !== draft.planSessionId) return false;
        return weekStart !== '' && startOfWeek(session.date) === weekStart;
      })
    : false;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function choosePlanSession(planSessionId: string) {
    if (!planSessionId) {
      setDraft((current) => ({ ...current, planSessionId: '', planId: '' }));
      return;
    }
    const choice = choices.find((item) => item.id === planSessionId);
    if (!choice) return;
    setDraft((current) => ({
      ...current,
      planSessionId,
      planId: choice.plan.id,
      goalId: choice.plan.goalId,
      kind: choice.session.kind,
      title: choice.session.title,
      exercises: choice.session.kind === 'strength' ? exercisesFromTemplate(choice.session.exercises, data.sessions) : current.exercises,
      prompt:
        choice.session.kind === 'run'
          ? `${choice.session.title} · ${choice.session.notes || 'doing the run is enough'}`
          : `${choice.session.title} · target is sets and reps`,
      distanceHint: choice.session.kind === 'run' ? 'Optional. Saving with this blank still counts as doing the run.' : '',
      durationHint: choice.session.kind === 'run' ? 'Optional. Saving still counts.' : '',
      durationMin: choice.session.kind === 'run' && choice.session.durationMin ? String(choice.session.durationMin) : current.durationMin,
    }));
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const session = toSession(draft, draftId, existing?.createdAt ?? new Date().toISOString());
    if (typeof session === 'string') {
      setError(session);
      return;
    }
    setError(null);
    onSave(session);
  }

  return (
    <form className="stack page" onSubmit={save} autoComplete="off">
      <header className="page-head">
        <p className="kicker">{existing ? 'Edit' : 'New entry'}</p>
        <h1>{existing ? draft.title || 'Session' : 'Log a session'}</h1>
      </header>
      {draft.prompt ? <p className="callout">{draft.prompt}</p> : null}
      {!existing && data.presets.length > 0 ? (
        <div className="stack">
          <p className="kicker">Start from a preset</p>
          <div className="chips" aria-label="Workout presets">
            {data.presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={cx('chip', draft.title === preset.name && draft.kind === preset.kind && 'on')}
                onClick={() => setDraft(draftFromPreset(logFromPreset(preset, data, draft.date || todayISO()), data.sessions))}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="seg" role="group" aria-label="Session type">
        <button type="button" className={cx(draft.kind === 'strength' && 'on')} onClick={() => update('kind', 'strength')}>
          Strength
        </button>
        <button type="button" className={cx(draft.kind === 'run' && 'on')} onClick={() => update('kind', 'run')}>
          Run
        </button>
      </div>

      <div className="form-grid two">
        <Field label="Date">
          <input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} required />
        </Field>
        <Field label="Title">
          <input
            value={draft.title}
            onChange={(event) => update('title', event.target.value)}
            placeholder={draft.kind === 'run' ? 'Easy run' : 'Lower body'}
            maxLength={80}
          />
        </Field>
      </div>

      {draft.kind === 'run' ? (
        <div className="chips">
          {RUN_TITLES.map((title) => (
            <button key={title} type="button" className={cx('chip', draft.title === title && 'on')} onClick={() => update('title', title)}>
              {title}
            </button>
          ))}
        </div>
      ) : null}

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
          <select value={draft.planSessionId} onChange={(event) => choosePlanSession(event.target.value)}>
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

      {draft.kind === 'strength' ? (
        <StrengthFields draft={draft} setDraft={setDraft} />
      ) : (
        <div className="stack">
          <p className="muted fine">Distance, time, and effort are optional. Saving the run is enough for the week.</p>
          <div className="form-grid two">
            <Field label="Distance (km)" hint={draft.distanceHint}>
              <input
                inputMode="decimal"
                value={draft.distanceKm}
                onChange={(event) => update('distanceKm', event.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Climb (m)">
              <input
                inputMode="decimal"
                value={draft.elevationM}
                onChange={(event) => update('elevationM', event.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>
          <div className="form-grid two">
            <Field label="Minutes" hint={draft.durationHint}>
              <input inputMode="numeric" value={draft.durationMin} onChange={(event) => update('durationMin', event.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Seconds">
              <input inputMode="numeric" value={draft.durationSec} onChange={(event) => update('durationSec', event.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <div className="field">
            <span>Effort, 1 easy to 10 max</span>
            <div className="effort" role="group" aria-label="Effort">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cx(draft.effort === value && 'on')}
                  onClick={() => update('effort', draft.effort === value ? null : value)}
                  aria-pressed={draft.effort === value}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Field label="Notes">
        <textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} rows={3} maxLength={2000} placeholder="How it felt, what to change next time" />
      </Field>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="form-actions save-bar">
        <button type="submit" className="btn primary">
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
    </form>
  );
}

function StrengthFields({ draft, setDraft }: { draft: Draft; setDraft: (value: Draft | ((current: Draft) => Draft)) => void }) {
  const [demoKey, setDemoKey] = useState<string | null>(null);

  function addLift(name: string) {
    setDraft((current) => {
      if (current.exercises.some((exercise) => exercise.name.trim().toLowerCase() === name.toLowerCase())) return current;
      const empty = current.exercises.length === 1 && current.exercises[0]?.name.trim() === '';
      if (empty && current.exercises[0]) {
        return { ...current, exercises: [{ ...current.exercises[0], name }] };
      }
      return { ...current, exercises: [...current.exercises, blankExercise(name)] };
    });
  }

  return (
    <div className="stack">
      <p className="muted fine">Load is optional. This week’s target is the sets and reps.</p>
      <div className="chips" aria-label="Common lifts">
        {COMMON_LIFTS.map((name) => (
          <button key={name} type="button" className="chip" onClick={() => addLift(name)}>
            {name}
          </button>
        ))}
      </div>
      {draft.exercises.map((exercise, exerciseIndex) => (
        <fieldset key={exercise.key} className="exercise">
          <legend className="sr-only">Exercise {exerciseIndex + 1}</legend>
          <div className="split">
            <input
              value={exercise.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  exercises: current.exercises.map((item) => (item.key === exercise.key ? { ...item, name: event.target.value } : item)),
                }))
              }
              placeholder="Exercise"
              aria-label="Exercise name"
            />
            <button
              type="button"
              className="btn ghost small"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  exercises: current.exercises.length === 1 ? [blankExercise()] : current.exercises.filter((item) => item.key !== exercise.key),
                }))
              }
            >
              Remove
            </button>
          </div>
          {exercise.targetLabel ? <p className="muted fine">Target {exercise.targetLabel}. Kilograms are not part of the target.</p> : null}
          {findDemo(exercise.name) ? (
            <button
              type="button"
              className="btn ghost small"
              aria-expanded={demoKey === exercise.key}
              onClick={() => setDemoKey(demoKey === exercise.key ? null : exercise.key)}
            >
              {demoKey === exercise.key ? 'Hide demo' : 'How to do this'}
            </button>
          ) : null}
          {demoKey === exercise.key ? <ExerciseDemo name={exercise.name} /> : null}
          <div className="set-head" aria-hidden="true">
            <span />
            <span>{exercise.count === 'seconds' ? 'Seconds' : 'Reps'}</span>
            <span>kg</span>
            <span />
          </div>
          {exercise.sets.map((set, setIndex) => (
            <div key={set.key} className="set-row">
              <span>{setIndex + 1}</span>
              <input
                inputMode="numeric"
                aria-label={`Set ${setIndex + 1} ${exercise.count === 'seconds' ? 'seconds' : 'reps'}`}
                value={set.reps}
                placeholder={exercise.count === 'seconds' ? 'Sec' : 'Reps'}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    exercises: current.exercises.map((item) =>
                      item.key === exercise.key
                        ? { ...item, sets: item.sets.map((entry) => (entry.key === set.key ? { ...entry, reps: event.target.value } : entry)) }
                        : item,
                    ),
                  }))
                }
              />
              <input
                inputMode="decimal"
                aria-label={`Set ${setIndex + 1} kilograms`}
                value={set.weightKg}
                placeholder="kg"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    exercises: current.exercises.map((item) =>
                      item.key === exercise.key
                        ? { ...item, sets: item.sets.map((entry) => (entry.key === set.key ? { ...entry, weightKg: event.target.value } : entry)) }
                        : item,
                    ),
                  }))
                }
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove set ${setIndex + 1}`}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    exercises: current.exercises.map((item) =>
                      item.key === exercise.key
                        ? { ...item, sets: item.sets.length === 1 ? [blankSet()] : item.sets.filter((entry) => entry.key !== set.key) }
                        : item,
                    ),
                  }))
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn ghost small"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                exercises: current.exercises.map((item) => {
                  if (item.key !== exercise.key) return item;
                  const previous = item.sets.at(-1);
                  return { ...item, sets: [...item.sets, blankSet(previous?.reps || '5')] };
                }),
              }))
            }
          >
            Add set
          </button>
        </fieldset>
      ))}
      <button type="button" className="btn ghost" onClick={() => setDraft((current) => ({ ...current, exercises: [...current.exercises, blankExercise()] }))}>
        Add exercise
      </button>
    </div>
  );
}

function toSession(draft: Draft, id: string, createdAt: string): Session | string {
  if (!isISODate(draft.date)) return 'Pick a date.';
  const link = {
    goalId: draft.goalId || null,
    planId: draft.planId || null,
    planSessionId: draft.planSessionId || null,
  };
  if (draft.kind === 'strength') {
    const exercises: Session['exercises'] = [];
    for (const exercise of draft.exercises) {
      const name = exercise.name.trim();
      if (!name) continue;
      const sets: Session['exercises'][number]['sets'] = [];
      for (const set of exercise.sets) {
        const reps = parseNum(set.reps);
        if (reps === null || reps <= 0) continue;
        const weight = parseNum(set.weightKg);
        sets.push({ reps: Math.round(reps), weightKg: weight === null ? 0 : Math.max(0, Math.round(weight * 10) / 10) });
      }
      if (sets.length === 0) return `Add ${exercise.count === 'seconds' ? 'seconds' : 'reps'} for ${name}.`;
      exercises.push({ name, sets });
    }
    if (exercises.length === 0) return 'Add at least one exercise.';
    return {
      id,
      date: draft.date,
      kind: 'strength',
      title: draft.title.trim() || exercises[0]?.name || 'Strength',
      notes: draft.notes.trim(),
      ...link,
      exercises,
      distanceKm: null,
      durationSec: null,
      elevationM: null,
      effort: null,
      createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  const distance = parseNum(draft.distanceKm);
  const minutes = parseNum(draft.durationMin);
  const seconds = parseNum(draft.durationSec);
  if ((minutes !== null && minutes < 0) || (seconds !== null && seconds < 0) || (distance !== null && distance < 0)) {
    return 'Distance and time can’t be negative.';
  }
  const durationSec = Math.round((minutes ?? 0) * 60 + (seconds ?? 0));
  const elevation = parseNum(draft.elevationM);
  return {
    id,
    date: draft.date,
    kind: 'run',
    title: draft.title.trim() || 'Run',
    notes: draft.notes.trim(),
    ...link,
    exercises: [],
    distanceKm: distance !== null && distance > 0 ? Math.round(distance * 100) / 100 : null,
    durationSec: durationSec > 0 ? durationSec : null,
    elevationM: elevation === null ? null : Math.max(0, elevation),
    effort: draft.effort,
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}
