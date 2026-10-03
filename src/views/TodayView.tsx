import { PresetList } from '../components/PresetList';
import { WeekBoard } from '../components/WeekBoard';
import { formatCountdown, formatLong, formatPretty, formatWeekday, todayISO } from '../lib/dates';
import { activeGoal, recentSessions } from '../lib/plans';
import { sessionSummary } from '../lib/stats';
import type { LogPreset, TrainingData } from '../types';

export function TodayView({ data, onLog }: { data: TrainingData; onLog: (preset?: LogPreset) => void }) {
  const today = todayISO();
  const goal = activeGoal(data);
  const plans = goal ? data.plans.filter((plan) => plan.goalId === goal.id && plan.status === 'active') : [];
  const recent = recentSessions(data, 5);

  return (
    <div className="stack page">
      <header className="page-head">
        <p className="kicker">{formatWeekday(today, 'long')}</p>
        <h1>{formatLong(today)}</h1>
      </header>

      {goal ? (
        <section className="hero">
          <p className="kicker light">{goal.status === 'active' ? 'Active goal' : goal.status}</p>
          <h2>{goal.name}</h2>
          <p>
            {goal.targetDate ? `${formatLong(goal.targetDate)} · ${formatCountdown(today, goal.targetDate)}` : 'No target date'}
          </p>
          {goal.focus.length > 0 ? (
            <div className="tags">
              {goal.focus.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {goal.notes ? <p className="hero-notes">{goal.notes}</p> : null}
        </section>
      ) : (
        <section className="card empty">
          <h2>No goal yet</h2>
          <p>A goal is the season or race the plan is building toward.</p>
          <a className="btn primary" href="#/plans">
            Create a goal
          </a>
        </section>
      )}

      <section className="stack">
        {plans.length > 0 ? (
          <WeekBoard
            data={data}
            plans={plans}
            onLog={(preset) => onLog(preset)}
            actions={
              <div className="quick">
                <button type="button" className="btn ghost small" onClick={() => onLog()}>
                  Log strength
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() =>
                    onLog({
                      date: today,
                      kind: 'run',
                      title: 'Easy run',
                      goalId: goal?.id ?? null,
                      planId: null,
                      planSessionId: null,
                      templateExercises: [],
                      distanceKm: null,
                      durationMin: null,
                      prompt: '',
                    })
                  }
                >
                  Log a run
                </button>
              </div>
            }
          />
        ) : (
          <>
            <div className="split">
              <h2>This week</h2>
              <div className="quick">
                <button type="button" className="btn ghost small" onClick={() => onLog()}>
                  Log strength
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() =>
                    onLog({
                      date: today,
                      kind: 'run',
                      title: 'Easy run',
                      goalId: goal?.id ?? null,
                      planId: null,
                      planSessionId: null,
                      templateExercises: [],
                      distanceKm: null,
                      durationMin: null,
                      prompt: '',
                    })
                  }
                >
                  Log a run
                </button>
              </div>
            </div>
            <p className="muted">Add a plan to see the week laid out, or log a session on its own.</p>
          </>
        )}
      </section>

      <PresetList data={data} onLog={(preset) => onLog(preset)} />

      <section className="stack">
        <div className="split">
          <h2>Recent</h2>
          <a className="text-link" href="#/progress">
            Progress
          </a>
        </div>
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
      </section>
    </div>
  );
}
