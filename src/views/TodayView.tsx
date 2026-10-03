import { useState } from 'react';
import { PresetList } from '../components/PresetList';
import { WeekBoard } from '../components/WeekBoard';
import { cx } from '../lib/cx';
import { addDays, formatCountdown, formatLong, formatPretty, isISODate, startOfWeek, todayISO } from '../lib/dates';
import { activeGoal, planItemsForWeek, recentSessions, type PlanItem } from '../lib/plans';
import { sessionSummary } from '../lib/stats';
import type { LogPreset, TrainingData } from '../types';

export function TodayView({ data, onLog, date }: { data: TrainingData; onLog: (preset?: LogPreset) => void; date?: string }) {
  const today = todayISO();
  const [focus, setFocus] = useState(date && isISODate(date) ? date : today);
  const goal = activeGoal(data);
  const plans = goal ? data.plans.filter((plan) => plan.goalId === goal.id && plan.status === 'active') : [];
  const recent = recentSessions(data, 5);
  const weekItems = plans.length > 0 ? planItemsForWeek(data, plans, focus) : [];
  const weekStart = startOfWeek(focus);
  const loggedCount = data.sessions.filter((session) => session.date >= weekStart && session.date <= addDays(weekStart, 6)).length;
  const onToday = focus === today;
  const goalLine = goal ? (goal.targetDate ? `${goal.name} · ${formatCountdown(today, goal.targetDate)}` : goal.name) : '';

  return (
    <div className="stack page">
      <header className="page-head">
        <h1 className="sr-only">Today, {formatLong(today)}</h1>
        <button type="button" className={cx('today-heading', !onToday && 'is-away')} onClick={() => setFocus(today)}>
          <span className="kicker">{onToday ? 'Today' : 'Return to today'}</span>
          <span className="today-title">{formatLong(today)}</span>
          {goalLine ? <span className="muted">{goalLine}</span> : null}
        </button>
      </header>

      {plans.length > 0 ? (
        <WeekBoard
          data={data}
          plans={plans}
          onLog={onLog}
          anchor={focus}
          onAnchor={setFocus}
          showDate={false}
          showTodayLink={false}
          summary
          beforeDay={
            <details className="card more-fold">
              <summary>{weekSummary(weekItems, weekStart === startOfWeek(today), loggedCount)}</summary>
              <div className="stack more-body">
                {goal ? (
                  <section className="stack">
                    <h2>{goal.name}</h2>
                    <p className="muted">{goal.targetDate ? `${formatLong(goal.targetDate)} · ${formatCountdown(today, goal.targetDate)}` : 'No target date'}</p>
                    {goal.focus.length > 0 ? (
                      <div className="tags">
                        {goal.focus.map((tag) => (
                          <span key={tag} className="tag light">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {goal.notes ? <p>{goal.notes}</p> : null}
                  </section>
                ) : null}
                <PresetList data={data} onLog={onLog} embedded />
                <section className="stack">
                  <h2>Recent</h2>
                  {recent.length === 0 ? (
                    <p className="muted">Nothing logged yet.</p>
                  ) : (
                    <ul className="session-list">
                      {recent.map((session) => (
                        <li key={session.id}>
                          <a className="session-link" href={`#/log/${session.id}`}>
                            <span>
                              <strong>{session.title}</strong>
                              <small>
                                {formatPretty(session.date)} · {session.kind === 'run' ? 'Run' : 'Strength'}
                              </small>
                            </span>
                            <em>{sessionSummary(session)}</em>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" className="btn ghost" onClick={() => onLog()}>
                    Log something else
                  </button>
                </section>
              </div>
            </details>
          }
        />
      ) : (
        <>
        <section className="session-card">
          <h2>No plan yet</h2>
          <p className="muted">Add a plan to see the week, or log a session on its own.</p>
          <div className="session-action">
            <button type="button" className="btn primary" onClick={() => onLog()}>
              Log
            </button>
            <button type="button" className="btn ghost" onClick={() => onLog(blankRun(today, goal?.id ?? null))}>
              Log a run
            </button>
          </div>
          {goal ? null : (
            <a className="btn ghost" href="#/plans">
              Create a goal
            </a>
          )}
        </section>
        <details className="card more-fold">
          <summary>{weekSummary(weekItems, weekStart === startOfWeek(today), loggedCount)}</summary>
          <div className="stack more-body">
            {goal ? (
              <section className="stack">
                <h2>{goal.name}</h2>
                <p className="muted">{goal.targetDate ? `${formatLong(goal.targetDate)} · ${formatCountdown(today, goal.targetDate)}` : 'No target date'}</p>
                {goal.focus.length > 0 ? (
                  <div className="tags">
                    {goal.focus.map((tag) => (
                      <span key={tag} className="tag light">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {goal.notes ? <p>{goal.notes}</p> : null}
              </section>
            ) : null}
            <PresetList data={data} onLog={onLog} embedded />
            <section className="stack">
              <h2>Recent</h2>
              {recent.length === 0 ? (
                <p className="muted">Nothing logged yet.</p>
              ) : (
                <ul className="session-list">
                  {recent.map((session) => (
                    <li key={session.id}>
                      <a className="session-link" href={`#/log/${session.id}`}>
                        <span>
                          <strong>{session.title}</strong>
                          <small>
                            {formatPretty(session.date)} · {session.kind === 'run' ? 'Run' : 'Strength'}
                          </small>
                        </span>
                        <em>{sessionSummary(session)}</em>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn ghost" onClick={() => onLog()}>
                Log something else
              </button>
            </section>
          </div>
        </details>
        </>
      )}
    </div>
  );
}

function weekSummary(items: PlanItem[], isThisWeek: boolean, loggedCount: number): string {
  const prefix = isThisWeek ? 'This week' : 'That week';
  if (items.length === 0) return loggedCount > 0 ? `${prefix} · ${loggedCount} logged` : `${prefix} · nothing planned`;
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
  return `${prefix} · ${setDone}/${setTarget} sets · ${runDone}/${runTarget} runs`;
}

function blankRun(date: string, goalId: string | null): LogPreset {
  return {
    date,
    kind: 'run',
    title: 'Easy run',
    goalId,
    planId: null,
    planSessionId: null,
    templateExercises: [],
    distanceKm: null,
    durationMin: null,
    prompt: '',
  };
}
