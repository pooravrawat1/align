import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CheckpointGesture, nextCheckpoint, STOP_EPSILON } from './checkpointGesture.ts';

export interface CheckpointScroll {
  travelTo: (top: number) => void;
  destroy: () => void;
}

export interface CheckpointMotionContext {
  from: number;
  to: number;
  checkpoint: boolean;
  stops: number[];
}

export interface CheckpointMotion {
  duration: number;
  ease: string | ((progress: number) => number);
}

export type CheckpointMotionResolver = (context: CheckpointMotionContext) => CheckpointMotion;

const CHECKPOINT_SECONDS = .85;
const LANDING_HOLD_SECONDS = .2;

// Creo's first glide reaches peak speed early and leaves more time to land.
function departureEase(progress: number) {
  const split = .35;
  return progress < split
    ? split * (1 - Math.cos(Math.PI * progress / (2 * split)))
    : split + (1 - split) * Math.sin(Math.PI * (progress - split) / (2 * (1 - split)));
}

export function createCheckpointScroll(
  root: HTMLElement,
  measure: () => number[],
  resolveMotion?: CheckpointMotionResolver,
): CheckpointScroll {
  const gesture = new CheckpointGesture();
  let travel: gsap.core.Tween | null = null;
  let hold: gsap.core.Tween | null = null;
  let direction = 0;
  let pending = 0;
  let acceptsQueue = false;

  const limit = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const stops = () => [...new Set([0, ...measure(), limit()].map(top => Math.round(Math.max(0, Math.min(limit(), top)))))].sort((a, b) => a - b);
  function cancel() {
    travel?.kill(); hold?.kill();
    travel = null; hold = null;
    direction = 0; pending = 0; acceptsQueue = false;
  }

  function clearIntent() { pending = 0; gesture.reset(); }

  function start(top: number, checkpoint: boolean, measuredStops = stops()) {
    cancel();
    const from = window.scrollY;
    const target = Math.max(0, Math.min(limit(), top));
    if (Math.abs(target - from) <= STOP_EPSILON) {
      window.scrollTo({ top: target, behavior: 'instant' });
      ScrollTrigger.update();
      return;
    }
    direction = Math.sign(target - from);
    acceptsQueue = checkpoint;
    const position = { top: from };
    const motion = resolveMotion?.({ from, to: target, checkpoint, stops: measuredStops }) ?? {
      duration: checkpoint ? (from < STOP_EPSILON ? 1 : CHECKPOINT_SECONDS) : Math.min(1.5, .85 + Math.abs(target - from) / innerHeight * .12),
      ease: from < STOP_EPSILON ? departureEase : 'sine.inOut',
    };
    travel = gsap.to(position, {
      top: target,
      duration: motion.duration,
      ease: motion.ease,
      onUpdate: () => { window.scrollTo({ top: position.top, behavior: 'instant' }); ScrollTrigger.update(); },
      onComplete: () => {
        travel = null;
        window.scrollTo({ top: target, behavior: 'instant' });
        ScrollTrigger.update();
        hold = gsap.delayedCall(LANDING_HOLD_SECONDS, () => {
          hold = null;
          const onward = pending;
          pending = 0; direction = 0; acceptsQueue = false;
          if (onward) step(onward);
        });
      },
    });
  }

  function step(nextDirection: number) {
    if ((travel || hold) && nextDirection === direction) {
      if (acceptsQueue) pending = nextDirection;
      return;
    }
    const measuredStops = stops();
    const target = nextCheckpoint(measuredStops, window.scrollY, nextDirection);
    start(target, true, measuredStops);
  }

  function editable(target: EventTarget | null) {
    return target instanceof Element && target.closest('input, textarea, select, [contenteditable]');
  }

  function nestedScroll(target: EventTarget | null, delta: number) {
    let node = target instanceof Element ? target : null;
    while (node && node !== root) {
      if (node.scrollHeight > node.clientHeight && /^(auto|scroll)$/.test(getComputedStyle(node).overflowY) &&
        (delta > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 1 : node.scrollTop > 1)) return true;
      node = node.parentElement;
    }
    return false;
  }

  function wheel(event: WheelEvent) {
    if (event.defaultPrevented || event.ctrlKey || editable(event.target) || !(event.target instanceof Node) || !root.contains(event.target)) return;
    if (nestedScroll(event.target, event.deltaY)) return;
    if (event.deltaY === 0) return;
    event.preventDefault();
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX) * 1.15) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const admitted = gesture.admit(event.deltaY * unit, performance.now());
    if (admitted) step(admitted);
  }

  function key(event: KeyboardEvent) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || editable(event.target)) return;
    if (event.key === 'Tab') { clearIntent(); return; }
    if (event.key === 'Escape') { cancel(); gesture.reset(); return; }
    if (event.key === ' ' && event.target instanceof Element && event.target.closest('button, a, [role="button"]')) return;
    const nextDirection = event.key === ' ' ? (event.shiftKey ? -1 : 1) : ['ArrowDown', 'PageDown'].includes(event.key) ? 1 : ['ArrowUp', 'PageUp'].includes(event.key) ? -1 : 0;
    if (!nextDirection && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.repeat) return;
    gesture.reset();
    if (nextDirection) step(nextDirection);
    else start(event.key === 'Home' ? 0 : limit(), false);
  }

  function interrupt() { cancel(); gesture.reset(); }
  function pointer(event: PointerEvent) {
    // A scrollbar drag owns position. Ordinary clicks only clear queued intent.
    if (event.clientX >= document.documentElement.clientWidth) interrupt();
    else clearIntent();
  }
  window.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('keydown', key);
  window.addEventListener('pointerdown', pointer, { passive: true });
  window.addEventListener('touchstart', clearIntent, { passive: true });
  window.addEventListener('resize', interrupt);
  window.addEventListener('hashchange', interrupt);

  return {
    travelTo(top) { gesture.reset(); start(top, false); },
    destroy() {
      cancel();
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', pointer);
      window.removeEventListener('touchstart', clearIntent);
      window.removeEventListener('resize', interrupt);
      window.removeEventListener('hashchange', interrupt);
    },
  };
}
