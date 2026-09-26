import { useState } from 'react';
import { ArrowRight, Pencil } from 'lucide-react';
import type { Action, Profile, State } from './types';
import { Avatar, Button, Chip, PanelHeader, TextAction } from './ui';
import { openPersonProfile } from './PeopleDirectory';
import { networkPerson } from './networkModel';
import { homeEvent } from './eventModel';

type Props = { state: State; user: Profile; connected: string[]; act: Action; busy: boolean; notify: (message: string) => void };

/** Familiar Home sections remain useful before, during and after an event. */
export function HomeSections(props: Props) {
  const { state, user } = props;
  const [expandedFocus, setExpandedFocus] = useState(false);
  const recent = state.profiles.filter(profile => profile.id !== user.id)
    .map(profile => networkPerson(state, user, profile))
    .filter(person => person.connection)
    .sort((a, b) => Date.parse(b.connection!.createdAt) - Date.parse(a.connection!.createdAt))
    .slice(0, 3);
  const lookingFor = user.lookingFor.filter(item => item.trim());
  const peopleLink = homeEvent(state) ? '#/home?tab=people' : '#/events';
  return <div className="product-home-grid workspace-home-sections">
    <section className="product-panel home-focus-panel" aria-labelledby="home-focus-title">
      <PanelHeader title="Your focus" headingId="home-focus-title" headingClassName="home-section-title" action={<a className="home-focus-edit" href="#/profile?section=focus" aria-label="Edit focus"><Pencil size={16} aria-hidden="true" /></a>} />
      {user.bio.trim() ? <>
        <p className="home-focus-statement">{user.bio}</p>
        {lookingFor.length > 0 && <div className="home-focus-topics"><p>Looking for</p><div className="home-focus-pills" id="home-focus-topics">{lookingFor.slice(0, expandedFocus ? undefined : 2).map(value => <Chip key={value}>{value}</Chip>)}{lookingFor.length > 2 && <button className="chip chip--interactive" aria-expanded={expandedFocus} aria-controls="home-focus-topics" onClick={() => setExpandedFocus(!expandedFocus)}>{expandedFocus ? 'Show less' : '+' + (lookingFor.length - 2) + ' more'}</button>}</div></div>}
        <Button className="home-focus-action" onClick={() => { location.hash = peopleLink; }}>Find collaborators</Button>
      </> : <><p className="home-focus-statement">What are you working on?</p><p className="home-focus-hint">Share what you’re building and who you’d like to meet.</p><Button className="home-focus-action" onClick={() => { location.hash = '#/profile?section=focus'; }}>Set your focus</Button></>}
    </section>
    <section className="product-panel product-connections-panel"><PanelHeader title="Recent connections" headingClassName="home-section-title" action={<TextAction href="#/network">View network</TextAction>} /><div className="product-connection-list">
      {recent.map(person => <div className="product-connection-row" key={person.profile.id}>
        <button className="home-connection-profile" aria-label={`View ${person.profile.name}'s profile`} onClick={() => openPersonProfile(person.profile.id, person.connection?.eventId, 'network')}>
          <Avatar profile={person.profile} />
          <span className="product-connection-copy"><strong>{person.profile.name}<small>{person.profile.role}</small></strong>
            {person.sharedInterests.length > 0 ? <span className="home-connection-topics">{person.sharedInterests.map(topic => <Chip key={topic}>{topic}</Chip>)}</span> : <span>{person.reason}</span>}
          </span>
          <ArrowRight className="home-connection-arrow" size={17} aria-hidden="true" />
        </button>
      </div>)}
      {recent.length === 0 && <div className="home-connections-empty"><h3>Your network starts in the room.</h3><p>Meet someone, find common ground, and save their profile here.</p><Button variant="secondary" onClick={() => { location.hash = peopleLink; }}>Find people</Button></div>}
    </div></section>
  </div>;
}
