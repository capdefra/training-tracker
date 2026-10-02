import type { Deletion, Deletions, TrainingData } from '../types';
import { emptyDeletions, normalize } from './storage';

function stampOf(item: { updatedAt?: string; createdAt?: string; startDate?: string }): string {
  return item.updatedAt || item.createdAt || item.startDate || '';
}

function newer<T extends { id: string; updatedAt?: string; createdAt?: string; startDate?: string }>(a: T, b: T): T {
  const left = stampOf(a);
  const right = stampOf(b);
  if (left !== right) return left > right ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

function mergeById<T extends { id: string; updatedAt?: string; createdAt?: string; startDate?: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  const order: string[] = [];
  for (const item of [...a, ...b]) {
    const previous = map.get(item.id);
    if (!previous) {
      order.push(item.id);
      map.set(item.id, item);
    } else {
      map.set(item.id, newer(previous, item));
    }
  }
  return order.map((id) => map.get(id) as T);
}

function mergeDeletionList(a: Deletion[], b: Deletion[]): Deletion[] {
  const map = new Map<string, Deletion>();
  for (const item of [...a, ...b]) {
    const previous = map.get(item.id);
    if (!previous || item.at > previous.at) map.set(item.id, item);
  }
  return [...map.values()];
}

export function mergeDeletions(a: Deletions | undefined, b: Deletions | undefined): Deletions {
  const left = a ?? emptyDeletions();
  const right = b ?? emptyDeletions();
  return {
    goals: mergeDeletionList(left.goals, right.goals),
    plans: mergeDeletionList(left.plans, right.plans),
    presets: mergeDeletionList(left.presets, right.presets),
    sessions: mergeDeletionList(left.sessions, right.sessions),
  };
}

/** Union both copies, then let the later deletion win. Safe to call in either order. */
export function mergeTraining(a: TrainingData, b: TrainingData): TrainingData {
  return normalize({
    version: 1,
    goals: mergeById(a.goals, b.goals),
    plans: mergeById(a.plans, b.plans),
    presets: mergeById(a.presets, b.presets),
    sessions: mergeById(a.sessions, b.sessions),
    deleted: mergeDeletions(a.deleted, b.deleted),
  });
}
