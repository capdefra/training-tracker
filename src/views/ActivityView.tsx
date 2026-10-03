import { activityMondays, activeGoal, dayProgress, extraLogsForDay, planItemsForWeek, type DayProgress, type PlanItem } from '../lib/plans';
import { addDays, formatDayMonth, formatPretty, formatWeekday, startOfWeek, todayISO, weekdayLabel } from '../lib/dates';
import { cx } from '../lib/cx';
import type { Session, TrainingData } from '../types';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

const LEVELS: { id: DayProgress; label: string }[] = [
  { id: 'empty', label: 'Nothing' },
  { id: 'planned', label: 'Planned' },
  { id: 'partial', label: 'Partly done' },
  { id: 'done', label: 'Done' },
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
          <span key={level.id}>
            <i className={cx('activity-swatch', level.id)} />
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
                const extras = extraLogsForDay(data.sessions, planned, date);
                const level = dayProgress(planned, extras);
                return (
                  <a
                    key={date}
                    role="gridcell"
                    href={`#/today/${date}`}
                    className={cx('activity-cell', level, date === today && 'is-today')}
                    aria-label={cellLabel(date, planned, extras, level)}
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

function cellLabel(date: string, planned: PlanItem[], extras: Session[], level: DayProgress): string {
  const names = [...planned.map((item) => item.session.title), ...extras.map((session) => session.title)];
  const state =
    level === 'empty' ? 'nothing planned' : level === 'planned' ? 'planned, not done' : level === 'partial' ? 'partly done' : planned.length === 0 ? 'logged' : 'done';
  const detail = names.length > 0 ? `, ${names.join(', ')}` : '';
  const when = date === todayISO() ? `${formatPretty(date)}, today` : `${formatWeekday(date, 'long')} ${formatPretty(date)}`;
  return `${when}, ${state}${detail}`;
}
