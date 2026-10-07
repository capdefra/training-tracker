import { useState, type ReactNode } from 'react';
import { ExerciseDemo } from './ExerciseDemo';
import { WatchSummary } from './WatchSummary';
import { findDemo } from '../lib/demos';
import { addDays, formatDayMonth, formatPretty, formatWeekday, isRealISODate, startOfWeek, todayISO } from '../lib/dates';
import { cx } from '../lib/cx';
import { activityMondays, buildPreset, extraLogsForDay, planItemsForWeek, planLastDay, type PlanItem } from '../lib/plans';
import { formatDuration, formatKm } from '../lib/format';
import { sessionSummary } from '../lib/stats';
import { runPrescription } from '../lib/targets';
import { hasDisplayedMetrics } from '../lib/watch';
import type { LogPreset, Plan, Session, TrainingData } from '../types';

export function WeekBoard({
  data,
  plans,
  onLog,
  heading = 'h2',
  anchor: anchorProp,
  onAnchor,
  showDate = true,
  showTodayLink = true,
  summary = false,
  beforeDay,
}: {
  data: TrainingData;
  plans: Plan[];
  onLog: (preset: LogPreset) => void;
  heading?: 'h2' | 'h3';
  anchor?: string;
  onAnchor?: (date: string) => void;
  showDate?: boolean;
  /** When false, the page heading is the way back to today, so this board does not add another. */
  showTodayLink?: boolean;
  /** Short always-visible cards. Sets, watch metrics, and form links stay on the session page. */
  summary?: boolean;
  /** Stable content rendered under the week and above the selected day. */
  beforeDay?: ReactNode;
}) {
  const today = todayISO();
  const [internal, setInternal] = useState(today);
  const selected = anchorProp ?? internal;
  const monday = startOfWeek(selected);
  const bounds = weekBounds(plans, today);
  const thisMonday = startOfWeek(today);
  const items = planItemsForWeek(data, plans, monday);
  const dayItems = items.filter((item) => item.date === selected);
  const extras = extraLogsForDay(data.sessions, dayItems, selected);
  const todayItems = planItemsForWeek(data, plans, today).filter((item) => item.date === today);
  const todayExtras = extraLogsForDay(data.sessions, todayItems, today);
  const showPlan = new Set(items.map((item) => item.plan.id)).size > 1;
  const next = selected === today && dayItems.length === 0 && extras.length === 0 ? nextPlanItem(data, plans, today) : null;
  const Title = heading;
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const canPrev = monday > bounds.first;
  const canNext = monday < bounds.last;

  function goTo(date: string) {
    const week = startOfWeek(date);
    if (week < bounds.first || week > bounds.last) return;
    if (anchorProp === undefined) setInternal(date);
    onAnchor?.(date);
  }

  return (
    <section className="stack week-board">
      <div className="week-stack">
        <div className="week-controls">
          <button type="button" className="icon-btn" aria-label="Previous week" disabled={!canPrev} onClick={() => goTo(addDays(selected, -7))}>
            ‹
          </button>
          <button type="button" className="btn ghost" aria-current={selected === today ? 'date' : undefined} onClick={() => goTo(today)}>
            Today
          </button>
          <button type="button" className="icon-btn" aria-label="Next week" disabled={!canNext} onClick={() => goTo(addDays(selected, 7))}>
            ›
          </button>
        </div>
        <div className="week-heading">
          <Title>{monday === thisMonday ? 'This week' : 'Week'}</Title>
          <p className="muted">
            {formatDayMonth(monday)} – {formatDayMonth(addDays(monday, 6))}
          </p>
        </div>
        <div className="week" role="group" aria-label={`Week of ${formatDayMonth(monday)}`}>
          {days.map((date) => {
            const planned = items.filter((item) => item.date === date);
            const extra = extraLogsForDay(data.sessions, planned, date);
            const done = planned.length > 0 ? planned.every((item) => item.done) : extra.length > 0;
            const open = planned.length > 0 && !done;
            const names = [...planned.map((item) => item.session.title), ...extra.map((session) => session.title)];
            return (
              <button
                key={date}
                type="button"
                className={cx('day', date === today && 'today', date === selected && 'selected', done && 'done', open && 'planned')}
                aria-pressed={date === selected}
                aria-label={`${formatPretty(date)}${names.length > 0 ? `, ${names.join(', ')}` : ', nothing planned'}`}
                onClick={() => goTo(date)}
              >
                <span className="day-label">
                  <span>{formatWeekday(date)}</span>
                  <strong>{Number(date.slice(8))}</strong>
                  <i className="mark" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {beforeDay}
      <div className="day-view stack" id="day-plan">
        {showTodayLink && selected !== today ? (
          <button type="button" className="today-return" onClick={() => goTo(today)}>
            <span className="kicker">Today · {formatPretty(today)}</span>
            <strong>{dayLabel(todayItems, todayExtras)}</strong>
          </button>
        ) : null}
        <DayPlan
          date={selected}
          items={dayItems}
          extras={extras}
          showPlan={showPlan}
          showDate={showDate}
          today={today}
          next={next}
          onLog={onLog}
          onOpen={goTo}
          summary={summary}
        />
      </div>
    </section>
  );
}

function DayPlan({
  date,
  items,
  extras,
  showPlan,
  showDate,
  today,
  next,
  onLog,
  onOpen,
  summary,
}: {
  date: string;
  items: PlanItem[];
  extras: Session[];
  showPlan: boolean;
  showDate: boolean;
  today: string;
  next: PlanItem | null;
  onLog: (preset: LogPreset) => void;
  onOpen: (date: string) => void;
  summary: boolean;
}) {
  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);
  if (open.length === 0 && done.length === 0 && extras.length === 0) {
    return (
      <article className="session-card">
        <p className="kicker">{dateKicker(date, today, showDate)}</p>
        <h2>Nothing planned</h2>
        {next ? (
          <>
            <p>
              Next is {next.session.title} · {formatPretty(next.date)}.
            </p>
            <div className="session-action">
              <button type="button" className="btn primary" onClick={() => onOpen(next.date)}>
                Open {formatWeekday(next.date, 'long')}
              </button>
            </div>
          </>
        ) : null}
      </article>
    );
  }

  return (
    <div className="stack">
      {open.length > 0 ? (
        <section className="day-list" aria-label="Planned">
          <p className="kicker">Planned</p>
          {open.map((item) => (
            <SessionCard key={`${item.plan.id}-${item.session.id}`} item={item} showPlan={showPlan} showDate={showDate} today={today} onLog={onLog} summary={summary} />
          ))}
        </section>
      ) : null}
      {done.length > 0 || extras.length > 0 ? (
        <section className="day-list" aria-label="Done">
          <p className="kicker">Done</p>
          {done.map((item) => (
            <SessionCard key={`${item.plan.id}-${item.session.id}`} item={item} showPlan={showPlan} showDate={showDate} today={today} onLog={onLog} summary={summary} />
          ))}
          {extras.map((session) => (
            <LoggedCard key={session.id} session={session} showDate={showDate} today={today} summary={summary} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function SessionCard({
  item,
  showPlan,
  showDate,
  today,
  onLog,
  summary,
}: {
  item: PlanItem;
  showPlan: boolean;
  showDate: boolean;
  today: string;
  onLog: (preset: LogPreset) => void;
  summary: boolean;
}) {
  const action = sessionAction(item);
  const hasForm = item.targets.some((target) => findDemo(target.name));
  const line = summary ? summaryLine(item) : null;
  return (
    <article className="session-card">
      <div className="split">
        <div>
          <p className="kicker">
            {dateKicker(item.date, today, showDate)}
            {' · '}
            {item.session.kind === 'run' ? 'Run' : 'Strength'}
            {item.session.focus ? ` · ${item.session.focus}` : ''}
            {showPlan ? ` · ${item.plan.name}` : ''}
            {item.movedFrom ? <span className="moved-hint"> · Moved from {formatWeekday(item.movedFrom)}</span> : null}
          </p>
          <h2>{item.session.title}</h2>
          {!summary && item.session.kind === 'strength' && item.session.durationMin ? <p className="muted">{item.session.durationMin} min</p> : null}
        </div>
        {item.done ? <span className="badge good">Done</span> : null}
        {item.logs.length > 0 && !item.done ? <span className="badge mid">In progress</span> : null}
        {item.logs.length === 0 && !item.done ? <span className="badge warn">Not done</span> : null}
      </div>
      {summary && line ? <p className="lead">{line}</p> : null}
      {!summary && item.session.kind === 'run' ? (
        <p className="lead">{item.done ? `Run done · ${runPrescription(item.session)}` : runPrescription(item.session)}</p>
      ) : null}
      <div className="session-action">
        {action === 'view' && item.logged ? (
          <a className="btn primary" href={`#/log/${item.logged.id}`}>
            View session
          </a>
        ) : null}
        {action === 'continue' && item.logged ? (
          <a className="btn primary" href={`#/log/${item.logged.id}`}>
            Continue
          </a>
        ) : null}
        {action === 'log' ? (
          <button type="button" className="btn primary" onClick={() => onLog(buildPreset(item.plan, item.session, item.date, today))}>
            Log
          </button>
        ) : null}
        {action === 'start' ? (
          <button type="button" className="btn primary" onClick={() => onLog(buildPreset(item.plan, item.session, item.date, today))}>
            Start
          </button>
        ) : null}
      </div>
      {!summary && item.session.kind === 'strength' ? (
        <>
          <ul className="targets">
            {item.targets.map((target) => {
              const width = target.targetSets > 0 ? Math.min(100, (target.completedSets / target.targetSets) * 100) : 0;
              return (
                <li key={target.name}>
                  <span className="target-name">{target.name}</span>
                  <span className="target-side">
                    <ExerciseDemo name={target.name} />
                    <span className="target-count">
                      {target.completedSets}/{target.targetSets} × {target.repsLabel}
                      {target.met ? ' · done' : ''}
                    </span>
                  </span>
                  <span className="target-bar" aria-hidden="true">
                    <i style={{ width: `${width}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
          {hasForm ? <p className="muted fine">Form plays a short clip on this page.</p> : null}
        </>
      ) : null}
      {!summary && item.logged && hasDisplayedMetrics(item.logged) ? <WatchSummary session={item.logged} /> : null}
      {!summary && item.session.kind === 'strength' && item.session.notes ? (
        <details className="session-notes">
          <summary>Session notes</summary>
          <p>{item.session.notes}</p>
        </details>
      ) : null}
    </article>
  );
}

function LoggedCard({ session, showDate, today, summary }: { session: Session; showDate: boolean; today: string; summary: boolean }) {
  const line = summary ? loggedLine(session) : sessionSummary(session);
  const showSummary = Boolean(line) && line !== 'Run' && line !== 'Strength' && (summary || !hasDisplayedMetrics(session));
  return (
    <article className="session-card">
      <div className="split">
        <div>
          <p className="kicker">
            {dateKicker(session.date, today, showDate)}
            {' · '}
            {session.kind === 'run' ? 'Run' : 'Strength'}
          </p>
          <h2>{session.title}</h2>
          {showSummary ? <p className="lead">{line}</p> : null}
        </div>
        <span className="badge good">Done</span>
      </div>
      <div className="session-action">
        <a className="btn primary" href={`#/log/${session.id}`}>
          View session
        </a>
      </div>
      {!summary && hasDisplayedMetrics(session) ? <WatchSummary session={session} /> : null}
    </article>
  );
}

function dateKicker(date: string, today: string, showDate: boolean): string {
  if (showDate) return formatPretty(date);
  return date === today ? 'Today' : formatWeekday(date, 'long');
}

function sessionAction(item: PlanItem): 'view' | 'continue' | 'log' | 'start' {
  if (item.done && item.logged) return 'view';
  if (item.logged) return 'continue';
  if (item.session.kind === 'run') return 'log';
  return 'start';
}

function dayLabel(planned: PlanItem[], extras: Session[]): string {
  const titles = [...planned.map((item) => item.session.title), ...extras.map((session) => session.title)];
  if (titles.length === 0) return 'Nothing planned';
  return titles.join(', ');
}

function loggedLine(session: Session): string | null {
  if (session.kind === 'run') {
    const bits: string[] = [];
    if (session.distanceKm) bits.push(`${formatKm(session.distanceKm)} km`);
    if (session.durationSec) bits.push(formatDuration(session.durationSec));
    return bits.length > 0 ? bits.join(' · ') : null;
  }
  const count = session.exercises.filter((exercise) => exercise.name || exercise.sets.length > 0).length;
  if (count === 0) return null;
  return count === 1 ? '1 exercise' : `${count} exercises`;
}

function summaryLine(item: PlanItem): string | null {
  if (item.logged) {
    const logged = loggedLine(item.logged);
    if (logged) return logged;
  }
  if (item.session.kind === 'run') return runPrescription(item.session);
  if (item.session.durationMin) return `${item.session.durationMin} min`;
  return null;
}

function weekBounds(plans: Plan[], today: string): { first: string; last: string } {
  let first = activityMondays(today).at(-1) ?? startOfWeek(today);
  let last = startOfWeek(today);
  for (const plan of plans) {
    if (plan.startDate) {
      const start = startOfWeek(plan.startDate);
      if (start < first) first = start;
    }
    const end = planLastDay(plan);
    if (end) {
      const endWeek = startOfWeek(end);
      if (endWeek > last) last = endWeek;
    }
    for (const move of plan.moves ?? []) {
      if (!isRealISODate(move.toDate)) continue;
      const week = startOfWeek(move.toDate);
      if (week < first) first = week;
      if (week > last) last = week;
    }
  }
  return { first, last };
}

function nextPlanItem(data: TrainingData, plans: Plan[], after: string): PlanItem | null {
  let end = after;
  for (const plan of plans) {
    const last = planLastDay(plan);
    if (last > end) end = last;
  }
  if (end <= after) return null;
  for (let monday = startOfWeek(addDays(after, 1)); monday <= end; monday = addDays(monday, 7)) {
    const upcoming = planItemsForWeek(data, plans, monday).find((item) => item.date > after);
    if (upcoming) return upcoming;
  }
  return null;
}
