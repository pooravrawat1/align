import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Action, Profile, State } from './types';
import { Avatar, Button, PanelHeader, TextAction } from './ui';
import { pendingRequests } from './connectionRequests';
import { openPersonProfile } from './PeopleDirectory';
import './ConnectionInbox.css';

type Props = { state: State; user: Profile; act: Action; busy: boolean; notify: (message: string) => void; eventId?: string };
export function ConnectionInbox({ state, user, act, busy, notify, eventId }: Props) {
  const pending = pendingRequests(state, user.id, eventId);
  const incoming = pending.filter(request => request.recipientId === user.id);
  const outgoing = pending.filter(request => request.senderId === user.id);
  const [view, setView] = useState<'received' | 'sent'>('received');
  // Prefer the only populated side while keeping both counts visible.
  const selected = incoming.length === 0 && outgoing.length > 0 ? 'sent' : outgoing.length === 0 ? 'received' : view;
  const requests = selected === 'received' ? incoming : outgoing;
  const update = async (id: string, action: 'accept' | 'decline' | 'cancel') => {
    try {
      await act('connection-requests/' + encodeURIComponent(id), { action }, 'PATCH');
      notify(action === 'accept' ? 'Connected. You can now follow up from their profile.' : action === 'decline' ? 'Request declined.' : 'Request cancelled.');
    } catch { /* App presents the action error. */ }
  };
  return <section className="connection-inbox" aria-label="Connection requests">
    <PanelHeader title="Connection requests" description={pending.length ? 'A request starts a two-way connection. Saving a profile stays private.' : 'Requests you send and receive will appear here.'} action={<TextAction disabled={busy} icon={<RefreshCw size={14} />} onClick={() => { void act('bootstrap', undefined, 'GET').catch(() => {}); }}>Refresh requests</TextAction>} />
    {pending.length > 0 && <>
      <div className="request-tabs" role="group" aria-label="Request direction">
        <button aria-pressed={selected === 'received'} disabled={!incoming.length} onClick={() => setView('received')}>Received <span>{incoming.length}</span></button>
        <button aria-pressed={selected === 'sent'} disabled={!outgoing.length} onClick={() => setView('sent')}>Sent <span>{outgoing.length}</span></button>
      </div>
      <div className="request-list">{requests.map(request => {
        const personId = request.senderId === user.id ? request.recipientId : request.senderId;
        const person = state.profiles.find(profile => profile.id === personId);
        if (!person) return null;
        const event = state.events.find(item => item.id === request.eventId);
        return <div className="request-row" key={request.id}>
          <button className="request-person" onClick={() => openPersonProfile(person.id, request.eventId, 'event')} aria-label={`View ${person.name}'s request`}>
            <Avatar profile={person} /><span><strong>{person.name}</strong>{person.role && <span className="request-person-role">{person.role}</span>}<small>{selected === 'received' ? 'Wants to connect' : 'Request pending'}{event ? ' · ' + event.name : ''}</small></span>
          </button>
          <div className="request-actions">{selected === 'received' ? <><Button disabled={busy} onClick={() => void update(request.id, 'accept')} aria-label={`Accept ${person.name}'s request`}>Accept</Button><Button variant="secondary" className="request-decline" disabled={busy} onClick={() => void update(request.id, 'decline')} aria-label={`Decline ${person.name}'s request`}>Decline</Button></> : <TextAction disabled={busy} onClick={() => void update(request.id, 'cancel')} aria-label={`Cancel request to ${person.name}`}>Cancel request</TextAction>}</div>
        </div>;
      })}</div>
    </>}
  </section>;
}
