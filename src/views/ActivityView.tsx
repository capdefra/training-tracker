import { activityDayFor, activitySummary, type ActivityMark } from '../lib/activity';
import { activityMondays, activeGoal, planItemsForWeek } from '../lib/plans';
import { addDays, formatDayMonth, formatPretty, formatWeekday, startOfWeek, todayISO, weekdayLabel } from '../lib/dates';
import { cx } from '../lib/cx';
import type { TrainingData } from '../types';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

const LEVELS: { id: ActivityMark; extra?: boolean; label: string }[] = [
  { id: 'neutral', label: 'Rest' },
  { id: 'skipped', label: 'Missed' },
  { id: 'skipped', extra: true, label: 'Missed + extra' },
  { id: 'done', label: 'Done' },
  { id: 'done', extra: true, label: 'Done + extra' },
  { id: 'extra', extra: true, label: 'Extra' },
];

export function ActivityView({ data }: { data: TrainingData }) {
  const today = todayISO();
  const goal = activeGoal(data);
  const plans = goal ? data.plans.filter((plan) => plan.goalId === goal.id && plan.status === 'active') : [];
  const thisMonday = startOfWeek(today);
  const weeks = activityMondays(today);

  return (
    <div className="stack page">
      <header className="page-head">
        <p className="kicker">Log</p>
        <h1>Activity</h1>
        <p className="lead">Each square is a day. The top row is this week. Older weeks sit below it.</p>
      </header>
      <div className="activity-legend" aria-hidden="true">
        {LEVELS.map((level) => (
          <span key={`${level.id}-${level.extra ? 'extra' : 'plain'}`}>
            <i className={cx('activity-swatch', level.id, level.extra && 'has-extra')} />
            {level.label}
          </span>
        ))}
      </div>
      <div className="activity" role="grid" aria-label="Activity by week">
        <div className="activity-head" role="row">
          <span />
          {WEEKDAYS.map((day) => (
            <span key={day} role="columnheader">
              {weekdayLabel(day).slice(0, 1)}
            </span>
          ))}
        </div>
        {weeks.map((monday) => {
          const items = planItemsForWeek(data, plans, monday);
          return (
            <div key={monday} className="activity-week" role="row">
              <span className="activity-week-label">{monday === thisMonday ? 'This week' : formatDayMonth(monday)}</span>
              {Array.from({ length: 7 }, (_, index) => {
                const date = addDays(monday, index);
                const planned = items.filter((item) => item.date === date);
                const day = activityDayFor(date, today, items, data.sessions);
                return (
                  <a
                    key={date}
                    role="gridcell"
                    href={`#/today/${date}`}
                    className={cx('activity-cell', day.mark, day.extra && 'has-extra', date === today && 'is-today')}
                    aria-label={cellLabel(date, planned, day)}
                    aria-current={date === today ? 'date' : undefined}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function cellLabel(date: string, planned: { extra: boolean; session: { title: string } }[], day: { mark: ActivityMark; extra: boolean }): string {
  const names = planned.map((item) => item.session.title);
  const scheduled = planned.filter((item) => !item.extra).length;
  const detail = names.length > 0 ? `, ${names.join(', ')}` : '';
  const when = date === todayISO() ? `${formatPretty(date)}, today` : `${formatWeekday(date, 'long')} ${formatPretty(date)}`;
  return `${when}, ${activitySummary(day, scheduled)}${detail}`;
}
