import type { Profile } from './types';
import { ArrowUpRight, Bookmark, Check, MapPin, CalendarDays } from 'lucide-react';
import { Avatar, Button, Chip, Disclosure, PanelHeader } from './ui';
import { eventPhoto } from './eventModel';
import seed from '../shared/demo-data.json';
import type { MouseEventHandler } from 'react';
import './LandingProduct.css';

export function LandingProduct({ onEnter, entering }: { onEnter: MouseEventHandler<HTMLButtonElement>; entering: boolean }) {
  const maya = (seed.profiles as Profile[]).find(person => person.id === 'maya')!;
  const event = seed.events.find(item => item.id === 'demo')!;
  return <div className="lp-product">
    <section className="lp-event" id="lp-event" data-landing-stop aria-labelledby="lp-event-title">
      <div className="lp-section-heading">
        <h2 id="lp-event-title">Start with the room<br />you’re in.</h2>
        <p>A shared place. Something you’re building. People with a different piece of the puzzle.</p>
      </div>
      <div className="event-grid lp-event-grid">
        {seed.events.slice(0, 3).map(item => <article className="event-card surface" key={item.id}>
          <div className="event-cover"><img className="event-preview-photo" src={eventPhoto(item)} alt="" loading="lazy" /><span className="glass-label">Demo event</span></div>
          <div className="event-card-body">
            <div className="event-date"><CalendarDays size={15} /><span>{item.date}</span></div>
            <h3>{item.name}</h3><p>{item.description}</p>
            <span className="event-location"><MapPin size={14} />{item.location}</span>
            <span className="lp-event-time">{item.time}</span>
          </div>
        </article>)}
      </div>
      <div className="lp-event-caption"><span>Three rooms. Different perspectives. A reason to meet.<small>Illustrative events from the browser demo.</small></span><Button onClick={onEnter} disabled={entering}>Explore the demo<ArrowUpRight size={16} /></Button></div>
    </section>

    <section className="lp-connection" data-landing-stop id="lp-network" aria-labelledby="lp-network-title">
      <div className="lp-connection-copy"><h2 id="lp-network-title">The conversation ends.<br /><span>The possibility doesn’t.</span></h2><p>Keep the person, the common ground, and the idea you wanted to come back to.</p><div className="lp-memory"><Bookmark size={18} /><span>A little context makes the next hello easier.</span></div></div>
      <article className="lp-profile" aria-label="Illustrative saved connection with Maya">
        <PanelHeader title="Your connections" action={<span className="lp-example">Demo preview</span>} />
        <div className="lp-profile-body">
          <div className="lp-person lp-person-large"><Avatar profile={maya} size="large" /><div><h3>{maya.name}</h3><span>{maya.role}</span></div><span className="lp-saved"><Check size={14} />Saved</span></div>
          <p className="lp-bio">{maya.bio}</p>
          <div className="lp-context"><span className="lp-label">In common</span><div className="lp-pills"><Chip>Assistive technology</Chip><Chip>Robotics</Chip></div></div>
          <div className="lp-complement"><div><span className="lp-label">You bring</span><strong>Embedded systems</strong></div><ArrowUpRight size={18} /><div><span className="lp-label">Maya brings</span><strong>Computer vision</strong></div></div>
          <Disclosure className="lp-details" title="A reason to reconnect"><div><p>Explore how visual assistance could work on wearable hardware.</p><span>Illustrative follow-up idea · {event.name}</span></div></Disclosure>
        </div>
      </article>
    </section>
  </div>;
}
