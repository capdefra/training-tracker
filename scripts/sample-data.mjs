// Writes the starter log: ski-season goal, phased home plan, presets, and no sessions.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { starterDocument } from '../src/lib/templates.ts';

const data = starterDocument();
const plan = data.plans[0];

if (data.sessions.length !== 0) throw new Error('Starter log must not include sessions');
if (!plan || plan.id !== 'plan-ski-home') throw new Error('Starter plan should be the home ski plan');
if (plan.phases?.length !== 6) throw new Error('Starter plan should have six phases');
if (plan.endDate !== '2026-12-13') throw new Error('Starter plan should end on 13 Dec 2026');
if (data.goals[0]?.targetDate !== '2026-12-15') throw new Error('Goal should aim at 15 Dec 2026');
if (data.presets.length !== 5) throw new Error('Expected five presets');
if (data.plans.some((item) => item.id === 'plan-ski-base')) throw new Error('Old repeating plan is still active');
if (data.plans.some((item) => item.sessions.some((session) => session.exercises.some((exercise) => exercise.name === 'Back squat')))) {
  throw new Error('Old lower-body week is still in the starter');
}
if (!data.deleted.plans.some((item) => item.id === 'plan-ski-base')) throw new Error('Old plan should stay in the deletion list');

for (const session of plan.sessions) {
  if (session.kind === 'run' && session.distanceKm !== null) throw new Error(`${session.title} should not have a distance target`);
  for (const exercise of session.exercises) {
    if ('weightKg' in exercise) throw new Error(`${exercise.name} target must not include weight`);
    if (!exercise.sets || !exercise.reps) throw new Error(`${exercise.name} needs sets and reps`);
  }
}
const holds = plan.sessions.flatMap((session) => session.exercises).filter((exercise) => exercise.count === 'seconds');
if (!holds.some((exercise) => exercise.name === 'Side plank')) throw new Error('Side plank target should be seconds');
if (!holds.some((exercise) => exercise.name === 'Suitcase carry')) throw new Error('Suitcase carry target should be seconds');

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'training.json');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Wrote ${data.sessions.length} sessions, ${data.presets.length} presets, and ${plan.phases.length} phases to ${file}`);
