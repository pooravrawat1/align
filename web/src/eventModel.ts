import type { Event, State } from './types';

export type EventPhase = 'upcoming' | 'live' | 'ended' | 'open';
export function eventPhase(event: Event, now = Date.now()): EventPhase {
  const start = Date.parse(event.startsAt ?? '');
  const end = Date.parse(event.endsAt ?? '');
  if (!Number.isFinite(start) && !Number.isFinite(end)) return 'open';
  if (Number.isFinite(end) && now >= end) return 'ended';
  if (Number.isFinite(start) && now < start) return 'upcoming';
  return 'live';
}
export function activeEvent(state: State) {
  const code = state.session?.code?.toUpperCase();
  return state.events.find(event => event.id === state.session?.activeEventId) ?? (code ? state.events.find(event => event.code.toUpperCase() === code) : undefined);
}
/** Feature the prepared room on demo Home without creating room presence. */
export function homeEvent(state: State) {
  return activeEvent(state) ?? (state.demo ? state.events.find(event => event.code.toUpperCase() === 'DEMO') : undefined);
}
export function eventPhaseLabel(event: Event, now = Date.now()) {
  const phase = eventPhase(event, now);
  return phase === 'live' ? 'Live now' : phase === 'upcoming' ? 'Upcoming' : phase === 'ended' ? 'Past event' : 'Open room';
}

export function eventPhoto(event: Event) {
  return event.id === 'spatial' ? '/assets/event-audience.webp' : event.id === 'prototype' ? '/assets/event-stage.webp' : '/assets/home-conference.webp';
}
