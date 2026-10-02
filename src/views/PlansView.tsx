import { useState } from 'react';
import type { FormEvent } from 'react';
import { Field } from '../components/Field';
import { FocusField } from '../components/FocusField';
import { formatCountdown, formatLong, todayISO } from '../lib/dates';
import { cx } from '../lib/cx';
import { uid } from '../lib/ids';
import { removeGoal, removePlan } from '../lib/storage';
import { skiBaseSessions } from '../lib/templates';
import { PlanEditor } from './PlanEditor';
import type { Goal, GoalStatus, LogPreset, Plan, TrainingData } from '../types';

export function PlansView({
  data,
  goalId,
  update,
  onLog,
}: {
  data: TrainingData;
  goalId?: string;
  update: (recipe: (current: TrainingData) => TrainingData) => void;
  onLog: (preset: LogPreset) => void;
}) {
  const [creating, setCreating] = useState(data.goals.length === 0);
  const goal = data.goals.find((item) => item.id === goalId) ?? null;

  function saveGoal(next: Goal, isNew: boolean) {
    update((current) => ({
      ...current,
      goals: isNew ? [...current.goals, next] : current.goals.map((item) => (item.id === next.id ? next : item)),
    }));
    setCreating(false);
    window.location.hash = `#/plans/${next.id}`;
  }

  return (
    <div className={cx('plans-layout', goal && 'has-goal')}>
      <div className="goal-list stack">
        <div className="split">
          {goal ? <h2>Plans</h2> : <h1>Plans</h1>}
          <button type="button" className="btn primary small" onClick={() => setCreating(true)}>
            New goal
          </button>
        </div>
        <p className="muted">A goal is the date you are training for. A plan is the week you repeat. Strength targets are sets and reps. A run counts when you do it.</p>
        {creating ? (
          <GoalForm
            initial={null}
            onCancel={() => setCreating(false)}
            onSave={(next) => saveGoal(next, true)}
          />
        ) : null}
        {data.goals.length === 0 && !creating ? <p className="muted">No goals yet.</p> : null}
        <ul className="goal-links">
          {data.goals.map((item) => (
            <li key={item.id}>
              <a className={cx('goal-link', item.id === goal?.id && 'on')} href={`#/plans/${item.id}`}>
                <strong>{item.name}</strong>
                <span>
                  {item.status}
                  {item.targetDate ? ` · ${formatLong(item.targetDate)}` : ''}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="goal-detail stack">
        {goal ? (
          <GoalDetail
            key={goal.id}
            data={data}
            goal={goal}
            update={update}
            onLog={onLog}
            onSave={(next) => saveGoal(next, false)}
          />
        ) : (
          <p className="muted only-wide">Select a goal to see its week, or create one.</p>
        )}
        {goalId && !goal ? (
          <div className="card stack">
            <h2>That goal is gone</h2>
            <a className="btn ghost" href="#/plans">
              All goals
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GoalDetail({
  data,
  goal,
  update,
  onLog,
  onSave,
}: {
  data: TrainingData;
  goal: Goal;
  update: (recipe: (current: TrainingData) => TrainingData) => void;
  onLog: (preset: LogPreset) => void;
  onSave: (goal: Goal) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addingPlan, setAddingPlan] = useState(goal && data.plans.every((plan) => plan.goalId !== goal.id));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const plans = data.plans.filter((plan) => plan.goalId === goal.id);
  const today = todayISO();

  function savePlan(next: Plan) {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    update((current) => ({
      ...current,
      plans: current.plans.some((plan) => plan.id === stamped.id)
        ? current.plans.map((plan) => (plan.id === stamped.id ? stamped : plan))
        : [...current.plans, stamped],
    }));
  }

  function deletePlan(id: string) {
    update((current) => removePlan(current, id));
  }

  function deleteGoal() {
    update((current) => removeGoal(current, goal.id));
    window.location.hash = '#/plans';
  }

  return (
    <div className="stack">
      <a className="text-link only-mobile" href="#/plans">
        All goals
      </a>
      <header className="page-head">
        <p className="kicker">{goal.status === 'active' ? 'Goal' : goal.status}</p>
        <div className="split">
          <h1>{goal.name}</h1>
          <button type="button" className="btn ghost small" onClick={() => setEditing((open) => !open)}>
            {editing ? 'Close' : 'Edit'}
          </button>
        </div>
        <p className="lead">
          {goal.targetDate ? `${formatLong(goal.targetDate)} · ${formatCountdown(today, goal.targetDate)}` : 'No target date yet'}
        </p>
      </header>
      {goal.focus.length > 0 ? (
        <div className="tags">
          {goal.focus.map((tag) => (
            <span key={tag} className="tag light">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {goal.notes && !editing ? <p>{goal.notes}</p> : null}
      {editing ? (
        <GoalForm
          initial={goal}
          onCancel={() => setEditing(false)}
          onSave={(next) => {
            onSave(next);
            setEditing(false);
          }}
          onDelete={deleteGoal}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
        />
      ) : null}

      {plans.map((plan) => (
        <PlanEditor key={plan.id} data={data} plan={plan} onChange={savePlan} onDelete={() => deletePlan(plan.id)} onLog={onLog} />
      ))}

      {addingPlan ? (
        <NewPlanForm
          goal={goal}
          onCancel={() => setAddingPlan(false)}
          onSave={(plan) => {
            savePlan(plan);
            setAddingPlan(false);
          }}
        />
      ) : (
        <button type="button" className="btn primary" onClick={() => setAddingPlan(true)}>
          Add a plan
        </button>
      )}
    </div>
  );
}

function GoalForm({
  initial,
  onSave,
  onCancel,
  onDelete,
  confirmDelete,
  setConfirmDelete,
}: {
  initial: Goal | null;
  onSave: (goal: Goal) => void;
  onCancel: () => void;
  onDelete?: () => void;
  confirmDelete?: boolean;
  setConfirmDelete?: (value: boolean) => void;
}) {
  const [focus, setFocus] = useState<string[]>(initial?.focus ?? ['Legs', 'Balance', 'Cardio']);
  const [error, setError] = useState<string | null>(null);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const targetDate = String(form.get('targetDate') ?? '');
    if (!name) {
      setError('Name the goal.');
      return;
    }
    const statusValue = String(form.get('status') ?? initial?.status ?? 'active');
    const status: GoalStatus = statusValue === 'paused' || statusValue === 'done' ? statusValue : 'active';
    onSave({
      id: initial?.id ?? uid('goal'),
      name,
      targetDate,
      focus,
      notes: String(form.get('notes') ?? '').trim(),
      status,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h2>{initial ? 'Edit goal' : 'New goal'}</h2>
      <Field label="Name">
        <input name="name" defaultValue={initial?.name ?? ''} placeholder="Ski season prep" required />
      </Field>
      <div className="form-grid two">
        <Field label="Target date">
          <input name="targetDate" type="date" defaultValue={initial?.targetDate ?? '2026-12-19'} />
        </Field>
        {initial ? (
          <Field label="Status">
            <select name="status" defaultValue={initial.status}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="done">Done</option>
            </select>
          </Field>
        ) : null}
      </div>
      <FocusField value={focus} onChange={setFocus} />
      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ''} placeholder="What ready looks like" />
      </Field>
      {error ? <p className="error">{error}</p> : null}
      <div className="form-actions">
        <button type="submit" className="btn primary">
          {initial ? 'Save goal' : 'Create goal'}
        </button>
        {initial || onCancel ? (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        {onDelete && !confirmDelete ? (
          <button type="button" className="btn danger ghost" onClick={() => setConfirmDelete?.(true)}>
            Delete goal
          </button>
        ) : null}
        {onDelete && confirmDelete ? (
          <span className="confirm">
            Delete this goal and its plans? Logged workouts stay.
            <button type="button" className="btn danger small" onClick={onDelete}>
              Delete
            </button>
            <button type="button" className="btn ghost small" onClick={() => setConfirmDelete?.(false)}>
              Keep
            </button>
          </span>
        ) : null}
      </div>
    </form>
  );
}

function NewPlanForm({ goal, onSave, onCancel }: { goal: Goal; onSave: (plan: Plan) => void; onCancel: () => void }) {
  const [focus, setFocus] = useState<string[]>(goal.focus);
  const [template, setTemplate] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const startDate = String(form.get('startDate') ?? '');
    const weeks = Number(form.get('weeks'));
    if (!name || !startDate || !Number.isFinite(weeks) || weeks < 1) {
      setError('Name, start date, and a number of weeks are required.');
      return;
    }
    onSave({
      id: uid('plan'),
      goalId: goal.id,
      name,
      startDate,
      weeks: Math.min(104, Math.round(weeks)),
      focus,
      notes: String(form.get('notes') ?? '').trim(),
      sessions: template ? skiBaseSessions() : [],
      status: 'active',
    });
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h2>New plan</h2>
      <Field label="Name">
        <input name="name" defaultValue="Pre-season base" required />
      </Field>
      <div className="form-grid two">
        <Field label="Starts">
          <input name="startDate" type="date" defaultValue={todayISO()} required />
        </Field>
        <Field label="Weeks">
          <input name="weeks" type="number" min={1} max={104} defaultValue={12} required />
        </Field>
      </div>
      <FocusField value={focus} onChange={setFocus} />
      <label className="check">
        <input type="checkbox" checked={template} onChange={(event) => setTemplate(event.target.checked)} />
        <span>Start with a ski-base week: legs, balance, and cardio</span>
      </label>
      <Field label="Notes">
        <textarea name="notes" rows={2} placeholder="How this block should feel" />
      </Field>
      {error ? <p className="error">{error}</p> : null}
      <div className="form-actions">
        <button type="submit" className="btn primary">
          Create plan
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
