/**
 * Keep the screen on while this page is in the foreground.
 *
 * iPhone Safari has the Screen Wake Lock API (tabs since 16.4, Home Screen
 * web apps since iOS 18.4). WebKit still requires a user gesture the first
 * time a document requests the lock. After that grant, permission sticks for
 * the life of the document, so coming back to the tab can take the lock again
 * with no new tap. The browser drops the lock when the page is hidden.
 *
 * A silent looping video is a worse fit on current Safari: it needs a gesture
 * too, and background media is restricted more tightly than this API.
 */

export interface ScreenWakeSentinel {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
}

export interface ScreenWakeSource {
  request(type: 'screen'): Promise<ScreenWakeSentinel>;
}

export interface ScreenWakeEnvironment {
  visibility: () => DocumentVisibilityState;
  wakeLock: () => ScreenWakeSource | null;
  onVisibility: (listener: () => void) => () => void;
  onPageShow: (listener: () => void) => () => void;
  onPageHide: (listener: () => void) => () => void;
}

export interface ScreenWake {
  /** Listen for hide/show and take the lock if the page is already visible. */
  start: () => () => void;
  /**
   * Take the lock from inside a user gesture. Safari ignores the first
   * request unless this runs during transient activation.
   */
  requestFromGesture: () => void;
}

export function createScreenWake(env: ScreenWakeEnvironment): ScreenWake {
  let holders = 0;
  let generation = 0;
  let pending = 0;
  let suspended = false;
  let retryWhenSettled = false;
  let sentinel: ScreenWakeSentinel | null = null;
  let unsubscribe: Array<() => void> = [];

  function releaseSentinel(current: ScreenWakeSentinel | null) {
    if (!current || current.released) return;
    void current.release().catch(() => {});
  }

  function releaseHeld() {
    const current = sentinel;
    sentinel = null;
    releaseSentinel(current);
  }

  function adopt(next: ScreenWakeSentinel) {
    sentinel = next;
    const onRelease = () => {
      next.removeEventListener('release', onRelease);
      if (sentinel === next) sentinel = null;
    };
    next.addEventListener('release', onRelease);
  }

  function ask(gesture: boolean) {
    if (holders === 0 || suspended) return;
    if (env.visibility() !== 'visible') return;
    const source = env.wakeLock();
    if (!source) return;
    if (sentinel && !sentinel.released) return;
    if (pending > 0 && !gesture) {
      retryWhenSettled = true;
      return;
    }

    const generationAtCall = generation;
    let asked: Promise<ScreenWakeSentinel>;
    try {
      asked = source.request('screen');
    } catch {
      return;
    }

    pending += 1;
    void Promise.resolve(asked).then(
      (next) => {
        pending -= 1;
        const stale = generationAtCall !== generation || holders === 0 || suspended || env.visibility() !== 'visible';
        if (stale || (sentinel && !sentinel.released)) releaseSentinel(next);
        else adopt(next);
        settleRetry();
      },
      () => {
        pending -= 1;
        settleRetry();
      },
    );
  }

  function settleRetry() {
    if (pending > 0 || !retryWhenSettled) return;
    retryWhenSettled = false;
    if (holders === 0 || suspended || env.visibility() !== 'visible') return;
    if (sentinel && !sentinel.released) return;
    ask(false);
  }

  function onVisibility() {
    if (holders === 0) return;
    if (env.visibility() !== 'visible') {
      retryWhenSettled = false;
      releaseHeld();
      return;
    }
    // Visible again means the page is back in the foreground, even if a
    // pagehide had paused an in-flight grant.
    suspended = false;
    ask(false);
  }

  function onPageHide() {
    suspended = true;
    retryWhenSettled = false;
    releaseHeld();
  }

  function onPageShow() {
    suspended = false;
    if (holders === 0) return;
    if (env.visibility() === 'visible') ask(false);
  }

  function start() {
    holders += 1;
    if (holders === 1) {
      unsubscribe = [env.onVisibility(onVisibility), env.onPageShow(onPageShow), env.onPageHide(onPageHide)];
      if (env.visibility() === 'visible') ask(false);
    }
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      holders -= 1;
      if (holders > 0) return;
      generation += 1;
      suspended = false;
      releaseHeld();
      for (const stop of unsubscribe) stop();
      unsubscribe = [];
    };
  }

  function requestFromGesture() {
    suspended = false;
    ask(true);
  }

  return { start, requestFromGesture };
}

/** True for in-app links that open a workout (`#/log`, `#/log/<id>`, `#/session`). */
export function isWorkoutOpenHref(href: string | null | undefined): boolean {
  if (!href) return false;
  const hashIndex = href.indexOf('#');
  const hash = hashIndex >= 0 ? href.slice(hashIndex + 1) : href;
  const head = hash.split('/').filter(Boolean)[0];
  return head === 'log' || head === 'session';
}

function browserEnvironment(): ScreenWakeEnvironment {
  return {
    visibility: () => document.visibilityState,
    wakeLock: () => {
      if (!('wakeLock' in navigator)) return null;
      const source = navigator.wakeLock;
      return { request: (type) => source.request(type) };
    },
    onVisibility: (listener) => {
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
    onPageShow: (listener) => {
      window.addEventListener('pageshow', listener);
      return () => window.removeEventListener('pageshow', listener);
    },
    onPageHide: (listener) => {
      window.addEventListener('pagehide', listener);
      return () => window.removeEventListener('pagehide', listener);
    },
  };
}

let browserWake: ScreenWake | null = null;

function browserScreenWake(): ScreenWake {
  if (!browserWake) browserWake = createScreenWake(browserEnvironment());
  return browserWake;
}

/** Start holding the screen awake for as long as this page stays in the foreground. */
export function holdScreenAwake(): () => void {
  return browserScreenWake().start();
}

/**
 * Ask again from a click that opens a workout. No effect in browsers that
 * already granted the lock; this is the gesture Safari needs the first time.
 */
export function requestScreenWakeLock(): void {
  browserScreenWake().requestFromGesture();
}
