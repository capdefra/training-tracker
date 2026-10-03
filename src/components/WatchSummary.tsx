import { formatLong } from '../lib/dates';
import { effortLabel, formatDuration, formatKm, formatPace, trimNum } from '../lib/format';
import { sessionPaceSec } from '../lib/stats';
import type { Session, SessionWeather } from '../types';

export function WatchSummary({ session }: { session: Session }) {
  const pace = sessionPaceSec(session);
  const tiles = tilesFor(session, pace);
  const context = contextLine(session);
  const weather = session.weather ? weatherLine(session.weather) : '';
  const range = timeRange(session.startTime, session.endTime);

  return (
    <section className="card watch-card" aria-label="Watch summary">
      <div>
        <p className="kicker">Watch summary</p>
        <p className="watch-context">
          {formatLong(session.date)}
          {range ? ` · ${range}` : ''}
        </p>
        {context ? <p className="watch-context">{context}</p> : null}
      </div>
      {tiles.length > 0 ? (
        <div className="metric-grid">
          {tiles.map((tile) => (
            <div key={tile.label} className="metric">
              <span>{tile.label}</span>
              <strong>
                {tile.value}
                {tile.unit ? <small> {tile.unit}</small> : null}
              </strong>
            </div>
          ))}
        </div>
      ) : null}
      {weather ? <p className="watch-context">{weather}</p> : null}
      {session.splits.length > 0 ? <Splits splits={session.splits} /> : null}
    </section>
  );
}

function Splits({ splits }: { splits: Session['splits'] }) {
  return (
    <div className="splits-wrap">
      <table className="splits">
        <caption className="sr-only">Per kilometre splits</caption>
        <thead>
          <tr>
            <th>Km</th>
            <th>Time</th>
            <th>Pace</th>
            <th>HR</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((split) => (
            <tr key={`${split.km}-${split.timeSec}`}>
              <td>{split.km}</td>
              <td>{split.timeSec > 0 ? formatDuration(split.timeSec) : '—'}</td>
              <td>{split.paceSec ? formatPace(split.paceSec) : '—'}</td>
              <td>{split.heartRate ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function tilesFor(session: Session, pace: number | null): { label: string; value: string; unit?: string }[] {
  const tiles: { label: string; value: string; unit?: string }[] = [];
  if (session.distanceKm) tiles.push({ label: 'Distance', value: formatKm(session.distanceKm), unit: 'km' });
  if (session.durationSec) tiles.push({ label: 'Time', value: formatDuration(session.durationSec) });
  if (pace) tiles.push({ label: 'Pace', value: formatPace(pace), unit: '/km' });
  if (session.heartRate) tiles.push({ label: 'Heart rate', value: String(Math.round(session.heartRate)), unit: 'bpm' });
  if (session.activeKcal) tiles.push({ label: 'Active', value: String(session.activeKcal), unit: 'kcal' });
  if (session.totalKcal) tiles.push({ label: 'Total', value: String(session.totalKcal), unit: 'kcal' });
  if (session.elevationM !== null) tiles.push({ label: 'Elevation', value: String(Math.round(session.elevationM)), unit: 'm' });
  if (session.cadenceSpm) tiles.push({ label: 'Cadence', value: String(session.cadenceSpm), unit: 'spm' });
  if (session.powerW) tiles.push({ label: 'Power', value: String(session.powerW), unit: 'W' });
  if (session.effort) tiles.push({ label: 'Effort', value: String(session.effort), unit: effortLabel(session.effort) });
  return tiles;
}

function contextLine(session: Session): string {
  const activity = session.activity.trim();
  const sameAsTitle = activity.toLowerCase() === session.title.trim().toLowerCase();
  return [sameAsTitle ? '' : activity, session.place.trim(), session.source.trim()].filter(Boolean).join(' · ');
}

function timeRange(start: string, end: string): string {
  if (start && end) return `${start}–${end}`;
  return start || end;
}

function weatherLine(weather: SessionWeather): string {
  const bits: string[] = [];
  if (weather.tempC !== null) bits.push(`${trimNum(weather.tempC)}°`);
  if (weather.humidityPct !== null) bits.push(`humidity ${weather.humidityPct}%`);
  if (weather.airQuality !== null) bits.push(`air quality ${weather.airQuality}`);
  return bits.join(' · ');
}
