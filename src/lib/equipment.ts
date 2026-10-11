import type { PlanExercise } from '../types';
import { defaultLoad } from './load';

export interface GearItem {
  key: string;
  label: string;
}

const BENCH = new Set([
  'goblet squat',
  'bulgarian split squat',
  'step-up',
  'chest-supported row',
  'flat dumbbell bench press',
  'one-arm dumbbell row',
  'incline press',
  'rear-delt raise',
  'single-leg hip thrust',
  'hip thrust',
]);

const MAT = new Set(['side plank', 'dead bug', 'push-up', 'pushup']);

const ORDER = ['dumbbell', 'kettlebell', 'bench', 'band', 'mat'];

/**
 * Gear for one exercise.
 * A written `equipment` list is the whole answer. Otherwise the piece choice
 * (one kettlebell, one dumbbell, or a pair) and the home-plan extras apply.
 */
export function exerciseGear(exercise: PlanExercise): GearItem[] {
  const written = exercise.equipment?.map((item) => item.trim()).filter(Boolean) ?? [];
  if (written.length > 0) return mergeGear(written.map(parseGear));
  const inferred: GearItem[] = [];
  const load = defaultLoad(exercise.name);
  if (load.kind === 'loaded') inferred.push(bell(load.implement, load.pieces));
  const key = exercise.name.trim().toLowerCase();
  if (BENCH.has(key)) inferred.push({ key: 'bench', label: 'bench' });
  if (MAT.has(key) || key.includes('plank')) inferred.push({ key: 'mat', label: 'mat' });
  if (key.includes('band')) inferred.push({ key: 'band', label: 'resistance band' });
  return mergeGear(inferred);
}

/** One list for the session. Two dumbbells covers an exercise that needs only one. */
export function sessionGear(exercises: PlanExercise[]): GearItem[] {
  return mergeGear(exercises.flatMap(exerciseGear));
}

export function gearLabel(items: GearItem[], separator: string): string {
  return items.map((item) => item.label).join(separator);
}

function bell(implement: 'dumbbell' | 'kettlebell', pieces: 1 | 2): GearItem {
  if (implement === 'kettlebell') return { key: 'kettlebell', label: pieces >= 2 ? '2× kettlebells' : 'kettlebell' };
  return { key: 'dumbbell', label: pieces >= 2 ? '2× dumbbells' : 'dumbbell' };
}

function parseGear(raw: string): GearItem {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  let pieces: 1 | 2 | undefined;
  let rest = cleaned;
  const counted = /^(\d+)\s*[x×]\s+(.+)$/.exec(cleaned);
  if (counted) {
    pieces = Number(counted[1]) >= 2 ? 2 : 1;
    rest = counted[2] ?? cleaned;
  } else if (/^(a pair of|pair of)\s+/.test(cleaned)) {
    pieces = 2;
    rest = cleaned.replace(/^(a pair of|pair of)\s+/, '');
  }
  const singular = rest.endsWith('s') ? rest.slice(0, -1) : rest;
  if (singular === 'dumbbell' || rest === 'dumbbell') {
    const count = pieces ?? (rest.endsWith('s') ? 2 : 1);
    return bell('dumbbell', count);
  }
  if (singular === 'kettlebell' || rest === 'kettlebell') {
    const count = pieces ?? (rest.endsWith('s') ? 2 : 1);
    return bell('kettlebell', count);
  }
  if (rest === 'bench' || singular === 'bench') return { key: 'bench', label: 'bench' };
  if (rest === 'mat' || rest === 'exercise mat' || singular === 'mat') return { key: 'mat', label: 'mat' };
  if (rest === 'band' || rest === 'resistance band' || singular === 'band' || singular === 'resistance band') {
    return { key: 'band', label: 'resistance band' };
  }
  return { key: cleaned, label: raw.trim() };
}

function mergeGear(items: GearItem[]): GearItem[] {
  const map = new Map<string, GearItem>();
  for (const item of items) {
    const previous = map.get(item.key);
    if (!previous) {
      map.set(item.key, { ...item });
      continue;
    }
    const nextCount = pieceCount(item.label);
    const prevCount = pieceCount(previous.label);
    if (nextCount > prevCount) map.set(item.key, { ...item });
  }
  return [...map.values()].sort((a, b) => {
    const ai = ORDER.indexOf(a.key);
    const bi = ORDER.indexOf(b.key);
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function pieceCount(label: string): number {
  const match = /^(\d+)\s*[x×]\s+/.exec(label);
  return match ? Number(match[1]) : 1;
}

/**
 * Phase notes shown above the exercise list.
 * A "Loads:" summary, and a note that is only sets × reps at a weight, repeat the cards.
 * Coaching and run notes stay.
 */
export function visiblePhaseNotes(notes: string): string {
  const paragraphs = notes.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const paragraph of paragraphs) {
    if (/^loads\s*:/i.test(paragraph)) {
      const body = paragraph.replace(/^loads\s*:\s*/i, '').trim();
      const rest = coachingAfterLoads(body);
      if (rest) kept.push(rest);
      continue;
    }
    if (isOnlyLoadPrescription(paragraph)) continue;
    kept.push(paragraph);
  }
  return kept.join('\n');
}

function coachingAfterLoads(body: string): string {
  const sentences = body.split(/(?<=[.!])\s+/).filter(Boolean);
  const rest: string[] = [];
  let skipping = true;
  for (const sentence of sentences) {
    if (skipping && isLoadClause(sentence)) continue;
    skipping = false;
    rest.push(sentence);
  }
  return rest.join(' ').trim();
}

function isOnlyLoadPrescription(paragraph: string): boolean {
  const sentences = paragraph.split(/(?<=[.!])\s+/).filter(Boolean);
  return sentences.length > 0 && sentences.every(isLoadClause);
}

/** A sets × reps line, or a kilogram line, with nothing else to coach. */
function isLoadClause(sentence: string): boolean {
  const hasSets = /\d+\s*[x×]\s*\d+/i.test(sentence);
  const hasKg = /\d+\s*kg\b/i.test(sentence) || /@\s*\d+/i.test(sentence);
  return hasSets && hasKg;
}
