import { useEffect, useState } from 'react';
import { lerpPose, limbSegments, type FigurePose, type XY } from '../lib/figure';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return reduced;
}

function ease(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function cycleToT(cycle: number): number {
  if (cycle < 0.12) return 0;
  if (cycle < 0.48) return ease((cycle - 0.12) / 0.36);
  if (cycle < 0.64) return 1;
  return 1 - ease((cycle - 0.64) / 0.36);
}

export function MovementFigure({
  start,
  end,
  phases,
}: {
  start: FigurePose;
  end: FigurePose;
  phases: [string, string];
}) {
  const reduced = useReducedMotion();
  const [t, setT] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const cycle = ((now - started) % 2800) / 2800;
      setT(cycleToT(cycle));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [reduced]);

  if (reduced) {
    return (
      <div className="figure-pair">
        <FigureFrame pose={start} label={phases[0]} />
        <FigureFrame pose={end} label={phases[1]} />
      </div>
    );
  }

  const pose = lerpPose(start, end, t);
  return <FigureFrame pose={pose} label={t < 0.5 ? phases[0] : phases[1]} />;
}

function FigureFrame({ pose, label }: { pose: FigurePose; label: string }) {
  return (
    <figure className="figure">
      <svg viewBox="0 0 200 220" aria-hidden="true">
        <line className="ground" x1="20" y1="200" x2="180" y2="200" />
        {pose.gear.map((segment, index) => (
          <Segment key={`gear-${index}`} segment={segment} className="gear" />
        ))}
        {limbSegments(pose).map((segment, index) => (
          <Segment key={`limb-${index}`} segment={segment} className="limb" />
        ))}
        <circle className="head" cx={pose.head[0]} cy={pose.head[1]} r="11" />
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function Segment({ segment, className }: { segment: [XY, XY]; className: string }) {
  const [start, end] = segment;
  if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 1) return null;
  return <line className={className} x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />;
}
