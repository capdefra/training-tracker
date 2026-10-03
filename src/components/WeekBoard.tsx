import { useState, type ReactNode } from 'react';
import { buildPreset, planItemsForWeek, weekSentence, type PlanItem } from '../lib/plans';
import { addDays, formatDayMonth, formatPretty, formatWeekday, startOfWeek, todayISO } from '../lib/dates';
import { cx } from '../lib/cx';
import { runPrescription } from '../lib/targets';
import type { LogPreset, Plan, PlanPhase, TrainingData } from '../types';

export function WeekBoard({
  data,
  plans,
  onLog,
  variant = 'full',
  heading = 'h2',
  actions,
  anchor: anchorProp,
  onAnchor,
}: {
  data: TrainingData;
  plans: Plan[];
  onLog: (preset: LogPreset) => void;
  variant?: 'full' | 'list';
  heading?: 'h2' | 'h3';
  actions?: ReactNode;
  anchor?: string;
  onAnchor?: (date: string) => void;
}) {
  const today = todayISO();
  const [internal, setInternal] = useState(today);
  const anchor = anchorProp ?? internal;
  const monday = startOfWeek(anchor);
  const thisMonday = startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const items = planItemsForWeek(data, plans, anchor);
  const showPlan = new Set(items.map((item) => item.plan.id)).size > 1;
  const totals = weekTotals(items);
  const label = monday === thisMonday ? 'This week' : `Week of ${formatDayMonth(monday)}`;
  const phases = phaseSummary(items);
  const Title = heading;

  function move(date: string) {
    if (!anchorProp) setInternal(date);
    onAnchor?.(date);
  }

  return (
    <section className="stack">
      <div className="split">
        <Title>{label}</Title>
        {actions}
      </div>
      <div className="quick week-nav">
        <button type="button" className="btn ghost" onClick={() => move(addDays(monday, -7))}>
          Previous
        </button>
        {monday !== thisMonday ? (
          <button type="button" className="btn ghost" onClick={() => move(today)}>
            This week
          </button>
        ) : null}
        <button type="button" className="btn ghost" onClick={() => move(addDays(monday, 7))}>
          Next
        </button>
      </div>
      {phases ? <p className="muted">{phases}</p> : null}
      <p className="lead">{weekSentence(items, today)}</p>
      {items.length > 0 ? (
        <div className="stats week-stats">
          <div className="stat">
            <span>Sets</span>
            <strong>
              {totals.setDone}/{totals.setTarget}
            </strong>
          </div>
          <div className="stat">
            <span>Runs</span>
            <strong>
              {totals.runDone}/{totals.runTarget}
            </strong>
          </div>
        </div>
      ) : null}
      {variant === 'full' ? (
        <div className="week" aria-label="This week">
          {days.map((date) => {
            const logged = loggedOnDate(data, date);
            const planned = items.some((item) => item.date === date);
            const done = logged.length > 0;
            return (
              <div key={date} className={cx('day', date === today && 'today', done && 'done', planned && !done && 'planned')}>
                <span>{formatWeekday(date)}</span>
                <strong>{Number(date.slice(8))}</strong>
                <i className="mark" />
              </div>
            );
          })}
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="muted">No sessions on the active plan this week.</p>
      ) : (
        <ul className="checklist">
          {items.map((item) => (
            <li key={`${item.plan.id}-${item.session.id}-${item.date}`} className={cx('check-item', item.done && 'done')}>
              <div className="check-main">
                <p className="kicker">
                  {formatPretty(item.date)}
                  {item.session.focus ? ` · ${item.session.focus}` : ''}
                  {showPlan ? ` · ${item.plan.name}` : ''}
                </p>
                <h3>{item.session.title}</h3>
                {item.session.kind === 'run' ? (
                  <p className="muted">{item.done ? `Run done · ${runPrescription(item.session)}` : runPrescription(item.session)}</p>
                ) : (
                  <ul className="targets">
                    {item.targets.map((target) => {
                      const width = target.targetSets > 0 ? Math.min(100, (target.completedSets / target.targetSets) * 100) : 0;
                      return (
                        <li key={target.name}>
                          <span className="target-name">{target.name}</span>
                          <span className="target-count">
                            {target.completedSets}/{target.targetSets} × {target.repsLabel}
                          </span>
                          <span className="target-bar" aria-hidden="true">
                            <i style={{ width: `${width}%` }} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="check-actions">
                {item.logs.length > 0 && !item.done ? <span className="badge mid">In progress</span> : null}
                {item.date < today && item.logs.length === 0 && !item.done ? <span className="badge warn">Catch up</span> : null}
                {item.done ? <span className="badge good">Done</span> : null}
                {item.done && item.logged ? (
                  <a className="btn ghost small" href={`#/log/${item.logged.id}`}>
                    View
                  </a>
                ) : item.logged ? (
                  <a className="btn primary small" href={`#/log/${item.logged.id}`}>
                    Continue
                  </a>
                ) : (
                  <button type="button" className="btn primary small" onClick={() => onLog(buildPreset(item.plan, item.session, item.date, today))}>
                    Log
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function phaseSummary(items: PlanItem[]): string {
  const seen = new Set<string>();
  const phases: PlanPhase[] = [];
  for (const item of items) {
    if (!item.phase || seen.has(item.phase.startDate + item.phase.name)) continue;
    seen.add(item.phase.startDate + item.phase.name);
    phases.push(item.phase);
  }
  return phases.map((phase) => `${phase.name}, ${formatDayMonth(phase.startDate)} – ${formatDayMonth(phase.endDate)}`).join(' · ');
}

function weekTotals(items: PlanItem[]) {
  let setDone = 0;
  let setTarget = 0;
  let runDone = 0;
  let runTarget = 0;
  for (const item of items) {
    if (item.session.kind === 'run') {
      runTarget += 1;
      if (item.done) runDone += 1;
    } else {
      for (const target of item.targets) {
        setTarget += target.targetSets;
        setDone += Math.min(target.completedSets, target.targetSets);
      }
    }
  }
  return { setDone, setTarget, runDone, runTarget };
}

function loggedOnDate(data: TrainingData, date: string) {
  return data.sessions.filter((session) => session.date === date);
}
