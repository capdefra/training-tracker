import type { Draft, SplitDraft } from './draft';
import { parseDuration, parseNum, parsePace } from './format';
import type { RunSplit, Session, SessionWeather } from '../types';

export interface WatchInput {
  durationSec: number | null;
  paceSec: number | null;
  heartRate: number | null;
  activeKcal: number | null;
  totalKcal: number | null;
  cadenceSpm: number | null;
  powerW: number | null;
  elevationM: number | null;
  place: string;
  source: string;
  activity: string;
  startTime: string;
  endTime: string;
  weather: SessionWeather | null;
  splits: RunSplit[];
  effort: number | null;
}

function readCount(label: string, raw: string): number | null | string {
  const parsed = parseNum(raw);
  if (parsed === null) return null;
  if (parsed < 0) return `${label} can’t be negative.`;
  return Math.round(parsed);
}

function clockInput(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function readWeather(draft: Draft): SessionWeather | null | string {
  const temp = parseNum(draft.tempC);
  const humidity = parseNum(draft.humidity);
  const air = parseNum(draft.airQuality);
  if (draft.tempC.trim() && temp === null) return 'Temperature needs to be a number.';
  if (draft.humidity.trim() && humidity === null) return 'Humidity needs to be a number.';
  if (humidity !== null && (humidity < 0 || humidity > 100)) return 'Humidity needs to be between 0 and 100.';
  if (draft.airQuality.trim() && air === null) return 'Air quality needs to be a number.';
  if (air !== null && air < 0) return 'Air quality can’t be negative.';
  if (temp === null && humidity === null && air === null) return null;
  return {
    tempC: temp === null ? null : Math.round(temp * 10) / 10,
    humidityPct: humidity === null ? null : Math.round(humidity),
    airQuality: air === null ? null : Math.round(air),
  };
}

function readSplits(rows: SplitDraft[]): RunSplit[] | string {
  const splits: RunSplit[] = [];
  for (const [index, row] of rows.entries()) {
    const timeBlank = row.time.trim() === '';
    const paceBlank = row.pace.trim() === '';
    const hrBlank = row.heartRate.trim() === '';
    if (timeBlank && paceBlank && hrBlank) continue;
    const label = `Split ${index + 1}`;
    const timeSec = timeBlank ? 0 : parseDuration(row.time);
    if (timeSec === null || timeSec < 0) return `${label} time should look like 6:48.`;
    const paceSec = paceBlank ? null : parsePace(row.pace);
    if (!paceBlank && paceSec === null) return `${label} pace should look like 6:42.`;
    const heartRate = hrBlank ? null : readCount('Heart rate', row.heartRate);
    if (typeof heartRate === 'string') return `${label}: ${heartRate}`;
    splits.push({ km: splits.length + 1, timeSec, paceSec, heartRate });
  }
  return splits;
}

export function readWatch(draft: Draft, run: boolean): WatchInput | string {
  const durationSec = draft.duration.trim() ? parseDuration(draft.duration) : null;
  if (draft.duration.trim() && (durationSec === null || durationSec < 0)) return 'Workout time should look like 33:57.';
  const paceSec = run && draft.pace.trim() ? parsePace(draft.pace) : null;
  if (run && draft.pace.trim() && paceSec === null) return 'Pace should look like 6:42.';

  const heartRate = readCount('Heart rate', draft.heartRate);
  if (typeof heartRate === 'string') return heartRate;
  const activeKcal = readCount('Active calories', draft.activeKcal);
  if (typeof activeKcal === 'string') return activeKcal;
  const totalKcal = readCount('Total calories', draft.totalKcal);
  if (typeof totalKcal === 'string') return totalKcal;
  const cadenceSpm = run ? readCount('Cadence', draft.cadence) : null;
  if (typeof cadenceSpm === 'string') return cadenceSpm;
  const powerW = run ? readCount('Power', draft.power) : null;
  if (typeof powerW === 'string') return powerW;

  const elevation = run ? parseNum(draft.elevationM) : null;
  if (run && draft.elevationM.trim() && elevation === null) return 'Elevation needs to be a number.';
  if (elevation !== null && elevation < 0) return 'Elevation can’t be negative.';

  const startTime = clockInput(draft.startTime);
  const endTime = clockInput(draft.endTime);
  if (draft.startTime.trim() && !startTime) return 'Start time should look like 11:30.';
  if (draft.endTime.trim() && !endTime) return 'Finish time should look like 12:03.';

  const weather = readWeather(draft);
  if (typeof weather === 'string') return weather;
  const splits = run ? readSplits(draft.splits) : [];
  if (typeof splits === 'string') return splits;

  return {
    durationSec: durationSec && durationSec > 0 ? durationSec : null,
    paceSec,
    heartRate: heartRate && heartRate > 0 ? heartRate : null,
    activeKcal: activeKcal && activeKcal > 0 ? activeKcal : null,
    totalKcal: totalKcal && totalKcal > 0 ? totalKcal : null,
    cadenceSpm: cadenceSpm && cadenceSpm > 0 ? cadenceSpm : null,
    powerW: powerW && powerW > 0 ? powerW : null,
    elevationM: elevation === null ? null : elevation,
    place: draft.place.trim(),
    source: draft.source.trim(),
    activity: draft.activity.trim(),
    startTime,
    endTime,
    weather,
    splits,
    effort: draft.effort,
  };
}

export function hasDisplayedMetrics(session: Session): boolean {
  return Boolean(
    session.distanceKm ||
      session.durationSec ||
      session.paceSec ||
      session.heartRate ||
      session.activeKcal ||
      session.totalKcal ||
      session.elevationM ||
      session.cadenceSpm ||
      session.powerW ||
      session.effort ||
      session.place ||
      session.source ||
      session.activity ||
      session.startTime ||
      session.endTime ||
      session.weather ||
      session.splits.length > 0,
  );
}
