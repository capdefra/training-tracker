import { findDemo } from '../lib/demos';

export function ExerciseDemo({ name }: { name: string }) {
  const demo = findDemo(name);
  if (!demo) return null;
  return (
    <a className="form-link" href={demo.href} target="_blank" rel="noopener noreferrer" title={`${demo.title} on wger`}>
      Form
      <span className="sr-only"> for {name}</span>
    </a>
  );
}
