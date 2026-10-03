import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { buildPreset, planItemsForWeek, planLastDay, weekSentence, type PlanItem } from '../lib/plans';
import { addDays, daysBetween, formatDayMonth, formatLong, formatPretty, formatWeekday, startOfWeek, todayISO } from '../lib/dates';
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
  const [picked, setPicked] = useState(today);
  const anchor = anchorProp ?? internal;
  const monday = startOfWeek(anchor);
  const thisMonday = startOfWeek(today);
  const weeks = weekMondays(plans, today);
  const items = planItemsForWeek(data, plans, monday);
  const todayItems = planItemsForWeek(data, plans, today).filter((item) => item.date === today);
  const selected = inWeek(picked, monday) ? picked : inWeek(anchor, monday) ? anchor : inWeek(today, monday) ? today : monday;
  const dayItems = items.filter((item) => item.date === selected);
  const showPlan = new Set(items.map((item) => item.plan.id)).size > 1;
  const totals = weekTotals(items);
  const label = monday === thisMonday ? 'This week' : `Week of ${formatDayMonth(monday)}`;
  const phases = phaseSummary(items);
  const Title = heading;
  const dockGlance = variant === 'full';

  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<string, HTMLDivElement>());
  const mondayRef = useRef(monday);
  const selectedRef = useRef(selected);
  const fromUser = useRef(false);
  const locking = useRef(false);
  const scrollMode = useRef<ScrollBehavior>('instant');
  const moveRef = useRef<(date: string) => void>(() => {});

  function move(date: string) {
    if (!anchorProp) setInternal(date);
    onAnchor?.(date);
  }

  useLayoutEffect(() => {
    mondayRef.current = monday;
    selectedRef.current = selected;
    moveRef.current = move;
  });

  function goTo(date: string, behavior: ScrollBehavior) {
    if (startOfWeek(date) !== monday) scrollMode.current = behavior;
    setPicked(date);
    move(date);
  }

  function shiftWeek(deltaWeeks: number) {
    const offset = inWeek(selected, monday) ? daysBetween(monday, selected) : 0;
    goTo(addDays(monday, deltaWeeks * 7 + offset), 'smooth');
  }

  useLayoutEffect(() => {
    if (fromUser.current) {
      fromUser.current = false;
      return;
    }
    const scroller = scrollerRef.current;
    const page = pageRefs.current.get(monday);
    if (!scroller || !page) return;
    locking.current = true;
    const left = page.offsetLeft - Math.max(0, (scroller.clientWidth - page.offsetWidth) / 2);
    scroller.scrollTo({ left, behavior: scrollMode.current });
    scrollMode.current = 'instant';
    const timer = window.setTimeout(() => {
      locking.current = false;
    }, 480);
    return () => window.clearTimeout(timer);
  }, [monday]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let timer = 0;
    const settle = (fromEnd: boolean) => {
      if (locking.current) {
        if (fromEnd) locking.current = false;
        return;
      }
      const next = nearestWeek(scroller, pageRefs.current);
      if (!next || next === mondayRef.current) return;
      const offset = inWeek(selectedRef.current, mondayRef.current) ? daysBetween(mondayRef.current, selectedRef.current) : 0;
      fromUser.current = true;
      setPicked(addDays(next, offset));
      moveRef.current(addDays(next, offset));
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => settle(false), 90);
    };
    const onScrollEnd = () => settle(true);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('scrollend', onScrollEnd);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('scrollend', onScrollEnd);
      window.clearTimeout(timer);
    };
  }, []);

  const glance = glanceCopy(todayItems);

  return (
    <section className="stack">
      <div className="split">
        <Title>{label}</Title>
        {actions}
      </div>
      <button type="button" className={cx('today-glance', dockGlance && 'dock')} onClick={() => goTo(today, 'smooth')}>
        <span className="glance-copy">
          <span className="kicker">Today · {formatPretty(today)}</span>
          <strong>{glance.title}</strong>
          <small>{glance.detail}</small>
        </span>
        {glance.done ? <span className="badge good">Done</span> : null}
      </button>
      <div
        className={cx('week-scroller', dockGlance && 'dock')}
        ref={scrollerRef}
        aria-label="Weeks. Swipe sideways to change week."
      >
        {weeks.map((weekMonday) => {
          const days = Array.from({ length: 7 }, (_, index) => addDays(weekMonday, index));
          const weekItems = weekMonday === monday ? items : planItemsForWeek(data, plans, weekMonday);
          return (
            <div
              key={weekMonday}
              className="week-page"
              ref={(node) => {
                if (node) pageRefs.current.set(weekMonday, node);
                else pageRefs.current.delete(weekMonday);
              }}
            >
              <div className="week" aria-label={`Week of ${formatDayMonth(weekMonday)}`}>
                {days.map((date) => {
                  const planned = weekItems.filter((item) => item.date === date);
                  const logged = loggedOnDate(data, date);
                  const done = planned.length > 0 ? planned.every((item) => item.done) : logged.length > 0;
                  const open = planned.length > 0 && !done;
                  return (
                    <button
                      key={date}
                      type="button"
                      className={cx('day', date === today && 'today', date === selected && weekMonday === monday && 'selected', done && 'done', open && 'planned')}
                      aria-pressed={date === selected && weekMonday === monday}
                      onClick={() => goTo(date, 'auto')}
                    >
                      <span>{formatWeekday(date)}</span>
                      <strong>{Number(date.slice(8))}</strong>
                      <i className="mark" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <DayPanel
        date={selected}
        items={dayItems}
        showPlan={showPlan}
        today={today}
        onLog={onLog}
      />
      <div className="quick week-nav">
        <button type="button" className="btn ghost" onClick={() => shiftWeek(-1)}>
          Previous
        </button>
        {monday !== thisMonday ? (
          <button type="button" className="btn ghost" onClick={() => goTo(today, 'smooth')}>
            This week
          </button>
        ) : null}
        <button type="button" className="btn ghost" onClick={() => shiftWeek(1)}>
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
      {dockGlance ? <div className="today-glance-spacer" aria-hidden="true" /> : null}
    </section>
  );
}

function DayPanel({
  date,
  items,
  showPlan,
  today,
  onLog,
}: {
  date: string;
  items: PlanItem[];
  showPlan: boolean;
  today: string;
  onLog: (preset: LogPreset) => void;
}) {
  return (
    <div className="day-panel stack">
      <div>
        <p className="kicker">{date === today ? 'Selected · today' : 'Selected day'}</p>
        <h3>{formatLong(date)}</h3>
      </div>
      {items.length === 0 ? (
        <p className="muted">Nothing planned this day.</p>
      ) : (
        items.map((item) => (
          <article key={`${item.plan.id}-${item.session.id}`} className="stack">
            <div className="split">
              <div>
                <p className="kicker">
                  {item.session.kind === 'run' ? 'Run' : 'Strength'}
                  {item.session.focus ? ` · ${item.session.focus}` : ''}
                  {showPlan ? ` · ${item.plan.name}` : ''}
                </p>
                <h3>{item.session.title}</h3>
              </div>
              {item.done ? <span className="badge good">Done</span> : null}
              {item.logs.length > 0 && !item.done ? <span className="badge mid">In progress</span> : null}
              {item.date < today && item.logs.length === 0 && !item.done ? <span className="badge warn">Catch up</span> : null}
            </div>
            {item.done && item.logged ? (
              <a className="btn primary" href={`#/log/${item.logged.id}`}>
                View session
              </a>
            ) : item.logged ? (
              <a className="btn primary" href={`#/log/${item.logged.id}`}>
                Continue
              </a>
            ) : (
              <button type="button" className="btn primary" onClick={() => onLog(buildPreset(item.plan, item.session, item.date, today))}>
                Log
              </button>
            )}
            {item.session.kind === 'run' ? (
              <p>{item.done ? `Run done · ${runPrescription(item.session)}` : runPrescription(item.session)}</p>
            ) : (
              <ul className="targets">
                {item.targets.map((target) => {
                  const width = target.targetSets > 0 ? Math.min(100, (target.completedSets / target.targetSets) * 100) : 0;
                  return (
                    <li key={target.name}>
                      <span className="target-name">{target.name}</span>
                      <span className="target-count">
                        {target.completedSets}/{target.targetSets} × {target.repsLabel}
                        {target.met ? ' · done' : ''}
                      </span>
                      <span className="target-bar" aria-hidden="true">
                        <i style={{ width: `${width}%` }} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        ))
      )}
    </div>
  );
}

function glanceCopy(items: PlanItem[]): { title: string; detail: string; done: boolean } {
  if (items.length === 0) return { title: 'Nothing planned', detail: 'No session today', done: false };
  const done = items.every((item) => item.done);
  const title = items.map((item) => item.session.title).join(', ');
  const first = items[0];
  if (!first) return { title: 'Nothing planned', detail: 'No session today', done: false };
  const detail = first.session.kind === 'run' ? runPrescription(first.session) : `${first.session.exercises.length} exercises`;
  return { title, detail: done ? `Done · ${detail}` : detail, done };
}

function inWeek(date: string, monday: string): boolean {
  return date >= monday && date <= addDays(monday, 6);
}

function weekMondays(plans: Plan[], today: string): string[] {
  const thisMonday = startOfWeek(today);
  let first = addDays(thisMonday, -28);
  let last = addDays(thisMonday, 7 * 16);
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
  }
  const mondays: string[] = [];
  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 7)) mondays.push(cursor);
  return mondays;
}

function nearestWeek(scroller: HTMLDivElement, pages: Map<string, HTMLDivElement>): string | null {
  const center = scroller.scrollLeft + scroller.clientWidth / 2;
  let best: string | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [week, page] of pages) {
    const mid = page.offsetLeft + page.offsetWidth / 2;
    const dist = Math.abs(mid - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = week;
    }
  }
  return best;
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
