import type { Action, Profile, State } from './types';
export type EventRecapProps = { state: State; user: Profile; act: Action; busy: boolean; notify: (message: string) => void; eventId: string; onSessionExpired?: () => void };
import { ConferenceReport } from './ConferenceReport';
import { eventRecap } from './eventRecapModel';
import { networkPerson } from './networkModel';
import { openPersonProfile } from './PeopleDirectory';
import { TextAction } from './ui';
import { requestFollowUp } from './requestFollowUp';
import { demoRecapHref } from './demoJourney';



export function EventRecap({ state, user, eventId, act, notify, onSessionExpired }: EventRecapProps) {
  const recap = eventRecap(state, user, eventId);
  const event = state.events.find(item => item.id === eventId);
  const people = recap.people.map(({ connection, profile, withdrawn, sharedInterests }) => ({
    id: profile.id, profile, withdrawn, sharedInterests,
    relationship: 'met' as const,
    notes: connection.notes ?? '', contacted: connection.followUp === 'contacted',
    needsFollowUp: (connection.followUp ?? 'needed') === 'needed', savedPrivately: connection.saved !== false,
    contacts: networkPerson(state, user, profile).contacts,
  }));
  return <div className="event-recap">
    <ConferenceReport key={`${state.session?.id}:${user.id}:${eventId}`} people={people} eventId={eventId} eventName={event?.name ?? 'this event'} senderName={user.name} demoHref={demoRecapHref(user.id)}
      ownerKey={`${state.session?.id ?? 'session'}:${user.id}`} notify={notify}
      onProfile={id => openPersonProfile(id, eventId, 'network')}
      onSave={async (id, patch) => { await act(`connections/${encodeURIComponent(id)}`, { ...('notes' in patch ? { notes: patch.notes } : {}), ...('contacted' in patch ? { followUp: patch.contacted ? 'contacted' : 'needed' } : {}) }, 'PATCH'); }}
      onGenerate={(id, notes, style, signal) => requestFollowUp('follow-up', { participantId: id, eventId, notes, style }, signal, state.session?.id, onSessionExpired)} />
    {recap.people.length === 0 && <TextAction href={`#/events?event=${encodeURIComponent(eventId)}`}>View event details</TextAction>}
  </div>;
}
