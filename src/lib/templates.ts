import type { PlanSession } from '../types';
import { uid } from './ids';

export function skiBaseSessions(): PlanSession[] {
  return [
    {
      id: uid('ps'),
      dayOfWeek: 1,
      kind: 'strength',
      title: 'Lower body',
      focus: 'Legs',
      notes: 'Main squat day. Add load when all five sets are solid.',
      exercises: [
        { name: 'Back squat', sets: 5, reps: '5' },
        { name: 'Romanian deadlift', sets: 3, reps: '8' },
        { name: 'Walking lunge', sets: 3, reps: '8' },
        { name: 'Calf raise', sets: 3, reps: '12' },
      ],
      distanceKm: null,
      durationMin: null,
    },
    {
      id: uid('ps'),
      dayOfWeek: 2,
      kind: 'run',
      title: 'Easy run',
      focus: 'Cardio',
      notes: 'Conversational pace.',
      exercises: [],
      distanceKm: 8,
      durationMin: 45,
    },
    {
      id: uid('ps'),
      dayOfWeek: 3,
      kind: 'strength',
      title: 'Balance',
      focus: 'Balance',
      notes: 'Slow eccentrics. Match the load to the weaker side.',
      exercises: [
        { name: 'Bulgarian split squat', sets: 3, reps: '8' },
        { name: 'Single-leg RDL', sets: 3, reps: '8' },
        { name: 'Step-down', sets: 3, reps: '8' },
      ],
      distanceKm: null,
      durationMin: null,
    },
    {
      id: uid('ps'),
      dayOfWeek: 5,
      kind: 'strength',
      title: 'Posterior chain',
      focus: 'Legs',
      notes: 'Hinge and hips.',
      exercises: [
        { name: 'Hip thrust', sets: 3, reps: '8' },
        { name: 'Deadlift', sets: 3, reps: '5' },
        { name: 'Nordic curl', sets: 3, reps: '6' },
        { name: 'Side plank', sets: 3, reps: '30' },
      ],
      distanceKm: null,
      durationMin: null,
    },
    {
      id: uid('ps'),
      dayOfWeek: 6,
      kind: 'run',
      title: 'Long run',
      focus: 'Cardio',
      notes: 'Steady effort, with a hill if the route has one.',
      exercises: [],
      distanceKm: 14,
      durationMin: 85,
    },
  ];
}
