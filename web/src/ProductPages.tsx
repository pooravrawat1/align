import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Copy, Download, MapPin, Pencil } from 'lucide-react';
import type { Action, Event as QuestEvent, Profile, State } from './types';
import { Avatar, Button, PageHeader, PanelHeader, TextAction } from './ui';
import { pendingRequests } from './connectionRequests';
import { EventRecap } from './EventRecap';
import { HomeSections } from './HomeSections';
import { PeopleDirectory } from './PeopleDirectory';
import { activeEvent, homeEvent, eventPhase, eventPhaseLabel, eventPhoto } from './eventModel';
import { demoRecapHref } from './demoJourney';
import './ProductPages.css';
import './EventProduct.css';
import './Home.css';
import './SpatialSurface.css';
import './EventWorkspace.css';

type ProductProps = { state: State; user: Profile; connected: string[]; act: Action; busy: boolean; notify: (message: string) => void; onSessionExpired?: () => void };
const navigate = (path: string) => { location.hash = '/' + path; };
const query = () => new URLSearchParams(location.hash.split('?')[1]);
function useRouteQuery() {
  const [params, setParams] = useState(query);
  useEffect(() => { const sync = () => setParams(query()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  return params;
}
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  return now;
}
function readyForRoom(user: Profile) { return !!(user.name.trim() && user.role.trim()); }

export function HomeProduct(props: ProductProps) {
  const { state, user, busy, act } = props;
  const params = useRouteQuery();
  const event = homeEvent(state);
  const now = useNow();
  const ended = event ? eventPhase(event, now) === 'ended' : false;
  const peopleTab = params.get('tab') === 'people' || params.get('people') === '1';
  const recapTab = params.get('tab') === 'recap';
  const incomingCount = pendingRequests(state, user.id).filter(request => request.recipientId === user.id).length;
  const firstName = user.name.trim().split(/\s+/u)[0];
  if (!event) return <div className="home-page">
    <PageHeader className="home-heading" title={'Good to see you, ' + firstName + '.'} description="Find your next room. Bring something of yourself." />
    <section className="product-panel workspace-welcome"><h2>Your next conversation starts with an event.</h2><p>Choose an event or use the code from your host. Your introduction and people will come together here.</p><div className="workspace-actions"><Button onClick={() => navigate('events')}>Find an event<ArrowRight size={16} /></Button><TextAction href="#/events?join=1">Join with a code</TextAction></div></section>
    <button className="spatial-surface home-profile-card workspace-unjoined-profile" onClick={() => navigate('profile')} aria-label="Edit your profile"><span className="home-person"><Avatar profile={user} /><span className="home-person-copy"><strong>{user.name}</strong><span>{user.role}</span></span><Pencil size={14} /></span></button>
    <HomeSections {...props} />
  </div>;
  const otherEvents = state.events.filter(item => item.id !== event.id).slice(0, 2);
  const enter = async () => {
    if (!readyForRoom(user)) { navigate('profile'); return; }
    try {
      if (state.session?.code?.toUpperCase() !== event.code.toUpperCase()) await act('room', { code: event.code });
      navigate('spatial');
    } catch { /* App presents service errors. */ }
  };
  const meetPeople = () => navigate('home?tab=people');
  return <div className="home-page event-workspace">
    <PageHeader className="home-heading" title={'Good to see you, ' + firstName + '.'} description="Your next conversation starts here." action={incomingCount > 0 ? <TextAction href="#/network" icon={<ArrowRight size={16} aria-hidden="true" />}>{incomingCount} connection {incomingCount === 1 ? 'request' : 'requests'}</TextAction> : undefined} />
    <section className="home-event" aria-labelledby="home-event-title">
      <img className="home-event-image" src={eventPhoto(event)} alt="" fetchPriority="high" />
      <div className="home-event-topline"><span>{event.date} · {event.location}</span></div>
      <div className="home-event-content"><div className="home-event-copy"><h2 id="home-event-title">{event.name}</h2><div className="home-event-actions"><Button busy={busy} onClick={ended ? () => navigate('events?event=' + encodeURIComponent(event.id) + '&tab=recap') : enter}>{ended ? 'View recap' : readyForRoom(user) ? 'Preview headset experience' : 'Finish profile'}<ArrowRight size={17} /></Button><Button className="home-meet-people" variant="secondary" busy={busy} onClick={meetPeople}>Meet people<ArrowRight size={16} /></Button><TextAction className="home-event-detail-action" href={'#/events?event=' + encodeURIComponent(event.id)}>Event details</TextAction></div></div>
      <button className="spatial-surface home-profile-card" onClick={() => navigate('profile')} aria-label="Edit your profile"><span className="home-person"><Avatar profile={user} size="large" /><span className="home-person-copy"><strong>{user.name}</strong><span>{user.role || 'Add your role'}</span></span><Pencil size={14} /></span></button></div>
    </section>
    {peopleTab || recapTab ? <>
      <TextAction className="home-back-action" href="#/home" icon={<ArrowLeft size={16} />} iconPosition="start">Back to Home</TextAction>
      {recapTab ? <EventRecap {...props} eventId={event.id} /> : <section aria-label="People at your event"><p className="people-introduction">Explore the people at {event.name}. Open a profile to see your common ground, save it privately, or request to connect.</p><PeopleDirectory {...props} mode="event" eventId={event.id} /></section>}
    </> : <>
      <HomeSections {...props} />
      <section className="product-panel home-explore" aria-labelledby="home-explore-title">
        <PanelHeader title="Other events" headingId="home-explore-title" headingClassName="home-section-title" action={<TextAction href="#/events">All events</TextAction>} />
        <div className="home-explore-list">
          {otherEvents.map(space => <a className="home-space" key={space.id} href={'#/events?event=' + encodeURIComponent(space.id)}>
            <span className="home-space-preview"><img className="home-space-image" src={eventPhoto(space)} alt="" loading="lazy" /></span>
            <span className="home-space-copy"><span className="home-space-meta">{space.date}</span><strong>{space.name}</strong><span className="home-space-description">{space.description}</span><span className="home-space-meta">{space.location}</span></span><ArrowUpRight className="home-space-arrow" size={18} aria-hidden="true" />
          </a>)}
          {otherEvents.length === 0 && <p className="home-focus-hint">Find a space with an event code in All events.</p>}
        </div>
      </section>
    </>}
  </div>;
}

function calendarDownload(event: QuestEvent) {
  if (!event.startsAt || !event.endsAt) return;
  const date = (value: string) => new Date(value).toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}/u, '');
  const escape = (value: string) => value.replace(/\\/gu, '\\\\').replace(/\n/gu, '\\n').replace(/[,;]/gu, match => '\\' + match);
  const contents = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Catalyst//Events//EN', 'BEGIN:VEVENT', 'UID:' + escape(event.id) + '@catalyst.local', 'DTSTAMP:' + date(new Date().toISOString()), 'DTSTART:' + date(event.startsAt), 'DTEND:' + date(event.endsAt), 'SUMMARY:' + escape(event.name), 'DESCRIPTION:' + escape(event.description), 'LOCATION:' + escape(event.location), 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = event.id + '.ics'; link.click(); URL.revokeObjectURL(url);
}
export function EventProduct(props: ProductProps) {
  const { state, busy, act, notify } = props;
  const params = useRouteQuery();
  const now = useNow();
  const requested = params.get('event');
  const event = state.events.find(item => item.id === requested);
  const [code, setCode] = useState(() => params.get('code')?.toUpperCase() ?? '');
  const [create, setCreate] = useState(false);
  useEffect(() => { if (params.has('code')) setCode(params.get('code')!.toUpperCase()); }, [params]);
  const join = async (roomCode: string, createRoom = false) => {
    try { await act('room', { code: roomCode.trim().toUpperCase(), create: createRoom }); notify('Your event is ready.'); navigate('home'); } catch { /* App presents service errors. */ }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void join(code, create); };
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); notify('Event code copied.'); } catch { notify('Couldn’t copy. Select the code and copy it manually.'); } };
  if (requested && !event) return <div className="page-content"><PageHeader title="Event unavailable" description="This event is no longer in your event list." /><Button onClick={() => navigate('events')}>Explore events</Button></div>;
  if (event) {
    const joined = activeEvent(state)?.id === event.id;
    return <div className="product-page product-event-page"><TextAction className="product-back-events" icon={<ArrowLeft size={15} />} iconPosition="start" href="#/events">All events</TextAction><PageHeader className="product-event-heading" title={event.name} description={event.description} />
      <div className="workspace-tabs" role="group" aria-label="Event details"><button aria-pressed={!['people', 'recap'].includes(params.get('tab') ?? '')} onClick={() => navigate('events?event=' + encodeURIComponent(event.id))}>Overview</button><button aria-pressed={params.get('tab') === 'people'} onClick={() => navigate('events?event=' + encodeURIComponent(event.id) + '&tab=people')}>People</button><button aria-pressed={params.get('tab') === 'recap'} onClick={() => navigate('events?event=' + encodeURIComponent(event.id) + '&tab=recap')}>Your recap</button></div>
      {params.get('tab') === 'people' ? <PeopleDirectory {...props} mode="event" eventId={event.id} /> : params.get('tab') === 'recap' ? <EventRecap {...props} eventId={event.id} /> : <div className="workspace-event-detail"><section className="product-panel product-event-overview"><div className="product-overview-image"><img className="event-preview-photo" src={eventPhoto(event)} alt="Conference venue" /><div className="product-scene-wash" /><div><span>{eventPhaseLabel(event, now)}</span><h2>{event.name}</h2></div></div><div className="product-overview-body"><div className="product-event-meta"><span><CalendarDays size={16} /><strong>{event.date}</strong>{event.time}</span><span><MapPin size={16} /><strong>{event.location}</strong>{event.timeZone || ''}</span></div><div className="workspace-code"><span>Event code <strong>{event.code}</strong></span><TextAction icon={<Copy size={15} />} onClick={() => void copy(event.code)}>Copy code</TextAction></div>{event.startsAt && event.endsAt && <TextAction icon={<Download size={16} />} onClick={() => calendarDownload(event)}>Add to calendar</TextAction>}</div></section>
      <section className="product-panel workspace-event-join"><h2>{joined ? 'Your event workspace' : 'Make room for a conversation.'}</h2><p>{joined ? 'Your introduction, people and spatial experience are together on Home.' : 'Join this event to prepare your introduction and explore the people taking part.'}</p><Button busy={busy} onClick={() => joined ? navigate('home') : void join(event.code)}>{joined ? 'Open workspace' : 'Join event'}<ArrowRight size={16} /></Button><div className="workspace-event-explanation"><h3>A little context goes a long way.</h3><p>Share what you bring and what you’re looking for. Discover common ground, then save the people you’d like to keep in touch with.</p></div></section></div>}
    </div>;
  }
  return <div className="page-content event-browser"><PageHeader className="page-heading" title="Find your next event." description="Interesting people. Shared interests. A reason to be there." action={<TextAction href={demoRecapHref(props.user.id)}>Try a completed-conference demo<ArrowUpRight size={15} /></TextAction>} />
    <div className="join-row surface"><div><h2>{create ? 'Create a private room' : 'Have an event code?'}</h2><p>{create ? 'Create a room in this local session.' : 'Join the event your host has shared with you.'}</p></div><form onSubmit={submit}><label className="sr-only" htmlFor="browse-room-code">Event code</label><input id="browse-room-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Enter code" minLength={3} maxLength={8} pattern="[A-Z0-9]{3,8}" required autoFocus={params.get('join') === '1'} /><Button busy={busy} type="submit">{create ? 'Create room' : 'Join event'}<ArrowRight size={16} /></Button></form></div>
    <TextAction className="create-room-link" onClick={() => setCreate(!create)}>{create ? 'Join an existing event' : 'Create a private room'}</TextAction>
    <div className="section-title"><h2>Events to explore</h2></div><div className="event-grid">{[...state.events].sort((a, b) => { const ended = Number(eventPhase(a, now) === 'ended') - Number(eventPhase(b, now) === 'ended'); return ended || Date.parse(a.startsAt ?? '') - Date.parse(b.startsAt ?? '') || a.name.localeCompare(b.name); }).map(item => <article className="event-card surface" key={item.id}><div className="event-cover"><img className="event-preview-photo" src={eventPhoto(item)} alt="Conference venue" loading="lazy" /><span className="glass-label">{eventPhaseLabel(item, now)}</span></div><div className="event-card-body"><div className="event-date"><CalendarDays size={15} />{item.date}<span>{item.time}</span></div><h2>{item.name}</h2><p>{item.description}</p><span className="event-location"><MapPin size={14} />{item.location}</span><Button onClick={() => navigate('events?event=' + encodeURIComponent(item.id))}>Explore event<ArrowUpRight size={15} /></Button></div></article>)}</div>
  </div>;
}
