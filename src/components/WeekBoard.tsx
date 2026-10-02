import { buildPreset, planItemsForWeek, weekSentence, type PlanItem } from '../lib/plans';
import { addDays, formatPretty, formatWeekday, startOfWeek, todayISO } from '../lib/dates';
import { cx } from '../lib/cx';
import type { LogPreset, Plan, TrainingData } from '../types';

export function WeekBoard({
  data,
  plans,
  onLog,
  variant = 'full',
}: {
  data: TrainingData;
  plans: Plan[];
  onLog: (preset: LogPreset) => void;
  variant?: 'full' | 'list';
}) {
  const today = todayISO();
  const monday = startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const items = planItemsForWeek(data, plans, today);
  const showPlan = new Set(items.map((item) => item.plan.id)).size > 1;

  const totals = weekTotals(items);

  return (
    <section className="stack">
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
            <li key={`${item.plan.id}-${item.session.id}`} className={cx('check-item', item.done && 'done')}>
              <div className="check-main">
                <p className="kicker">
                  {formatPretty(item.date)}
                  {item.session.focus ? ` · ${item.session.focus}` : ''}
                  {showPlan ? ` · ${item.plan.name}` : ''}
                </p>
                <h3>{item.session.title}</h3>
                {item.session.kind === 'run' ? (
                  <p className="muted">{item.done ? 'Run done' : 'Do the run'}</p>
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
