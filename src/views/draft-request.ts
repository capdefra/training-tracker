import type { LogPreset } from '../types';

export type DraftRequest = { token: number; mode: 'new' } | { token: number; mode: 'preset'; preset: LogPreset };
