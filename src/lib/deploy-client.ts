import { APP_BUILD_ID, decideDeploy, parseVersionPayload } from './deploy';
import { loadStrengthProgress } from './session-progress';

const RELOAD_KEY = 'training-tracker:reload-build';

export const STALE_WRITE_MESSAGE = 'This page is out of date. Reload it to keep syncing.';
export const SESSION_WRITE_MESSAGE = 'Finish or leave the open workout before saving. This page will update after that.';

export type WriteGuard = 'allow' | 'reload' | 'defer' | 'refuse';

let reloadStarted = false;

export function strengthSessionIsOpen(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  if (hash.startsWith('#/session') || hash.startsWith('#/log')) return true;
  return loadStrengthProgress() !== null;
}

function readReloadedFor(): string | null {
  try {
    return sessionStorage.getItem(RELOAD_KEY);
  } catch {
    return null;
  }
}

function clearReloadedFor(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // Private mode can reject storage. The next check fetches again.
  }
}

export async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json?${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return parseVersionPayload(await response.json());
  } catch {
    return null;
  }
}

/**
 * Compare this bundle with `version.json` before a shared write.
 * A newer deploy reloads the page. An open workout defers that reload.
 * After one reload still serves this bundle, further writes are refused.
 */
export async function guardSharedWrite(): Promise<WriteGuard> {
  if (typeof window === 'undefined') return 'allow';
  if (reloadStarted) return 'reload';
  const remoteBuildId = await fetchRemoteBuildId();
  if (reloadStarted) return 'reload';
  const decision = decideDeploy({
    localBuildId: APP_BUILD_ID,
    remoteBuildId,
    sessionActive: strengthSessionIsOpen(),
    reloadedFor: readReloadedFor(),
  });
  if (decision.kind === 'current') {
    if (remoteBuildId && remoteBuildId === APP_BUILD_ID) clearReloadedFor();
    return 'allow';
  }
  if (decision.kind === 'defer') return 'defer';
  if (decision.kind === 'refuse') return 'refuse';
  try {
    sessionStorage.setItem(RELOAD_KEY, decision.remoteBuildId);
  } catch {
    return 'refuse';
  }
  reloadStarted = true;
  const url = new URL(window.location.href);
  url.searchParams.set('v', decision.remoteBuildId);
  window.location.replace(url.toString());
  return 'reload';
}
