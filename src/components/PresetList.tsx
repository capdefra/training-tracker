import { useState } from 'react';
import { ExerciseDemo } from './ExerciseDemo';
import { todayISO } from '../lib/dates';
import { logFromPreset } from '../lib/plans';
import { describePlanSession } from '../lib/targets';
import type { LogPreset, PlanSession, TrainingData, WorkoutPreset } from '../types';

export function PresetList({
  data,
  onLog,
  embedded = false,
}: {
  data: TrainingData;
  onLog: (preset: LogPreset) => void;
  embedded?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (data.presets.length === 0) return null;

  return (
    <section className="stack">
      {embedded ? (
        <p className="muted">Strength starts a session. A run is logged when you have done it.</p>
      ) : (
        <div>
          <h2>Workouts</h2>
          <p className="muted">Strength starts a session. A run is logged when you have done it.</p>
        </div>
      )}
      <ul className="preset-list">
        {data.presets.map((preset) => {
          const open = openId === preset.id;
          const summary = presetSummary(preset);
          return (
            <li key={preset.id} className="card preset-card">
              <div>
                <p className="kicker">
                  {preset.focus ? `${preset.focus} · ` : ''}
                  {preset.kind === 'run' ? 'Run' : 'Strength'}
                </p>
                <h3>{preset.name}</h3>
                <p className="muted">{summary}</p>
              </div>
              {preset.notes && preset.notes !== summary ? <p>{preset.notes}</p> : null}
              <div className="preset-actions">
                <button type="button" className="btn primary" onClick={() => onLog(logFromPreset(preset, data, todayISO()))}>
                  {preset.kind === 'run' ? 'Log' : 'Start'}
                </button>
                {preset.kind === 'strength' ? (
                  <button type="button" className="btn ghost" aria-expanded={open} onClick={() => setOpenId(open ? null : preset.id)}>
                    {open ? 'Hide exercises' : 'Exercises'}
                  </button>
                ) : null}
              </div>
              {open ? (
                <ul className="targets">
                  {preset.exercises.map((exercise) => (
                    <li key={exercise.name}>
                      <span className="target-name">{exercise.name}</span>
                      <ExerciseDemo name={exercise.name} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function presetSummary(preset: WorkoutPreset): string {
  const session: PlanSession = {
    id: preset.id,
    dayOfWeek: 1,
    kind: preset.kind,
    title: preset.name,
    focus: preset.focus,
    notes: preset.notes,
    exercises: preset.exercises,
    distanceKm: null,
    durationMin: null,
  };
  return describePlanSession(session);
}
