import type { CheckpointMotionResolver } from './checkpointScroll.ts';
import { STOP_EPSILON } from './checkpointGesture.ts';

const SECTION_SECONDS = .9;
const MIN_PARTIAL_SECONDS = .25;

function stopIndex(stops: number[], position: number) {
  const index = stops.findIndex(stop => Math.abs(stop - position) <= STOP_EPSILON);
  return index >= 0 ? index : undefined;
}

function legIndex(stops: number[], from: number, to: number) {
  const direction = Math.sign(to - from);
  if (!direction) return undefined;

  if (direction > 0) {
    return stops.findIndex((stop, index) => index < stops.length - 1 && from >= stop - STOP_EPSILON && from < stops[index + 1] - STOP_EPSILON);
  }

  return stops.findIndex((stop, index) => index < stops.length - 1 && from > stop + STOP_EPSILON && from <= stops[index + 1] + STOP_EPSILON);
}

function authoredMotion(stops: number[], from: number, to: number, partial: boolean) {
  const index = legIndex(stops, from, to);
  if (index === undefined || index < 0) return undefined;

  const fullDuration = SECTION_SECONDS;
  const fullDistance = stops[index + 1] - stops[index];
  if (fullDistance <= 0) return undefined;
  const remaining = Math.min(fullDistance, Math.abs(to - from));
  const duration = partial
    ? Math.min(fullDuration, Math.max(MIN_PARTIAL_SECONDS, fullDuration * Math.sqrt(remaining / fullDistance)))
    : fullDuration;
  return { duration, ease: 'sine.inOut' };
}

export const resolveJourneyMotion: CheckpointMotionResolver = ({ from, to, checkpoint, stops }) => {
  if (checkpoint) {
    const authored = authoredMotion(stops, from, to, true);
    if (authored) return authored;
  } else {
    const fromIndex = stopIndex(stops, from);
    const toIndex = stopIndex(stops, to);
    if (fromIndex !== undefined && toIndex !== undefined && Math.abs(toIndex - fromIndex) === 1) {
      const authored = authoredMotion(stops, from, to, false);
      if (authored) return authored;
    }
  }

  return { duration: SECTION_SECONDS, ease: 'sine.inOut' };
};
