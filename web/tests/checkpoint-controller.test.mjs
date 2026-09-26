import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// A deterministic GSAP clock exercises the real controller's ownership and
// cancellation paths. Browser checks separately verify actual rendered travel.
const clockUrl = `data:text/javascript,${encodeURIComponent(`
  export const jobs = [];
  const job = (kind, target, vars) => {
    const item = { kind, target, vars, killed: false, kill() { this.killed = true; } };
    jobs.push(item);
    return item;
  };
  export default {
    to(target, vars) { return job('travel', target, vars); },
    delayedCall(delay, callback) { return job('hold', {}, { onComplete: callback }); },
  };
  export const ScrollTrigger = { update() {} };
`)}`;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'gsap' || specifier === 'gsap/ScrollTrigger') return { url: clockUrl, shortCircuit: true };
    return next(specifier, context);
  },
});
const { createCheckpointScroll } = await import('../src/checkpointScroll.ts');
const { jobs } = await import(clockUrl);
hooks.deregister();

function harness(resolveMotion) {
  jobs.length = 0;
  const originals = new Map(['window', 'document', 'innerHeight', 'Node', 'Element', 'performance'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const listeners = new Map();
  let now = 0;
  class Element {
    parentElement = null;
    closest() { return null; }
    contains(node) { return node === this; }
  }
  const root = new Element();
  const window = {
    scrollY: 0,
    scrollTo({ top }) { this.scrollY = top; },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  };
  const values = { window, document: { documentElement: { scrollHeight: 4800, clientWidth: 1200 } }, innerHeight: 800, Node: Element, Element, performance: { now: () => now } };
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const controller = createCheckpointScroll(root, () => [0, 1000, 2000, 3000], resolveMotion);
  const emit = (type, details) => {
    const event = { target: root, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...details };
    for (const fn of listeners.get(type) ?? []) fn(event);
  };
  const active = kind => jobs.findLast(job => !job.killed && job.kind === kind);
  const complete = kind => {
    const item = active(kind);
    assert.ok(item, `expected active ${kind}`);
    item.killed = true;
    if (kind === 'travel') { item.target.top = item.vars.top; item.vars.onUpdate(); }
    item.vars.onComplete();
  };
  return {
    window, controller, active, complete, emit,
    wheel(deltaY, time) { now = time; emit('wheel', { deltaY, deltaX: 0, deltaMode: 0 }); },
    close() {
      controller.destroy();
      assert.equal([...listeners.values()].reduce((n, set) => n + set.size, 0), 0);
      assert.ok(jobs.every(job => job.killed));
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}

test('fresh gestures queue at most one chapter and execute only after landing', () => {
  const h = harness();
  try {
    h.wheel(80, 0); h.wheel(80, 400); h.wheel(80, 800);
    assert.equal(jobs.filter(job => job.kind === 'travel').length, 1);
    h.complete('travel');
    assert.equal(h.window.scrollY, 1000);
    assert.equal(h.active('travel'), undefined);
    h.complete('hold');
    assert.equal(h.active('travel').vars.top, 2000);
    h.complete('travel'); h.complete('hold');
    assert.equal(h.window.scrollY, 2000);
    assert.equal(h.active('travel'), undefined);
  } finally { h.close(); }
});

test('opposite intent replaces travel from its live position and clears the queue', () => {
  const h = harness();
  try {
    h.wheel(80, 0); h.wheel(80, 400);
    const outward = h.active('travel');
    outward.target.top = 450; outward.vars.onUpdate();
    h.wheel(-80, 450);
    assert.equal(outward.killed, true);
    assert.equal(h.active('travel').target.top, 450);
    assert.equal(h.active('travel').vars.top, 0);
    h.complete('travel'); h.complete('hold');
    assert.equal(h.window.scrollY, 0);
    assert.equal(h.active('travel'), undefined);
  } finally { h.close(); }
});

test('Tab and ordinary clicks clear queued intent without stranding committed travel', () => {
  const h = harness();
  try {
    h.wheel(80, 0); h.wheel(80, 400);
    const flight = h.active('travel');
    h.emit('keydown', { key: 'Tab' });
    h.emit('pointerdown', { clientX: 200 });
    assert.equal(flight.killed, false);
    h.complete('travel'); h.complete('hold');
    assert.equal(h.window.scrollY, 1000);
    assert.equal(h.active('travel'), undefined);
  } finally { h.close(); }
});

test('Shift+PageDown advances; Shift+Space reverses; navigation replaces queued travel', () => {
  const h = harness();
  try {
    h.emit('keydown', { key: 'PageDown', shiftKey: true });
    assert.equal(h.active('travel').vars.top, 1000);
    h.complete('travel'); h.complete('hold');
    h.emit('keydown', { key: ' ', shiftKey: true });
    assert.equal(h.active('travel').vars.top, 0);
    h.controller.travelTo(3000);
    h.complete('travel'); h.complete('hold');
    assert.equal(h.window.scrollY, 3000);
    assert.equal(h.active('travel'), undefined);
  } finally { h.close(); }
});

test('destroy cancels active travel and removes its event listeners', () => {
  const h = harness();
  h.wheel(80, 0);
  const flight = h.active('travel');
  h.close();
  assert.equal(flight.killed, true);
});

test('route changes cancel travel immediately before React unmount cleanup', () => {
  const h = harness();
  try {
    h.wheel(80, 0);
    const flight = h.active('travel');
    h.window.scrollY = 0;
    h.emit('hashchange', {});
    assert.equal(flight.killed, true);
    assert.equal(h.window.scrollY, 0);
    assert.equal(h.active('hold'), undefined);
  } finally { h.close(); }
});

test('the optional motion resolver owns checkpoint and direct-navigation tweens', () => {
  const calls = [];
  const ease = progress => progress * progress;
  const h = harness(context => {
    calls.push(context);
    return { duration: 1.23, ease };
  });
  try {
    h.wheel(80, 0);
    const flight = h.active('travel');
    assert.equal(flight.vars.duration, 1.23);
    assert.equal(flight.vars.ease, ease);
    assert.deepEqual(calls[0], { from: 0, to: 1000, checkpoint: true, stops: [0, 1000, 2000, 3000, 4000] });

    h.window.scrollY = 1000;
    h.controller.travelTo(2000);
    assert.equal(flight.killed, true);
    assert.equal(h.active('travel').vars.duration, 1.23);
    assert.deepEqual(calls[1], { from: 1000, to: 2000, checkpoint: false, stops: [0, 1000, 2000, 3000, 4000] });
  } finally { h.close(); }
});

test('a target within the shared stop epsilon lands exactly without a tween', () => {
  let resolutions = 0;
  const h = harness(() => {
    resolutions += 1;
    return { duration: 9, ease: 'none' };
  });
  try {
    h.window.scrollY = 998;
    h.controller.travelTo(1000);
    assert.equal(h.window.scrollY, 1000);
    assert.equal(h.active('travel'), undefined);
    assert.equal(resolutions, 0);
  } finally { h.close(); }
});
