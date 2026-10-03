import { useState } from 'react';
import { Field } from './Field';
import { blankSplit, type Draft } from '../lib/draft';
import { effortLabel } from '../lib/format';
import { cx } from '../lib/cx';

const ACTIVITIES = ['Outdoor run', 'Indoor run'];

export function RunWatchFields({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: (value: Draft | ((current: Draft) => Draft)) => void;
}) {
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="stack">
      <p className="muted fine">Logged after the run. Distance, time, and the rest of the watch summary are optional. Saving still counts for the week.</p>
      <Field label="Activity">
        <input value={draft.activity} onChange={(event) => update('activity', event.target.value)} placeholder="Outdoor run" maxLength={80} />
      </Field>
      <div className="chips" aria-label="Activity">
        {ACTIVITIES.map((activity) => (
          <button key={activity} type="button" className={cx('chip', draft.activity === activity && 'on')} onClick={() => update('activity', activity)}>
            {activity}
          </button>
        ))}
      </div>
      <div className="form-grid two">
        <Field label="Place">
          <input value={draft.place} onChange={(event) => update('place', event.target.value)} placeholder="City" maxLength={80} />
        </Field>
        <Field label="Source">
          <input value={draft.source} onChange={(event) => update('source', event.target.value)} placeholder="Apple Watch" maxLength={80} />
        </Field>
      </div>
      <div className="chips">
        <button type="button" className={cx('chip', draft.source === 'Apple Watch' && 'on')} onClick={() => update('source', 'Apple Watch')}>
          Apple Watch
        </button>
      </div>
      <div className="form-grid two">
        <Field label="Start">
          <input type="time" value={draft.startTime} onChange={(event) => update('startTime', event.target.value)} />
        </Field>
        <Field label="Finish">
          <input type="time" value={draft.endTime} onChange={(event) => update('endTime', event.target.value)} />
        </Field>
      </div>
      <div className="form-grid two">
        <Field label="Distance (km)" hint={draft.distanceHint}>
          <input inputMode="decimal" value={draft.distanceKm} onChange={(event) => update('distanceKm', event.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Workout time" hint={draft.durationHint || '33:57, or minutes'}>
          <input inputMode="numeric" value={draft.duration} onChange={(event) => update('duration', event.target.value)} placeholder="33:57" />
        </Field>
      </div>
      <div className="form-grid two">
        <Field label="Active kcal">
          <input inputMode="numeric" value={draft.activeKcal} onChange={(event) => update('activeKcal', event.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Total kcal">
          <input inputMode="numeric" value={draft.totalKcal} onChange={(event) => update('totalKcal', event.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <div className="form-grid two">
        <Field label="Elevation (m)">
          <input inputMode="decimal" value={draft.elevationM} onChange={(event) => update('elevationM', event.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Power (W)">
          <input inputMode="numeric" value={draft.power} onChange={(event) => update('power', event.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <div className="form-grid two">
        <Field label="Cadence (spm)">
          <input inputMode="numeric" value={draft.cadence} onChange={(event) => update('cadence', event.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Pace /km">
          <input inputMode="numeric" value={draft.pace} onChange={(event) => update('pace', event.target.value)} placeholder="6:42" />
        </Field>
      </div>
      <Field label="Heart rate (bpm)">
        <input inputMode="numeric" value={draft.heartRate} onChange={(event) => update('heartRate', event.target.value)} placeholder="Optional" />
      </Field>
      <EffortField value={draft.effort} onChange={(effort) => update('effort', effort)} />
      <div className="form-grid two">
        <Field label="Temperature (°C)">
          <input inputMode="decimal" value={draft.tempC} onChange={(event) => update('tempC', event.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Humidity (%)">
          <input inputMode="numeric" value={draft.humidity} onChange={(event) => update('humidity', event.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <Field label="Air quality">
        <input inputMode="numeric" value={draft.airQuality} onChange={(event) => update('airQuality', event.target.value)} placeholder="Optional" />
      </Field>
      <div className="stack">
        <p className="kicker">Splits</p>
        <p className="muted fine">One row per kilometre. Time, pace, and heart rate.</p>
        {draft.splits.length > 0 ? (
          <div className="split-head" aria-hidden="true">
            <span />
            <span>Time</span>
            <span>Pace</span>
            <span>HR</span>
            <span />
          </div>
        ) : null}
        {draft.splits.map((split, index) => (
          <div key={split.key} className="split-row">
            <span>{index + 1}</span>
            <input
              inputMode="numeric"
              aria-label={`Split ${index + 1} time`}
              value={split.time}
              placeholder="6:48"
              onChange={(event) => patchSplit(setDraft, split.key, 'time', event.target.value)}
            />
            <input
              inputMode="numeric"
              aria-label={`Split ${index + 1} pace`}
              value={split.pace}
              placeholder="6:48"
              onChange={(event) => patchSplit(setDraft, split.key, 'pace', event.target.value)}
            />
            <input
              inputMode="numeric"
              aria-label={`Split ${index + 1} heart rate`}
              value={split.heartRate}
              placeholder="bpm"
              onChange={(event) => patchSplit(setDraft, split.key, 'heartRate', event.target.value)}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove split ${index + 1}`}
              onClick={() => setDraft((current) => ({ ...current, splits: current.splits.filter((item) => item.key !== split.key) }))}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="btn ghost small" onClick={() => setDraft((current) => ({ ...current, splits: [...current.splits, blankSplit()] }))}>
          Add split
        </button>
      </div>
    </div>
  );
}

export function StrengthWatchFields({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: (value: Draft | ((current: Draft) => Draft)) => void;
}) {
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  const [expanded, setExpanded] = useState(() =>
    Boolean(draft.duration || draft.heartRate || draft.activeKcal || draft.totalKcal || draft.effort || draft.place || draft.source),
  );

  return (
    <details className="card" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary>Heart rate and calories</summary>
      <div className="stack inset">
        <p className="muted fine">Optional. A strength workout on the watch has time, heart rate, calories, and effort.</p>
        <div className="form-grid two">
          <Field label="Workout time">
            <input inputMode="numeric" value={draft.duration} onChange={(event) => update('duration', event.target.value)} placeholder="45:00" />
          </Field>
          <Field label="Heart rate (bpm)">
            <input inputMode="numeric" value={draft.heartRate} onChange={(event) => update('heartRate', event.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <div className="form-grid two">
          <Field label="Active kcal">
            <input inputMode="numeric" value={draft.activeKcal} onChange={(event) => update('activeKcal', event.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Total kcal">
            <input inputMode="numeric" value={draft.totalKcal} onChange={(event) => update('totalKcal', event.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <EffortField value={draft.effort} onChange={(effort) => update('effort', effort)} />
      </div>
    </details>
  );
}

function EffortField({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div className="field">
      <span>Effort, 1 easy to 10 all out</span>
      <div className="effort" role="group" aria-label="Effort">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((step) => (
          <button
            key={step}
            type="button"
            className={cx(value === step && 'on')}
            onClick={() => onChange(value === step ? null : step)}
            aria-pressed={value === step}
          >
            {step}
          </button>
        ))}
      </div>
      <small>{value ? `${value} · ${effortLabel(value)}` : '1–3 easy, 4–6 moderate, 7–8 hard, 9–10 all out'}</small>
    </div>
  );
}

function patchSplit(
  setDraft: (value: Draft | ((current: Draft) => Draft)) => void,
  key: string,
  field: 'time' | 'pace' | 'heartRate',
  value: string,
) {
  setDraft((current) => ({
    ...current,
    splits: current.splits.map((split) => (split.key === key ? { ...split, [field]: value } : split)),
  }));
}
