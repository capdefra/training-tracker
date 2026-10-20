import type { ExerciseEntry, Plan, PlanExercise, PlanSession, Session, SessionKind } from '../types';
import { formatPretty } from './dates';
import { trimNum } from './format';
import { findDemo } from './demos';
import { exerciseGear, gearLabel, sessionGear, visiblePhaseNotes } from './equipment';
import { defaultLoad } from './load';
import { lastLoggedExercise, resolveExerciseTarget, usableTarget } from './load-target';
import { phaseOn } from './plans';
import { effortLabel, sideSuffix } from './per-side';
import { repsLabel } from './targets';

export interface ExercisePreview {
  name: string;
  /** Plan sets × reps for this date, before a per-exercise load target replaces the set count. */
  planLabel: string;
  /** Phase target, then the exercise target, then the plan, with the last logged weight when no target weight is set. */
  targetLabel: string;
  /** Empty when this exercise has no log. */
  lastLabel: string;
  notes: string;
  /** Empty when this exercise needs nothing beyond the body. */
  equipmentLabel: string;
  hasDemo: boolean;
}

export interface SessionPreviewModel {
  title: string;
  date: string;
  dateLabel: string;
  kind: SessionKind;
  phaseName: string;
  /** Phase notes with a loads summary removed. Empty when nothing useful remains. */
  phaseNotes: string;
  /** Deduplicated gear for a strength session. Empty for a run. */
  equipmentLabel: string;
  runLine: string;
  exercises: ExercisePreview[];
}

function exerciseNote(exercise: PlanExercise): string {
  const notes = (exercise as PlanExercise & { notes?: unknown }).notes;
  return typeof notes === 'string' ? notes.trim() : '';
}

function formatLast(previous: ExerciseEntry | null, side = ''): string {
  if (!previous || previous.sets.length === 0) return '';
  const weighted = [...previous.sets].reverse().find((set) => set.weightKg > 0);
  const ref = weighted ?? previous.sets[previous.sets.length - 1];
  if (!ref) return '';
  const sets = previous.sets.length;
  if (!weighted) return `Last: ${sets}×${ref.reps}${side}`;
  if (previous.pieces) {
    const per = weighted.kgPerPiece && weighted.kgPerPiece > 0 ? weighted.kgPerPiece : weighted.weightKg / previous.pieces;
    return `Last: ${sets}×${ref.reps}${side} @ ${trimNum(per)} kg`;
  }
  return `Last: ${sets}×${ref.reps}${side} @ ${trimNum(weighted.weightKg)} kg total`;
}

function lastPerPiece(previous: ExerciseEntry | null): { kg: number; perPiece: boolean } | null {
  if (!previous) return null;
  const weighted = [...previous.sets].reverse().find((set) => set.weightKg > 0);
  if (!weighted) return null;
  if (previous.pieces) {
    const per = weighted.kgPerPiece && weighted.kgPerPiece > 0 ? weighted.kgPerPiece : weighted.weightKg / previous.pieces;
    return { kg: per, perPiece: true };
  }
  return { kg: weighted.weightKg, perPiece: false };
}

function targetLine(sets: number, repsText: string, weight: { kg: number; perPiece: boolean } | null): string {
  if (!weight) return `Target: ${sets}×${repsText}`;
  const unit = weight.perPiece ? 'kg per piece' : 'kg total';
  return `Target: ${sets}×${repsText} @ ${trimNum(weight.kg)} ${unit}`;
}

/**
 * Preview for one session on `date`.
 * `date` is the selected day, or today when the plan list has no other day selected.
 * A moved occurrence passes the day the card shows, which is also the phase date.
 */
export function previewSession(plan: Plan | null, session: PlanSession, date: string, logs: Session[]): SessionPreviewModel {
  const phase = plan ? phaseOn(plan, date) : null;
  const change = phase?.sessions.find((item) => item.sessionId === session.id);
  const phaseNotes = visiblePhaseNotes(change?.notes?.trim() ?? '');
  const exercises = session.kind === 'strength'
    ? session.exercises.map((exercise) => {
        const plannedSets = change?.sets ?? exercise.sets;
        const resolved = plan ? resolveExerciseTarget(phase, session.id, exercise) : usableTarget(exercise.target);
        const sets = resolved?.sets ?? plannedSets;
        const repsText = resolved?.reps !== undefined ? effortLabel(exercise, String(resolved.reps)) : repsLabel(exercise);
        const history = lastLoggedExercise(logs, exercise);
        const bodyweight = defaultLoad(exercise.name).kind === 'bodyweight';
        const loggedWeight = bodyweight ? null : lastPerPiece(history);
        const weight = !bodyweight && resolved?.weightKg !== undefined
          ? { kg: resolved.weightKg, perPiece: true }
          : loggedWeight;
        return {
          name: exercise.name,
          planLabel: `${plannedSets}×${repsLabel(exercise)}`,
          targetLabel: targetLine(sets, repsText, weight),
          lastLabel: formatLast(history, sideSuffix(exercise)),
          notes: exerciseNote(exercise),
          equipmentLabel: gearLabel(exerciseGear(exercise), ' · '),
          hasDemo: findDemo(exercise.name) !== undefined,
        };
      })
    : [];
  const runNotes = phaseNotes || session.notes.trim();
  return {
    title: session.title,
    date,
    dateLabel: formatPretty(date),
    kind: session.kind,
    phaseName: phase?.name ?? '',
    phaseNotes,
    equipmentLabel: session.kind === 'strength' ? gearLabel(sessionGear(session.exercises), ', ') : '',
    runLine: session.kind === 'run' ? runNotes || 'Do the run' : '',
    exercises,
  };
}
