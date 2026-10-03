import { useState } from 'react';
import { DistanceChart, LiftChart, PaceChart } from '../components/Charts';
import { WeekBoard } from '../components/WeekBoard';
import { addDays, formatPretty, todayISO } from '../lib/dates';
import { effortLabel, formatDuration, formatPace, trimNum } from '../lib/format';
import { cx } from '../lib/cx';
import { averagePace, exerciseOptions, liftSeries, runPoints, sessionSummary, summarize, weeklyDistance } from '../lib/stats';
import { activeGoal } from '../lib/plans';
import type { LogPreset, TrainingData } from '../types';

type RangeId = '4w' | '12w' | 'all';
type KindFilter = 'all' | 'strength' | 'run';

export function ProgressView({ data, onLog }: { data: TrainingData; onLog: (preset: LogPreset) => void }) {
  const today = todayISO();
  const [range, setRange] = useState<RangeId>('12w');
  const [kind, setKind] = useState<KindFilter>('all');
  const [exerciseKey, setExerciseKey] = useState('back squat');
  const start = range === 'all' ? null : addDays(today, range === '4w' ? -27 : -83);
  const summary = summarize(data.sessions, start, today);
  const options = exerciseOptions(data.sessions);
  const selected = options.find((option) => option.key === exerciseKey) ?? options[0] ?? null;
  const points = selected ? liftSeries(data.sessions, selected.label, start, today) : [];
  const loaded = points.some((point) => point.weightKg > 0);
  const runs = runPoints(data.sessions, start, today);
  const weeks = weeklyDistance(data.sessions, start, today);
  const history = [...data.sessions]
    .filter((session) => (!start || session.date >= start) && session.date <= today)
    .filter((session) => kind === 'all' || session.kind === kind)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const first = points[0];
  const last = points.length > 1 ? points[points.length - 1] : undefined;
  const easy = runs.filter((point) => !point.long);
  const earlyPace = averagePace(easy.slice(0, 3));
  const latePace = averagePace(easy.slice(-3));
  const goal = activeGoal(data);
  const plans = goal ? data.plans.filter((plan) => plan.goalId === goal.id && plan.status === 'active') : [];

  return (
    <div className="stack page">
      <header className="page-head">
        <p className="kicker">History</p>
        <h1>Progress</h1>
        <p className="lead">This week is sets, reps, and runs completed. Load and pace show up once you log them.</p>
      </header>

      {plans.length > 0 ? <WeekBoard data={data} plans={plans} onLog={onLog} /> : null}

      <div className="filters" role="group" aria-label="Time range">
        {([
          ['4w', '4 weeks'],
          ['12w', '12 weeks'],
          ['all', 'All'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={cx('chip', range === id && 'on')} onClick={() => setRange(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="stats">
        <Stat label="Sessions" value={String(summary.sessions)} />
        <Stat label="Kilometres" value={trimNum(summary.km)} />
        <Stat label="Time running" value={summary.runSec > 0 ? formatDuration(summary.runSec) : '—'} />
        <Stat label="Loaded volume" value={summary.volume > 0 ? `${Math.round(summary.volume).toLocaleString('en-GB')} kg` : '—'} />
      </div>

      <section className="card stack">
        <div className="split">
          <h2>Strength</h2>
          {options.length > 0 ? (
            <label className="select-label">
              <span className="sr-only">Exercise</span>
              <select value={selected?.key ?? ''} onChange={(event) => setExerciseKey(event.target.value)}>
                {options.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {points.length === 0 ? (
          <p className="muted">Log a strength session and the lift will show up here.</p>
        ) : (
          <>
            {first && last && loaded ? (
              <p className="callout">
                Top set moved from <strong>{trimNum(first.weightKg)}×{first.reps}</strong> to <strong>{trimNum(last.weightKg)}×{last.reps}</strong>.
                Estimated 1RM {trimNum(first.e1rm)} → {trimNum(last.e1rm)} kg.
              </p>
            ) : null}
            {first && last && !loaded ? (
              <p className="callout">
                Reps moved from <strong>{first.reps}</strong> to <strong>{last.reps}</strong>. This one is logged without load.
              </p>
            ) : null}
            {points.length < 2 ? <p className="muted">One session so far. Log it again to see the line move.</p> : null}
            <div className="chart-box">
              <LiftChart points={points} mode={loaded ? 'load' : 'reps'} />
            </div>
            {loaded ? <p className="muted fine">Estimated 1RM uses Epley: weight × (1 + reps / 30). A heavy set of 5 sits above the weight on the bar.</p> : null}
          </>
        )}
      </section>

      <section className="card stack">
        <h2>Running</h2>
        {runs.length === 0 ? (
          <p className="muted">No runs in this range.</p>
        ) : (
          <>
            {earlyPace && latePace && easy.length >= 4 ? (
              <p className="callout">
                Easy-run pace, first three versus last three: <strong>{formatPace(earlyPace)}</strong> → <strong>{formatPace(latePace)}</strong> /km.
              </p>
            ) : null}
            <h3>Weekly distance</h3>
            <div className="chart-box">
              <DistanceChart weeks={weeks} />
            </div>
            <h3>Pace</h3>
            <p className="muted fine">Faster is higher. Long runs are the ones titled “long” or 12 km and over.</p>
            <div className="chart-box">
              <PaceChart points={runs} />
            </div>
          </>
        )}
      </section>

      <section className="stack">
        <div className="split">
          <h2>Sessions</h2>
          <div className="filters" role="group" aria-label="Session type">
            {([
              ['all', 'All'],
              ['strength', 'Strength'],
              ['run', 'Runs'],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className={cx('chip', kind === id && 'on')} onClick={() => setKind(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {history.length === 0 ? (
          <p className="muted">Nothing in this range.</p>
        ) : (
          <ul className="session-list">
            {history.map((session) => (
              <li key={session.id}>
                <a className="session-link" href={`#/log/${session.id}`}>
                  <span>
                    <strong>{session.title}</strong>
                    <small>
                      {formatPretty(session.date)} · {session.kind === 'run' ? 'Run' : 'Strength'}
                      {session.effort ? ` · effort ${session.effort} ${effortLabel(session.effort)}` : ''}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
