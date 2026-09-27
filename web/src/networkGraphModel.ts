import type { Profile, State } from './types.ts';
import { networkPerson, ownedConnection, recommendationRank } from './networkModel.ts';
import { requestFor } from './connectionRequests.ts';

export function graphEvent(state: State) {
  const activeEvent = state.events.find(item => item.id === state.session?.activeEventId)
    ?? state.events.find(item => item.code.toUpperCase() === state.session?.code?.toUpperCase());
  return activeEvent ?? (state.demo && !state.session?.activeEventId && !state.session?.code
    ? state.events.find(item => item.code.toUpperCase() === 'DEMO')
    : undefined);
}

export function graphPeople(state: State, user: Profile) {
  const event = graphEvent(state);
  return state.profiles.filter(profile => profile.id !== user.id).flatMap(profile => {
    const saved = ownedConnection(state, user.id, profile.id);
    const inEvent = !!event?.participantIds?.includes(user.id) && event.participantIds.includes(profile.id) && profile.visibility?.activeInEvent !== false;
    const audience = saved && profile.visibility?.previousConnections !== false ? 'network' : inEvent ? 'event' : null;
    if (!audience) return [];
    const person = networkPerson(state, user, profile, undefined, audience);
    const relationship = requestFor(state, user.id, profile.id);
    const connected = relationship?.status === 'accepted';
    const relevant = recommendationRank(person) > 0;
    const kind = connected ? 'connected' : saved?.saved !== false && saved ? 'saved' : relevant ? 'suggested' : 'event';
    return [{ ...person, audience: audience as 'event' | 'network', eventId: audience === 'event' ? event?.id : saved?.eventId, kind, relationship }];
  }).sort((a, b) => recommendationRank(b) - recommendationRank(a) || a.profile.name.localeCompare(b.profile.name));
}

export type GraphPerson = ReturnType<typeof graphPeople>[number];

export function graphLayout(people: GraphPerson[]) {
  const groups = [
    ['Assistive technology', 'Robotics'],
    ['Spatial computing', 'Design', 'Creative tools'],
    ['Climate', 'Sustainable hardware'],
    ['Food culture', 'Startups'],
    ['Civic technology', 'Communities', 'Open source'],
  ];
  const counts = new Map<number, number>();
  return people.map(person => {
    const group = groups.findIndex(topics => topics.some(topic => person.profile.interests.includes(topic)));
    const cluster = group < 0 ? 4 : group;
    const index = counts.get(cluster) ?? 0;
    counts.set(cluster, index + 1);
    const angle = cluster / groups.length * Math.PI * 2 - Math.PI / 2;
    const spread = Math.sqrt(index) * 58;
    const localAngle = index * 2.39996;
    return { person, x: 450 + Math.cos(angle) * 340 + Math.cos(localAngle) * spread, y: 320 + Math.sin(angle) * 215 + Math.sin(localAngle) * spread };
  });
}
