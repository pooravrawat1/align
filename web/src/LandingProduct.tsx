import type { Profile } from './types';
import { ArrowUpRight, Bookmark, MapPin, CalendarDays } from 'lucide-react';
import { Button } from './ui';
import { eventPhoto } from './eventModel';
import seed from '../shared/demo-data.json';
import type { MouseEventHandler } from 'react';
import { RecentConnectionsPanel } from './HomeSections';
import './ProductPages.css';
import './Home.css';
import './LandingProduct.css';

export function LandingProduct({ onEnter, entering }: { onEnter: MouseEventHandler<HTMLButtonElement>; entering: boolean }) {
  const recent = ['leo', 'nina', 'jordan'].map(id => {
    const profile = (seed.profiles as Profile[]).find(person => person.id === id)!;
    return { profile, topics: profile.interests.slice(0, 3), reason: '' };
  });
  return <div className="lp-product">
    <section className="lp-event" id="lp-event" data-landing-stop aria-labelledby="lp-event-title">
      <div className="lp-section-heading">
        <div className="lp-event-intro">
          <h2 id="lp-event-title">Start with the room<br />you’re in.</h2>
          <p>Join an event. Share your interests and skills.<br />Find people you have a reason to meet.</p>
        </div>
        <Button onClick={onEnter} disabled={entering}>Explore the demo<ArrowUpRight size={16} /></Button>
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
    </section>

    <section className="lp-connection" data-landing-stop id="lp-network" aria-labelledby="lp-network-title">
      <div className="lp-connection-copy"><h2 id="lp-network-title">The event ends.<br /><span>The connection doesn’t.</span></h2><p>Save the people you meet, remember what you have in common, and keep notes for your next conversation.</p><div className="lp-memory"><Bookmark size={18} /><span>Who you met. Where you met. What you want to follow up on.</span></div></div>
      <div className="home-page lp-dashboard-preview">
        <RecentConnectionsPanel people={recent} onOpen={(_, event) => onEnter(event)} action={<button className="text-action" onClick={onEnter} disabled={entering}>View network</button>} />
      </div>
    </section>
  </div>;
}
