import { useState } from 'react';
import { ExerciseDemo } from './ExerciseDemo';
import { todayISO } from '../lib/dates';
import { findDemo } from '../lib/demos';
import { logFromPreset } from '../lib/plans';
import { describePlanSession } from '../lib/targets';
import type { LogPreset, PlanSession, TrainingData, WorkoutPreset } from '../types';

export function PresetList({ data, onLog }: { data: TrainingData; onLog: (preset: LogPreset) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [demoName, setDemoName] = useState<string | null>(null);
  if (data.presets.length === 0) return null;

  return (
    <section className="stack">
      <div>
        <h2>Workouts</h2>
        <p className="muted">Presets you can start on any day. Strength targets are sets and reps. A run counts when you do it.</p>
      </div>
      <ul className="preset-list">
        {data.presets.map((preset) => {
          const open = openId === preset.id;
          return (
            <li key={preset.id} className="card preset-card">
              <div>
                <p className="kicker">
                  {preset.focus ? `${preset.focus} · ` : ''}
                  {preset.kind === 'run' ? 'Run' : 'Strength'}
                </p>
                <h3>{preset.name}</h3>
                <p className="muted">{presetSummary(preset)}</p>
              </div>
              {preset.notes ? <p>{preset.notes}</p> : null}
              <div className="preset-actions">
                <button type="button" className="btn primary" onClick={() => onLog(logFromPreset(preset, data, todayISO()))}>
                  Start
                </button>
                {preset.kind === 'strength' ? (
                  <button
                    type="button"
                    className="btn ghost"
                    aria-expanded={open}
                    onClick={() => {
                      setOpenId(open ? null : preset.id);
                      setDemoName(null);
                    }}
                  >
                    {open ? 'Hide demos' : 'How to'}
                  </button>
                ) : null}
              </div>
              {open ? (
                <div className="stack">
                  {preset.exercises.map((exercise) => {
                    const shown = demoName === exercise.name;
                    const demo = findDemo(exercise.name);
                    return (
                      <div key={exercise.name}>
                        {demo ? (
                          <button
                            type="button"
                            className="btn ghost small"
                            aria-expanded={shown}
                            onClick={() => setDemoName(shown ? null : exercise.name)}
                          >
                            {exercise.name}
                          </button>
                        ) : (
                          <p>{exercise.name}</p>
                        )}
                        {shown ? <ExerciseDemo name={exercise.name} /> : null}
                      </div>
                    );
                  })}
                </div>
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
