import { useState } from 'react';
import { ArrowLeft, CalendarDays, Home, Network, RotateCcw, UserRound } from 'lucide-react';
import seed from '../shared/demo-data.json';
import demo from '../shared/recap-demo.json';
import type { Profile } from './types';
import { Avatar, Brand, Button, PageHeader, TextAction } from './ui';
import { ConferenceReport } from './ConferenceReport';
import { intersection } from './networkModel';
import { eventPhoto } from './eventModel';
import { requestFollowUp } from './requestFollowUp';
import { draftStorageKey } from './followUpModel';
import type { FollowUpPerson } from './followUpModel';

const storageKey = 'catalyst-conference-demo:v1';
type Progress = Record<string, { notes: string; contacted: boolean }>;
const initial = () => Object.fromEntries(demo.people.map(person => [person.id, { notes: person.notes, contacted: person.contacted }]));
function load(): Progress {
  const defaults = initial();
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    for (const id of Object.keys(defaults)) {
      if (value?.[id] && typeof value[id].notes === 'string' && value[id].notes.length <= 2000 && typeof value[id].contacted === 'boolean') defaults[id] = value[id];
    }
  } catch { /* Start with the prepared conference if storage is unavailable. */ }
  return defaults;
}

export function RecapDemo() {
  const [progress, setProgress] = useState(load);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const user = seed.profiles.find(profile => profile.id === demo.ownerId)! as Profile;
  const event = seed.events.find(item => item.id === demo.eventId)!;
  const people: FollowUpPerson[] = demo.people.map(item => {
    const profile = seed.profiles.find(profile => profile.id === item.id)! as Profile;
    return { id: item.id, profile, relationship: item.relationship as 'connected' | 'saved', sharedInterests: intersection(user.interests, profile.interests), ...progress[item.id], withdrawn: false, contacts: [], example: { notes: item.notes, message: item.message, nextStep: item.nextStep } };
  });
  const persist = (next: Progress) => {
    setProgress(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setNotice('Browser storage is unavailable. Changes will last until you leave this page.'); }
  };
  const reset = () => {
    persist(initial());
    try { for (const person of demo.people) localStorage.removeItem(draftStorageKey('completed-demo', demo.eventId, person.id)); }
    catch { /* In-memory state still resets. */ }
    setRevision(value => value + 1); setNotice('Demo reset to the prepared conference.');
  };

  return <div className="app-layout recap-demo-layout">
    <aside className="sidebar"><Brand compact /><div className="workspace-label"><span className="workspace-monogram">B</span><span>{event.name}<small>Completed-conference demo</small></span></div><nav aria-label="Main navigation">{[{ href: 'home', name: 'Home', Icon: Home }, { href: 'events', name: 'Events', Icon: CalendarDays }, { href: 'network', name: 'Network', Icon: Network }, { href: 'profile', name: 'Profile', Icon: UserRound }].map(({ href, name, Icon }) => <a key={href} href={`#/${href}`} className={href === 'events' ? 'active' : ''}><Icon size={18} /><span>{name}</span></a>)}</nav><div className="sidebar-bottom"><div className="account"><Avatar profile={user} /><span>{user.name}<small>Example attendee</small></span></div></div></aside>
    <main className="app-main" id="main-content" tabIndex={-1}><div className="product-page product-event-page recap-demo-page">
      <TextAction href="#/events" icon={<ArrowLeft size={15} />} iconPosition="start">Back to events</TextAction>
      <PageHeader title="The conversations worth keeping." description={`${event.name} · ${event.date} · Conference recap`} action={<Button variant="secondary" onClick={reset}><RotateCcw size={15} />Reset demo</Button>} />
      <div className="recap-demo-cover"><img src={eventPhoto(event)} alt="" /><div><h2>{event.name}</h2><p>An afternoon of introductions. A few ideas to take further.</p></div></div>
      <div className="recap-demo-caption"><p><strong>Completed-conference demo.</strong> Fictional connections and meeting notes. Edits stay in this browser.</p><TextAction href="#/login">Try the full experience</TextAction></div>
      {notice && <p className="recap-notice" role="status">{notice}</p>}
      <ConferenceReport key={revision} people={people} eventId={event.id} eventName={event.name} senderName={user.name} ownerKey="completed-demo" demo notify={setNotice}
        onSave={async (id, patch) => persist({ ...progress, [id]: { ...progress[id], ...patch } })}
        onGenerate={(id, notes, style, signal) => requestFollowUp('follow-up-demo', { participantId: id, notes, style }, signal)} />
    </div></main>
  </div>;
}
