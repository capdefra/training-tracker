import { buildPreset, planItemsForWeek, weekSentence } from '../lib/plans';
import { addDays, formatPretty, formatWeekday, startOfWeek, todayISO } from '../lib/dates';
import { cx } from '../lib/cx';
import { sessionSummary } from '../lib/stats';
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

  return (
    <section className="stack">
      <p className="lead">{weekSentence(items, today)}</p>
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
                <p className="muted">{item.done && item.logged ? sessionSummary(item.logged) : item.session.kind === 'run' ? 'Run' : 'Strength'}</p>
              </div>
              <div className="check-actions">
                {item.date < today && !item.done ? <span className="badge warn">Catch up</span> : null}
                {item.done ? <span className="badge good">Done</span> : null}
                {item.done && item.logged ? (
                  <a className="btn ghost small" href={`#/log/${item.logged.id}`}>
                    View
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

function loggedOnDate(data: TrainingData, date: string) {
  return data.sessions.filter((session) => session.date === date);
}
