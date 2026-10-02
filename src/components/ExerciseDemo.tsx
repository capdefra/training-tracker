import { findDemo } from '../lib/demos';
import { MovementFigure } from './MovementFigure';

export function ExerciseDemo({ name }: { name: string }) {
  const demo = findDemo(name);
  if (!demo) return null;
  return (
    <div className="demo">
      <MovementFigure start={demo.start} end={demo.end} phases={demo.phases} />
      <ol className="cues">
        {demo.cues.map((cue) => (
          <li key={cue}>{cue}</li>
        ))}
      </ol>
      <p className="muted fine">{demo.watch}</p>
    </div>
  );
}
