import assert from 'node:assert/strict';
import { createScreenWake, isWorkoutOpenHref } from '../src/lib/screen-wake.ts';

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createSentinel() {
  let released = false;
  const listeners = new Set();
  return {
    get released() {
      return released;
    },
    release() {
      if (!released) {
        released = true;
        for (const listener of [...listeners]) listener();
      }
      return Promise.resolve();
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    drop() {
      if (released) return;
      released = true;
      for (const listener of [...listeners]) listener();
    },
  };
}

function createHarness(initial = 'visible') {
  let visibility = initial;
  let onVisibility = () => {};
  let onPageShow = () => {};
  let onPageHide = () => {};
  const requests = [];
  const env = {
    visibility: () => visibility,
    wakeLock: () => ({
      request(type) {
        let resolve;
        let reject;
        const promise = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        requests.push({ type, resolve, reject });
        return promise;
      },
    }),
    onVisibility(listener) {
      onVisibility = listener;
      return () => {
        if (onVisibility === listener) onVisibility = () => {};
      };
    },
    onPageShow(listener) {
      onPageShow = listener;
      return () => {
        if (onPageShow === listener) onPageShow = () => {};
      };
    },
    onPageHide(listener) {
      onPageHide = listener;
      return () => {
        if (onPageHide === listener) onPageHide = () => {};
      };
    },
  };
  return {
    env,
    requests,
    hide() {
      visibility = 'hidden';
      onVisibility();
    },
    show() {
      visibility = 'visible';
      onVisibility();
    },
    pageHide() {
      onPageHide();
    },
    pageShow() {
      visibility = 'visible';
      onPageShow();
    },
  };
}

const hrefs = [
  ['#/log', true],
  ['#/log/', true],
  ['#/log/abc', true],
  ['https://capdefra.github.io/training-tracker/#/log/abc', true],
  ['#/today', false],
  ['#/progress', false],
  ['#/logical', false],
  ['#/plans', false],
  ['', false],
  [null, false],
];
for (const [href, expected] of hrefs) {
  assert.equal(isWorkoutOpenHref(href), expected, `href ${href}`);
}

{
  const harness = createHarness('hidden');
  const wake = createScreenWake(harness.env);
  const stop = wake.start();
  assert.equal(harness.requests.length, 0, 'hidden page does not request a lock');
  harness.show();
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0].type, 'screen');
  stop();
}

{
  const harness = createHarness();
  const wake = createScreenWake(harness.env);
  const stop = wake.start();
  assert.equal(harness.requests.length, 1, 'visible page requests immediately');
  const sentinel = createSentinel();
  harness.requests[0].resolve(sentinel);
  await flush();
  assert.equal(sentinel.released, false);

  harness.show();
  assert.equal(harness.requests.length, 1, 'an active lock is not requested again');

  harness.hide();
  assert.equal(sentinel.released, true, 'leaving the page releases the lock');
  harness.show();
  assert.equal(harness.requests.length, 2, 'returning reacquires the lock');
  stop();
}

{
  const harness = createHarness();
  const wake = createScreenWake(harness.env);
  wake.start();
  assert.equal(harness.requests.length, 1);
  wake.requestFromGesture();
  assert.equal(harness.requests.length, 2, 'a gesture requests synchronously while the first call is in flight');
  const gestured = createSentinel();
  const initial = createSentinel();
  harness.requests[1].resolve(gestured);
  harness.requests[0].resolve(initial);
  await flush();
  const held = [initial, gestured].filter((item) => !item.released);
  assert.equal(held.length, 1, 'exactly one grant is held when both succeed');
}

{
  const harness = createHarness();
  const wake = createScreenWake(harness.env);
  wake.start();
  wake.requestFromGesture();
  harness.requests[0].reject(Object.assign(new Error('Permission was denied'), { name: 'NotAllowedError' }));
  const gestured = createSentinel();
  harness.requests[1].resolve(gestured);
  await flush();
  assert.equal(gestured.released, false, 'Safari can deny the automatic request and still grant the gesture');
}

{
  const harness = createHarness();
  const wake = createScreenWake(harness.env);
  const stop = wake.start();
  harness.requests[0].reject(Object.assign(new Error('Permission was denied'), { name: 'NotAllowedError' }));
  await flush();
  wake.requestFromGesture();
  assert.equal(harness.requests.length, 2, 'a denied automatic request does not block the workout gesture');
  const sentinel = createSentinel();
  harness.requests[1].resolve(sentinel);
  await flush();
  assert.equal(sentinel.released, false);
  sentinel.drop();
  await flush();
  harness.show();
  assert.equal(harness.requests.length, 3, 'a browser release can be replaced when the page is shown');
  stop();
}

{
  const harness = createHarness();
  const wake = createScreenWake(harness.env);
  const stop = wake.start();
  const pending = harness.requests[0];
  stop();
  harness.show();
  harness.pageShow();
  assert.equal(harness.requests.length, 1, 'stopped holder does not request again');
  const sentinel = createSentinel();
  pending.resolve(sentinel);
  await flush();
  assert.equal(sentinel.released, true, 'a grant that arrives after stop is released');
}

{
  const harness = createHarness();
  const wake = createScreenWake(harness.env);
  const stop1 = wake.start();
  const stop2 = wake.start();
  assert.equal(harness.requests.length, 1, 'a second holder does not request twice');
  const sentinel = createSentinel();
  harness.requests[0].resolve(sentinel);
  await flush();
  stop1();
  await flush();
  assert.equal(sentinel.released, false, 'the lock stays while another holder is active');
  stop2();
  assert.equal(sentinel.released, true);
}

{
  const harness = createHarness();
  const wake = createScreenWake(harness.env);
  wake.start();
  const late = createSentinel();
  harness.pageHide();
  harness.requests[0].resolve(late);
  await flush();
  assert.equal(late.released, true, 'a grant resolving after pagehide is not held');
  harness.pageShow();
  assert.equal(harness.requests.length, 2, 'pageshow takes the lock again');
}

{
  let visibility = 'visible';
  const wake = createScreenWake({
    visibility: () => visibility,
    wakeLock: () => null,
    onVisibility: () => () => {},
    onPageShow: () => () => {},
    onPageHide: () => () => {},
  });
  const stop = wake.start();
  wake.requestFromGesture();
  visibility = 'hidden';
  stop();
}

{
  const wake = createScreenWake({
    visibility: () => 'visible',
    wakeLock: () => ({
      request() {
        throw new Error('blocked');
      },
    }),
    onVisibility: () => () => {},
    onPageShow: () => () => {},
    onPageHide: () => () => {},
  });
  wake.start();
  wake.requestFromGesture();
}

{
  const harness = createHarness();
  const wake = createScreenWake(harness.env);
  wake.start();
  const sentinel = createSentinel();
  harness.requests[0].resolve(sentinel);
  await flush();
  harness.hide();
  assert.equal(sentinel.released, true);
  wake.requestFromGesture();
  assert.equal(harness.requests.length, 1, 'a gesture while hidden does not request');
  harness.show();
  assert.equal(harness.requests.length, 2);
}

console.log('screen wake checks passed');
