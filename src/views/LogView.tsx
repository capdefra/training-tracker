import { useState } from 'react';
import type { FormEvent } from 'react';
import { Field } from '../components/Field';
import { StrengthGuide } from '../components/StrengthGuide';
import {
  RUN_TITLES,
  applyTemplateMeta,
  draftFromPreset,
  draftFromSession,
  exercisesFromTemplate,
  exercisesToSession,
  blankDraft,
  type Draft,
} from '../lib/draft';
import { isISODate, startOfWeek, todayISO } from '../lib/dates';
import { formatDuration, parseNum } from '../lib/format';
import { hasDisplayedMetrics, readWatch } from '../lib/watch';
import { RunWatchFields } from '../components/WatchFields';
import { WatchSummary } from '../components/WatchSummary';
import { findPlanSession, logFromPreset, planChoices } from '../lib/plans';
import { cx } from '../lib/cx';
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
  const [guideNonce, setGuideNonce] = useState(0);
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
  const shown = existing ? previewSession(existing, draft) : null;
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
      exercises:
        choice.session.kind === 'strength' && current.exercises.every((exercise) => exercise.sets.length === 0)
          ? exercisesFromTemplate(choice.session.exercises, data.sessions)
          : current.exercises,
      prompt:
        choice.session.kind === 'run'
          ? `${choice.session.title} · ${choice.session.notes || 'doing the run is enough'}`
          : `${choice.session.title} · target is sets and reps`,
      distanceHint: choice.session.kind === 'run' ? 'Optional. Saving with this blank still counts as doing the run.' : '',
      durationHint: choice.session.kind === 'run' ? 'Optional. Saving still counts.' : '',
      duration: choice.session.kind === 'run' && choice.session.durationMin ? minutesClock(choice.session.durationMin) : current.duration,
    }));
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (draft.kind === 'strength') {
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      if (!(submitter instanceof HTMLElement) || submitter.getAttribute('name') !== 'save-session') return;
    }
    const session = toSession(draft, draftId, existing?.createdAt ?? new Date().toISOString());
    if (typeof session === 'string') {
      setError(session);
      return;
    }
    setError(null);
    onSave(session);
  }

  if (draft.kind === 'strength') {
    return (
      <form className="stack page" onSubmit={save} autoComplete="off">
        <StrengthGuide
          key={guideNonce}
          draft={draft}
          setDraft={setDraft}
          data={data}
          choices={choices}
          duplicate={duplicate}
          error={error}
          existing={existing}
          allowKindChange={!existing && request.mode !== 'preset'}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          onDelete={onDelete}
          onChoosePlan={choosePlanSession}
          onKind={(kind) => update('kind', kind)}
          onPreset={(presetId) => {
            const preset = data.presets.find((item) => item.id === presetId);
            if (!preset) return;
            setGuideNonce((nonce) => nonce + 1);
            setDraft(draftFromPreset(logFromPreset(preset, data, draft.date || todayISO()), data.sessions));
          }}
        />
      </form>
    );
  }

  return (
    <form className="stack page" onSubmit={save} autoComplete="off">
      <header className="page-head">
        <p className="kicker">{existing ? 'Edit' : 'New entry'}</p>
        <h1>{existing ? draft.title || 'Session' : 'Log a session'}</h1>
      </header>
      {existing && shown ? <WatchSummary session={shown} /> : null}
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
        <button type="button" onClick={() => update('kind', 'strength')}>
          Strength
        </button>
        <button type="button" className="on" onClick={() => update('kind', 'run')}>
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

      <RunWatchFields draft={draft} setDraft={setDraft} />

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

function minutesClock(minutes: number): string {
  return formatDuration(Math.round(minutes * 60));
}

function previewSession(existing: Session, draft: Draft): Session | null {
  const watch = readWatch(draft, draft.kind === 'run');
  const session =
    typeof watch === 'string'
      ? existing
      : {
          ...existing,
          title: draft.title.trim() || existing.title,
          date: isISODate(draft.date) ? draft.date : existing.date,
          ...metricsFromWatch(watch, draft.kind === 'run', draft.kind === 'run' ? parseNum(draft.distanceKm) : null),
        };
  return hasDisplayedMetrics(session) ? session : null;
}

function toSession(draft: Draft, id: string, createdAt: string): Session | string {
  if (!isISODate(draft.date)) return 'Pick a date.';
  const link = {
    goalId: draft.goalId || null,
    planId: draft.planId || null,
    planSessionId: draft.planSessionId || null,
  };
  if (draft.kind === 'strength') {
    const exercises = exercisesToSession(draft.exercises);
    if (typeof exercises === 'string') return exercises;
    const watch = readWatch(draft, false);
    if (typeof watch === 'string') return watch;
    return {
      id,
      date: draft.date,
      kind: 'strength',
      title: draft.title.trim() || exercises[0]?.name || 'Strength',
      notes: draft.notes.trim(),
      ...link,
      exercises,
      ...metricsFromWatch(watch, false, null),
      createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  const distance = parseNum(draft.distanceKm);
  if (draft.distanceKm.trim() && distance === null) return 'Distance needs to be a number.';
  if (distance !== null && distance < 0) return 'Distance can’t be negative.';
  const watch = readWatch(draft, true);
  if (typeof watch === 'string') return watch;
  return {
    id,
    date: draft.date,
    kind: 'run',
    title: draft.title.trim() || 'Run',
    notes: draft.notes.trim(),
    ...link,
    exercises: [],
    ...metricsFromWatch(watch, true, distance),
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function metricsFromWatch(watch: Exclude<ReturnType<typeof readWatch>, string>, run: boolean, distance: number | null) {
  return {
    distanceKm: run && distance !== null && distance > 0 ? Math.round(distance * 100) / 100 : null,
    durationSec: watch.durationSec,
    elevationM: run ? watch.elevationM : null,
    effort: watch.effort,
    paceSec: run ? watch.paceSec : null,
    heartRate: watch.heartRate,
    activeKcal: watch.activeKcal,
    totalKcal: watch.totalKcal,
    cadenceSpm: run ? watch.cadenceSpm : null,
    powerW: run ? watch.powerW : null,
    place: watch.place,
    source: watch.source,
    activity: watch.activity,
    startTime: watch.startTime,
    endTime: watch.endTime,
    weather: watch.weather,
    splits: run ? watch.splits : [],
  };
}
