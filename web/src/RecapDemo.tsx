import { useEffect, useState } from 'react';
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

type Progress = Record<string, { notes: string; contacted: boolean }>;
type PersonaId = keyof typeof demo.personas;
const personaFromHash = (): PersonaId => new URLSearchParams(location.hash.split('?')[1] ?? '').get('persona') === 'maya' ? 'maya' : 'alex';
const personaStory = (persona: PersonaId) => demo.personas[persona];
const storageKey = (persona: PersonaId) => `catalyst-conference-demo:${demo.version}:${persona}`;
const ownerKey = (persona: PersonaId) => `completed-demo:${demo.version}:${persona}`;
const initial = (persona: PersonaId) => Object.fromEntries(personaStory(persona).people.map(person => [person.id, { notes: person.notes, contacted: person.contacted }]));
function load(persona: PersonaId): Progress {
  const defaults = initial(persona);
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(persona)) ?? 'null');
    for (const id of Object.keys(defaults)) {
      if (value?.[id] && typeof value[id].notes === 'string' && value[id].notes.length <= 2000 && typeof value[id].contacted === 'boolean') {
        defaults[id] = { notes: value[id].notes, contacted: value[id].contacted };
      }
    }
  } catch { /* Start with the prepared conference if storage is unavailable. */ }
  return defaults;
}

export function RecapDemo() {
  const [persona, setPersona] = useState<PersonaId>(personaFromHash);
  useEffect(() => {
    const sync = () => setPersona(personaFromHash());
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);

  return <PersonaRecap key={persona} persona={persona} />;
}

function PersonaRecap({ persona }: { persona: PersonaId }) {
  const [progress, setProgress] = useState(() => load(persona));
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const story = personaStory(persona);
  const user = seed.profiles.find(profile => profile.id === persona)! as Profile;
  const event = seed.events.find(item => item.id === demo.eventId)!;
  const people: FollowUpPerson[] = story.people.map(item => {
    const profile = seed.profiles.find(profile => profile.id === item.id)! as Profile;
    return { id: item.id, profile, relationship: item.relationship as 'connected' | 'saved', sharedInterests: intersection(user.interests, profile.interests), ...progress[item.id], withdrawn: false, contacts: [], example: { notes: item.notes, message: item.message, nextStep: item.nextStep, reason: item.reason, durationMinutes: item.durationMinutes } };
  });
  const persist = (next: Progress) => {
    setProgress(next);
    try { localStorage.setItem(storageKey(persona), JSON.stringify(next)); }
    catch { setNotice('Browser storage is unavailable. Changes will last until you leave this page.'); }
  };
  const reset = () => {
    persist(initial(persona));
    try { for (const person of story.people) localStorage.removeItem(draftStorageKey(ownerKey(persona), demo.eventId, person.id)); }
    catch { /* In-memory state still resets. */ }
    setRevision(value => value + 1); setNotice('Demo reset to the prepared conference.');
  };

  return <div className="app-layout recap-demo-layout">
    <aside className="sidebar"><Brand compact /><div className="workspace-label"><span className="workspace-monogram">B</span><span>{event.name}<small>Completed-conference demo</small></span></div><nav aria-label="Main navigation">{[{ href: 'home', name: 'Home', Icon: Home }, { href: 'events', name: 'Events', Icon: CalendarDays }, { href: 'network', name: 'Network', Icon: Network }, { href: 'profile', name: 'Profile', Icon: UserRound }].map(({ href, name, Icon }) => <a key={href} href={`#/${href}`} className={href === 'events' ? 'active' : ''}><Icon size={18} /><span>{name}</span></a>)}</nav><div className="sidebar-bottom"><div className="account"><Avatar profile={user} /><span>{user.name}<small>Example attendee</small></span></div></div></aside>
    <main className="app-main" id="main-content" tabIndex={-1}><div className="product-page product-event-page recap-demo-page">
      <TextAction href="#/events" icon={<ArrowLeft size={15} />} iconPosition="start">Back to events</TextAction>
      <div className="recap-demo-heading"><PageHeader title="The conversations worth keeping." description={`${event.name} · ${event.date}`} action={<Button variant="secondary" onClick={reset}><RotateCcw size={15} />Reset recap</Button>} />
        <div className="recap-persona-switch" role="group" aria-label="View recap as">{(['alex', 'maya'] as const).map(id => <a key={id} href={`#/recap-demo?persona=${id}`} aria-current={persona === id ? 'page' : undefined}>{seed.profiles.find(profile => profile.id === id)?.name}</a>)}</div>
      </div>
      <div className="recap-demo-cover"><img src={eventPhoto(event)} alt="" /><div><h2>{user.name}'s recap</h2><p>Connections to remember. Next steps ready to send.</p></div></div>
      {notice && <p className="recap-notice" role="status">{notice}</p>}
      <ConferenceReport key={`${persona}:${revision}`} people={people} eventId={event.id} eventName={event.name} senderName={user.name} ownerKey={ownerKey(persona)} demo notify={setNotice}
        onSave={async (id, patch) => persist({ ...progress, [id]: { ...progress[id], ...patch } })}
        onGenerate={(id, notes, style, signal) => requestFollowUp('follow-up-demo', { ownerId: persona, participantId: id, notes, style }, signal)} />
    </div></main>
  </div>;
}
