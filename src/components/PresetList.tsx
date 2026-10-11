import { useState } from 'react';
import { SessionPreview } from './SessionPreview';
import { todayISO } from '../lib/dates';
import { logFromPreset } from '../lib/plans';
import { previewSession } from '../lib/preview';
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
  const [previewId, setPreviewId] = useState<string | null>(null);
  if (data.presets.length === 0) return null;
  const previewing = data.presets.find((preset) => preset.id === previewId) ?? null;

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
                <button type="button" className="btn ghost" onClick={() => setPreviewId(preset.id)}>
                  Preview
                </button>
                <button type="button" className="btn primary" onClick={() => onLog(logFromPreset(preset, data, todayISO()))}>
                  {preset.kind === 'run' ? 'Log' : 'Start'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <SessionPreview
        model={previewing ? previewSession(null, presetAsSession(previewing), todayISO(), data.sessions) : null}
        onClose={() => setPreviewId(null)}
        onStart={
          previewing && previewing.kind === 'strength'
            ? () => {
                const preset = previewing;
                setPreviewId(null);
                onLog(logFromPreset(preset, data, todayISO()));
              }
            : null
        }
      />
    </section>
  );
}

function presetAsSession(preset: WorkoutPreset): PlanSession {
  return {
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
}

function presetSummary(preset: WorkoutPreset): string {
  return describePlanSession(presetAsSession(preset));
}
