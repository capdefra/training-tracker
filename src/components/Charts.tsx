import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { formatDayMonth } from '../lib/dates';
import { formatPace } from '../lib/format';
import type { LiftPoint, RunPoint, WeekDistance } from '../lib/stats';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = 'Outfit, sans-serif';
ChartJS.defaults.color = '#5e584e';

const grid = '#e6dfd3';
const spruce = '#1e4d3a';
const ember = '#c4491d';

export function LiftChart({ points, mode }: { points: LiftPoint[]; mode: 'load' | 'reps' }) {
  const labels = points.map((point) => formatDayMonth(point.date));
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12 } },
      tooltip: {
        callbacks: {
          label(context) {
            const point = points[context.dataIndex];
            if (!point) return '';
            if (mode === 'reps') return `${point.reps} reps`;
            if (context.dataset.label === 'Estimated 1RM') return `e1RM ${point.e1rm} kg`;
            return point.loadLabel ? `Top set ${point.loadLabel} × ${point.reps}` : `Top set ${point.weightKg} kg total × ${point.reps}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: grid }, ticks: { precision: 0 } },
    },
  };
  const datasets =
    mode === 'reps'
      ? [{ label: 'Reps', data: points.map((point) => point.reps), borderColor: spruce, backgroundColor: spruce, tension: 0.25 }]
      : [
          { label: 'Top set', data: points.map((point) => point.weightKg), borderColor: spruce, backgroundColor: spruce, tension: 0.25 },
          { label: 'Estimated 1RM', data: points.map((point) => point.e1rm), borderColor: ember, backgroundColor: ember, tension: 0.25, borderDash: [4, 4] },
        ];
  return <Line options={options} data={{ labels, datasets }} />;
}

export function DistanceChart({ weeks }: { weeks: WeekDistance[] }) {
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: grid }, title: { display: true, text: 'km' } },
    },
  };
  return (
    <Bar
      options={options}
      data={{
        labels: weeks.map((week) => week.label),
        datasets: [{ label: 'Kilometres', data: weeks.map((week) => week.km), backgroundColor: spruce, borderRadius: 6 }],
      }}
    />
  );
}

export function PaceChart({ points }: { points: RunPoint[] }) {
  const dates = [...new Set(points.map((point) => point.date))].sort();
  const paceAt = (date: string, long: boolean) => {
    const point = points.find((item) => item.date === date && item.long === long);
    return point ? Math.round(point.paceSec) : null;
  };
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12 } },
      tooltip: {
        callbacks: {
          label(context) {
            const value = context.parsed.y;
            if (value === null || Number.isNaN(value)) return '';
            return `${context.dataset.label}: ${formatPace(value)} /km`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        reverse: true,
        grid: { color: grid },
        ticks: {
          callback(value) {
            return formatPace(Number(value));
          },
        },
      },
    },
  };
  return (
    <Line
      options={options}
      data={{
        labels: dates.map((date) => formatDayMonth(date)),
        datasets: [
          { label: 'Easy', data: dates.map((date) => paceAt(date, false)), borderColor: spruce, backgroundColor: spruce, spanGaps: true, tension: 0.25 },
          { label: 'Long', data: dates.map((date) => paceAt(date, true)), borderColor: ember, backgroundColor: ember, spanGaps: true, tension: 0.25 },
        ],
      }}
    />
  );
}
