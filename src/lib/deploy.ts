/** ISO timestamp baked in at build time. `dev` when the bundle was not built with one. */
export const APP_BUILD_ID: string = typeof __APP_BUILD_ID__ === 'string' && __APP_BUILD_ID__ ? __APP_BUILD_ID__ : 'dev';

export interface DeployInput {
  localBuildId: string;
  remoteBuildId: string | null;
  /** A strength session or the log form is open. Reloading would drop it. */
  sessionActive: boolean;
  /** Remote id we already reloaded once to fetch. A second mismatch must not loop. */
  reloadedFor: string | null;
}

export type DeployDecision =
  | { kind: 'current' }
  | { kind: 'reload'; remoteBuildId: string }
  | { kind: 'defer'; remoteBuildId: string }
  | { kind: 'refuse'; remoteBuildId: string };

export function parseVersionPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const buildId = (payload as { buildId?: unknown }).buildId;
  if (typeof buildId !== 'string') return null;
  const trimmed = buildId.trim();
  return trimmed || null;
}

/**
 * `version.json` is fetched with no cache. A newer id means this bundle is stale.
 * An older id means the file is behind this bundle (a cached copy) and is ignored.
 * A missing id means we could not tell, so logging stays available.
 */
export function decideDeploy(input: DeployInput): DeployDecision {
  const remote = input.remoteBuildId?.trim() || null;
  const local = input.localBuildId.trim();
  if (!remote || !local || local === 'dev' || remote <= local) return { kind: 'current' };
  if (input.sessionActive) return { kind: 'defer', remoteBuildId: remote };
  if (input.reloadedFor === remote) return { kind: 'refuse', remoteBuildId: remote };
  return { kind: 'reload', remoteBuildId: remote };
}
