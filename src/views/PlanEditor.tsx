import { useState } from 'react';
import type { FormEvent } from 'react';
import { Field } from '../components/Field';
import { FocusField } from '../components/FocusField';
import { WeekBoard } from '../components/WeekBoard';
import { DAY_OPTIONS, addDays, formatDayMonth, formatLong, startOfWeek, todayISO, weekdayLabel } from '../lib/dates';
import { uid } from '../lib/ids';
import { cx } from '../lib/cx';
import { describePhase, planLastDay } from '../lib/plans';
import { describePlanSession } from '../lib/targets';
import type { LogPreset, Plan, PlanExercise, PlanSession, SessionKind, TrainingData } from '../types';

export function PlanEditor({
  data,
  plan,
  onChange,
  onDelete,
  onLog,
}: {
  data: TrainingData;
  plan: Plan;
  onChange: (plan: Plan) => void;
  onDelete: () => void;
  onLog: (preset: LogPreset) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [anchor, setAnchor] = useState(todayISO());
  const end = planLastDay(plan);
  const ordered = [...plan.sessions].sort((a, b) => rankDay(a.dayOfWeek) - rankDay(b.dayOfWeek));
  const viewedMonday = startOfWeek(anchor);
  const viewedSunday = addDays(viewedMonday, 6);

  function saveMeta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const startDate = String(form.get('startDate') ?? '');
    const weeks = Number(form.get('weeks'));
    if (!name || !startDate || !Number.isFinite(weeks) || weeks < 1) return;
    const nextWeeks = Math.min(104, Math.round(weeks));
    const spanChanged = startDate !== plan.startDate || nextWeeks !== plan.weeks;
    onChange({
      ...plan,
      name,
      startDate,
      weeks: nextWeeks,
      endDate: spanChanged ? undefined : plan.endDate,
      notes: String(form.get('notes') ?? '').trim(),
      status: String(form.get('status') ?? 'active') === 'paused' || String(form.get('status')) === 'done' ? (String(form.get('status')) as Plan['status']) : 'active',
    });
    setEditing(false);
  }

  return (
    <article className="card stack">
      <div className="split">
        <div>
          <p className="kicker">{plan.status}</p>
          <h3>{plan.name}</h3>
          <p className="muted">
            {plan.startDate ? formatLong(plan.startDate) : 'No start'}
            {end ? ` – ${formatLong(end)}` : ''} · {plan.weeks} weeks
          </p>
        </div>
        <button type="button" className="btn ghost small" onClick={() => setEditing((open) => !open)}>
          {editing ? 'Close' : 'Edit plan'}
        </button>
      </div>
      {plan.focus.length > 0 ? (
        <div className="tags">
          {plan.focus.map((tag) => (
            <span key={tag} className="tag light">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {plan.notes ? <p>{plan.notes}</p> : null}

      {editing ? (
        <form className="stack" onSubmit={saveMeta}>
          <Field label="Name">
            <input name="name" defaultValue={plan.name} required />
          </Field>
          <div className="form-grid two">
            <Field label="Starts">
              <input name="startDate" type="date" defaultValue={plan.startDate} required />
            </Field>
            <Field label="Weeks">
              <input name="weeks" type="number" min={1} max={104} defaultValue={plan.weeks} required />
            </Field>
          </div>
          <Field label="Status">
            <select name="status" defaultValue={plan.status}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="done">Done</option>
            </select>
          </Field>
          <FocusField value={plan.focus} onChange={(focus) => onChange({ ...plan, focus })} />
          <Field label="Notes">
            <textarea name="notes" rows={3} defaultValue={plan.notes} />
          </Field>
          <div className="form-actions">
            <button type="submit" className="btn primary small">
              Save plan
            </button>
            {!confirmDelete ? (
              <button type="button" className="btn danger ghost small" onClick={() => setConfirmDelete(true)}>
                Delete plan
              </button>
            ) : (
              <span className="confirm">
                Delete this plan? Logged workouts stay.
                <button type="button" className="btn danger small" onClick={onDelete}>
                  Delete
                </button>
                <button type="button" className="btn ghost small" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </span>
            )}
          </div>
        </form>
      ) : null}

      <WeekBoard data={data} plans={[plan]} onLog={onLog} heading="h3" anchor={anchor} onAnchor={setAnchor} />

      {plan.phases && plan.phases.length > 0 ? (
        <div className="stack">
          <h4>Phases</h4>
          <p className="muted">The week repeats. A phase replaces the run, or the sets, on those dates.</p>
          <ul className="template">
            {plan.phases.map((phase) => {
              const on = phase.endDate >= viewedMonday && phase.startDate <= viewedSunday;
              return (
                <li key={`${phase.startDate}-${phase.name}`}>
                  <button type="button" className={cx('phase-jump', on && 'on')} onClick={() => setAnchor(phase.startDate)}>
                    <p className="kicker">
                      {formatDayMonth(phase.startDate)} – {formatDayMonth(phase.endDate)}
                    </p>
                    <strong>{phase.name}</strong>
                    <p className="muted">{describePhase(plan, phase)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="stack">
        <div className="split">
          <h4>Repeating week</h4>
          <button type="button" className="btn ghost small" onClick={() => { setAdding((open) => !open); setEditingId(null); }}>
            {adding ? 'Close' : 'Add session'}
          </button>
        </div>
        {ordered.length === 0 ? <p className="muted">No sessions in this week yet.</p> : null}
        <ul className="template">
          {ordered.map((session) => (
            <li key={session.id}>
              <div className="split">
                <div>
                  <p className="kicker">
                    {weekdayLabel(session.dayOfWeek, 'long')} · {session.kind === 'run' ? 'Run' : 'Strength'}
                    {session.focus ? ` · ${session.focus}` : ''}
                  </p>
                  <strong>{session.title}</strong>
                  <p className="muted">{describeSession(session)}</p>
                </div>
                <button type="button" className="btn ghost small" onClick={() => { setEditingId(editingId === session.id ? null : session.id); setAdding(false); }}>
                  {editingId === session.id ? 'Close' : 'Edit'}
                </button>
              </div>
              {editingId === session.id ? (
                <TemplateForm
                  initial={session}
                  onCancel={() => setEditingId(null)}
                  onSave={(next) => {
                    onChange({ ...plan, sessions: plan.sessions.map((item) => (item.id === session.id ? next : item)) });
                    setEditingId(null);
                  }}
                  onDelete={() => {
                    const moves = plan.moves?.filter((move) => move.sessionId !== session.id);
                    onChange({
                      ...plan,
                      sessions: plan.sessions.filter((item) => item.id !== session.id),
                      phases: plan.phases
                        ?.map((phase) => ({
                          ...phase,
                          sessions: phase.sessions.filter((change) => change.sessionId !== session.id),
                        }))
                        .filter((phase) => phase.sessions.length > 0),
                      moves: moves && moves.length > 0 ? moves : undefined,
                    });
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
        {adding ? (
          <TemplateForm
            initial={null}
            onCancel={() => setAdding(false)}
            onSave={(next) => {
              onChange({ ...plan, sessions: [...plan.sessions, next] });
              setAdding(false);
            }}
          />
        ) : null}
      </div>
    </article>
  );
}

function rankDay(day: number): number {
  return day === 0 ? 7 : day;
}

function describeSession(session: PlanSession): string {
  return describePlanSession(session);
}

function TemplateForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: PlanSession | null;
  onSave: (session: PlanSession) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [kind, setKind] = useState<SessionKind>(initial?.kind ?? 'strength');
  const [exercises, setExercises] = useState<PlanExercise[]>(initial?.exercises ?? [{ name: '', sets: 3, reps: '8', count: 'reps' }]);
  const [error, setError] = useState<string | null>(null);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    if (!title) {
      setError('Name the session.');
      return;
    }
    const cleaned = exercises
      .map((exercise) => {
        const next: PlanExercise = {
          name: exercise.name.trim(),
          sets: Math.max(1, Math.round(exercise.sets || 1)),
          reps: exercise.reps.trim() || '5',
        };
        if (exercise.count === 'seconds') next.count = 'seconds';
        return next;
      })
      .filter((exercise) => exercise.name);
    if (kind === 'strength' && cleaned.length === 0) {
      setError('Add at least one exercise, or switch this to a run.');
      return;
    }
    onSave({
      id: initial?.id ?? uid('ps'),
      dayOfWeek: Number(form.get('dayOfWeek')),
      kind,
      title,
      focus: String(form.get('focus') ?? '').trim(),
      notes: String(form.get('notes') ?? '').trim(),
      exercises: kind === 'strength' ? cleaned : [],
      distanceKm: initial?.distanceKm ?? null,
      durationMin: initial?.durationMin ?? null,
    });
  }

  return (
    <form className="stack inset" onSubmit={save}>
      <div className="form-grid two">
        <Field label="Day">
          <select name="dayOfWeek" defaultValue={initial?.dayOfWeek ?? 1}>
            {DAY_OPTIONS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input name="title" defaultValue={initial?.title ?? ''} required />
        </Field>
      </div>
      <div className="seg" role="group" aria-label="Template type">
        <button type="button" className={cx(kind === 'strength' && 'on')} onClick={() => setKind('strength')}>
          Strength
        </button>
        <button type="button" className={cx(kind === 'run' && 'on')} onClick={() => setKind('run')}>
          Run
        </button>
      </div>
      <div className="form-grid two">
        <Field label="Focus">
          <input name="focus" defaultValue={initial?.focus ?? ''} placeholder="Legs" />
        </Field>
        <Field label="Notes">
          <input name="notes" defaultValue={initial?.notes ?? ''} />
        </Field>
      </div>
      {kind === 'strength' ? (
        <div className="stack">
          <p className="muted fine">Targets are sets and reps, or seconds for a hold. Load is not a target.</p>
          {exercises.map((exercise, index) => (
            <div key={`${initial?.id ?? 'new'}-${index}`} className="set-row template-row">
              <input
                className="t-name"
                aria-label="Exercise"
                value={exercise.name}
                placeholder="Exercise"
                onChange={(event) => setExercises((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)))}
              />
              <input
                className="t-sets"
                aria-label="Sets"
                inputMode="numeric"
                value={exercise.sets}
                onChange={(event) => setExercises((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, sets: Number(event.target.value) } : item)))}
              />
              <input
                className="t-reps"
                aria-label={exercise.count === 'seconds' ? 'Seconds' : 'Reps'}
                value={exercise.reps}
                onChange={(event) => setExercises((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, reps: event.target.value } : item)))}
              />
              <select
                className="t-unit"
                aria-label="Count"
                value={exercise.count ?? 'reps'}
                onChange={(event) => {
                  const count = event.target.value === 'seconds' ? 'seconds' : 'reps';
                  setExercises((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, count } : item)));
                }}
              >
                <option value="reps">reps</option>
                <option value="seconds">sec</option>
              </select>
              <button type="button" className="icon-btn t-remove" aria-label="Remove exercise" onClick={() => setExercises((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={() => setExercises((current) => [...current, { name: '', sets: 3, reps: '8', count: 'reps' }])}>
            Add exercise
          </button>
        </div>
      ) : (
        <p className="muted">A run is done when it is logged. There is no pace or distance target.</p>
      )}
      {error ? <p className="error">{error}</p> : null}
      <div className="form-actions">
        <button type="submit" className="btn primary small">
          {initial ? 'Update session' : 'Add to week'}
        </button>
        <button type="button" className="btn ghost small" onClick={onCancel}>
          Cancel
        </button>
        {onDelete ? (
          <button type="button" className="btn danger ghost small" onClick={onDelete}>
            Remove
          </button>
        ) : null}
      </div>
    </form>
  );
}
