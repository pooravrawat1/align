import { useMemo, useState } from 'react';
import { ArrowRight, Bookmark, Check, Maximize2, Minus, Plus, Search, Sparkles, X } from 'lucide-react';
import type { Profile, State } from './types';
import { Avatar, Button, Chip } from './ui';
import { graphPeople, graphLayout, type GraphPerson } from './networkGraphModel';
import { openPersonProfile } from './PeopleDirectory';
import './NetworkGraph.css';
import { useGraphCamera } from './useGraphCamera';
import type { Point } from './graphCamera';
import { intersection } from './networkModel';

const labels: Record<string, string> = { connected: 'Connected', saved: 'Saved privately', suggested: 'Potential introduction', event: 'At your event' };

function PersonDetail({ person }: { person: GraphPerson }) {
  const first = person.profile.name.split(' ')[0];
  return <>
    <div className="cg-detail-identity"><Avatar profile={person.profile} size="large" /><h2>{person.profile.name}</h2><p>{person.profile.role}</p><span className={`cg-status cg-status--${person.kind}`}>{person.kind === 'connected' ? <Check size={13} /> : person.kind === 'saved' ? <Bookmark size={13} /> : <Sparkles size={13} />}{labels[person.kind]}</span></div>
    <section className="cg-reason"><h3>A reason to say hello</h3><p>{person.reason}</p></section>
    {person.sharedInterests.length > 0 && <section><h3>Common ground</h3><div className="cg-chips">{person.sharedInterests.map(topic => <Chip key={topic}>{topic}</Chip>)}</div></section>}
    {(person.theyOffer.length > 0 || person.youOffer.length > 0) && <section className="cg-exchange">
      {person.theyOffer.length > 0 && <div><h3>{first} can help you with</h3><div className="cg-chips">{person.theyOffer.map(topic => <Chip key={topic}>{topic}</Chip>)}</div></div>}
      {person.youOffer.length > 0 && <div><h3>You can help {first} with</h3><div className="cg-chips">{person.youOffer.map(topic => <Chip key={topic}>{topic}</Chip>)}</div></div>}
    </section>}
    <Button className="cg-profile-action" onClick={() => openPersonProfile(person.profile.id, person.eventId, person.audience)}>View profile <ArrowRight size={16} /></Button>
    <p className="cg-detail-note">{person.kind === 'connected' ? 'Pick up the conversation from their profile.' : 'Review their profile to connect or save for later.'}</p>
  </>;
}

export function NetworkGraph({ state, user }: { state: State; user: Profile }) {
  const people = useMemo(() => graphPeople(state, user), [state, user]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const emphasizedId = hoveredId ?? selectedId;
  const [query, setQuery] = useState('');
  const [topicsVisible, setTopicsVisible] = useState(false);
  const [filter, setFilter] = useState('all');
  const [offsets, setOffsets] = useState<Record<string, Point>>({});
  const filtered = people.filter(person => filter === 'all' || person.kind === filter);
  const selected = filtered.find(person => person.profile.id === selectedId);
  const matches = filtered.filter(person => `${person.profile.name} ${person.profile.role} ${person.topics.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  // A settled constellation, not a continuously moving force simulation.
  const nodes = graphLayout(people).map(({ person, x, y }) => {
    const offset = offsets[person.profile.id] ?? { x: 0, y: 0 };
    return { person, x: x + offset.x, y: y + offset.y };
  }).filter(node => filtered.includes(node.person));
  const camera = useGraphCamera(nodes, (id, delta) => setOffsets(previous => {
    const moved = nodes.find(node => node.person.profile.id === id);
    const next = { ...previous, [id]: { x: (previous[id]?.x ?? 0) + delta.x, y: (previous[id]?.y ?? 0) + delta.y } };
    if (!moved) return next;
    const x = moved.x + delta.x, y = moved.y + delta.y;
    for (const other of nodes) {
      if (other.person.profile.id === id) continue;
      const dx = other.x - x, dy = other.y - y, distance = Math.hypot(dx, dy);
      if (distance >= 90) continue;
      const push = (90 - distance) * .2, key = other.person.profile.id;
      next[key] = { x: (previous[key]?.x ?? 0) + (distance ? dx / distance : 1) * push, y: (previous[key]?.y ?? 0) + (distance ? dy / distance : 0) * push };
    }
    return next;
  }), setSelectedId);
  const seenLinks = new Set<string>();
  const peerLinks = nodes.flatMap(node => nodes.filter(other => other !== node)
    .map(other => ({ from: node, to: other, shared: intersection(node.person.profile.interests, other.person.profile.interests) }))
    .filter(link => link.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || Math.hypot(a.from.x - a.to.x, a.from.y - a.to.y) - Math.hypot(b.from.x - b.to.x, b.from.y - b.to.y))
    .slice(0, 3).filter(link => { const key = [link.from.person.profile.id, link.to.person.profile.id].sort().join(':'); if (seenLinks.has(key)) return false; seenLinks.add(key); return true; }));
  const topics = Array.from(new Set(people.flatMap(person => person.sharedInterests))).slice(0, 5);
  const topicNodes = topics.map((topic, index) => ({ topic, x: 450 + Math.cos(index / topics.length * Math.PI * 2 - .4) * 145, y: 320 + Math.sin(index / topics.length * Math.PI * 2 - .4) * 110 }));
  const dim = (person: GraphPerson) => query.trim() ? !matches.includes(person) : !!selected && selected.profile.id !== person.profile.id;
  const select = (id: string) => setSelectedId(id);
  const focusPerson = (id: string) => { select(id); setQuery(''); const node = nodes.find(node => node.person.profile.id === id); if (node) camera.focus(node); };
  return <section className="cg-shell" aria-label="Connection graph">
    <div className="cg-map">
      <div className="cg-toolbar">
        <div className="cg-search-wrap"><label className="cg-search"><Search size={15} /><input aria-label="Find a person in the graph" placeholder="Find a person" value={query} onChange={event => { setQuery(event.target.value); setSelectedId(null); }} onKeyDown={event => { if (event.key === 'Enter' && matches[0]) focusPerson(matches[0].profile.id); }} />{query && <button aria-label="Clear graph search" onClick={() => { setQuery(''); setSelectedId(null); }}><X size={14} /></button>}</label>{query && <div className="cg-search-results" aria-label="Graph search results">{matches.slice(0, 6).map(person => <button key={person.profile.id} onClick={() => focusPerson(person.profile.id)}>{person.profile.name}<ArrowRight size={13} /></button>)}{!matches.length && <p>No matching people</p>}</div>}</div>
        <button className="cg-pill" aria-pressed={topicsVisible} onClick={() => setTopicsVisible(!topicsVisible)}>Topics</button>
        <select className="cg-pill" aria-label="Graph relationship filter" value={filter} onChange={event => { setFilter(event.target.value); setSelectedId(null); setQuery(''); }}><option value="all">Everyone</option><option value="connected">Connected</option><option value="saved">Saved</option><option value="suggested">Introductions</option></select>
        <div className="cg-zoom"><button aria-label="Zoom out" disabled={camera.camera.scale <= .35} onClick={() => camera.zoom(.8)}><Minus size={15} /></button><button aria-label="Fit everyone" onClick={camera.fit}><Maximize2 size={15} /></button><button aria-label="Zoom in" disabled={camera.camera.scale >= 2.5} onClick={() => camera.zoom(1.25)}><Plus size={15} /></button></div>
      </div>
      <div className={`cg-stage${camera.dragging ? ' is-dragging' : ''}${camera.camera.scale < .7 ? ' is-zoomed-out is-overview' : ''}`} ref={camera.stage} tabIndex={0} aria-label={`Interactive network with ${people.length + 1} people. Drag to pan, scroll to zoom. Arrow keys pan; plus and minus zoom.`} onPointerDown={camera.down} onPointerMove={camera.move} onPointerLeave={() => { camera.leave(); setHoveredId(null); }} onPointerUp={camera.up} onPointerCancel={camera.up} onLostPointerCapture={camera.up} onKeyDown={event => {
        if (event.key === 'Escape') setSelectedId(null);
        if (event.target !== event.currentTarget) return;
        const directions: Record<string, Point> = { ArrowLeft: { x: 40, y: 0 }, ArrowRight: { x: -40, y: 0 }, ArrowUp: { x: 0, y: 40 }, ArrowDown: { x: 0, y: -40 } };
        if (directions[event.key]) { event.preventDefault(); camera.pan(directions[event.key].x, directions[event.key].y); }
        if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); camera.zoom(event.key === '-' ? .8 : 1.25); }
        if (event.key === 'Home') { event.preventDefault(); camera.fit(); }
      }}>
        <div className="cg-scene" style={{ transform: `translate(${camera.camera.x}px, ${camera.camera.y}px) scale(${camera.camera.scale})` }}>
          <svg viewBox="0 0 900 640" preserveAspectRatio="none" aria-hidden="true" className="cg-lines">
            {peerLinks.map(({ from, to, shared }) => {
              const highlighted = from.person.profile.id === emphasizedId || to.person.profile.id === emphasizedId;
              return <g key={`${from.person.profile.id}-${to.person.profile.id}`} className={`cg-peer-link${highlighted ? ' is-highlighted' : ''}`}><path d={`M${from.x} ${from.y} Q${(from.x + to.x) / 2} ${(from.y + to.y) / 2 - 25} ${to.x} ${to.y}`} />{highlighted && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 16} textAnchor="middle">{shared[0]}</text>}</g>;
            })}
            {nodes.filter(({ person }) => person.kind === 'connected' || person.kind === 'suggested' || selected?.profile.id === person.profile.id).map(({ person, x, y }) => <path key={person.profile.id} className={`cg-edge cg-edge--${person.kind}${emphasizedId === person.profile.id ? ' is-selected' : ''}${dim(person) && emphasizedId !== person.profile.id ? ' is-dim' : ''}`} d={`M450 320 Q${(450 + x) / 2 + 24} ${(320 + y) / 2 - 20} ${x} ${y}`} />)}
            {topicsVisible && topicNodes.flatMap(topic => nodes.filter(({ person }) => person.sharedInterests.includes(topic.topic) && (!selected || person.profile.id === selected.profile.id)).map(({ person, x, y }) => <path key={`${topic.topic}-${person.profile.id}`} className="cg-topic-edge" d={`M${topic.x} ${topic.y} L${x} ${y}`} />))}
          </svg>
          <div className="cg-self" style={{ left: '50%', top: '50%' }}><Avatar profile={user} /><span>You</span></div>
          {nodes.map(({ person, x, y }) => <button key={person.profile.id} data-node-id={person.profile.id} onPointerEnter={() => setHoveredId(person.profile.id)} onPointerLeave={() => setHoveredId(null)} title={`${person.profile.name} · ${person.profile.role}`} className={`cg-node${dim(person) ? ' is-dim' : ''}${selected?.profile.id === person.profile.id ? ' is-selected' : ''}`} style={{ left: `${x / 9}%`, top: `${y / 6.4}%` }} aria-label={`Explore ${person.profile.name}`} aria-pressed={selected?.profile.id === person.profile.id} onClick={event => { if (event.detail === 0) select(person.profile.id); }}><span className="cg-node-photo"><Avatar profile={person.profile} />{person.kind === 'saved' && <Bookmark size={12} className="cg-node-mark" />}{person.kind === 'connected' && <Check size={12} className="cg-node-mark" />}</span><span className="cg-node-name">{person.profile.name}</span></button>)}
          {topicsVisible && topicNodes.map(topic => <span key={topic.topic} className="cg-topic" style={{ left: `${topic.x / 9}%`, top: `${topic.y / 6.4}%` }}>{topic.topic}</span>)}
        </div>
        {!people.length && <p className="cg-empty">Join an event or save a profile to start your map.</p>}
        {people.length > 0 && !filtered.length && <p className="cg-empty">No people in this view yet. Choose Everyone to explore.</p>}
        {query && !matches.length && <p className="cg-empty">No people match “{query}”.</p>}
      </div>
      <div className="cg-legend"><span><i />Connected</span><span><i className="cg-dashed" />Potential introduction</span><span><i className="cg-shared-line" />Shared interest</span><span><Bookmark size={12} />Saved privately</span><span>Drag to explore · Scroll to zoom</span></div>
    </div>
    <aside className="cg-detail" aria-label="Graph selection">
      {selected ? <PersonDetail key={selected.profile.id} person={selected} /> : <div className="cg-welcome"><Sparkles size={24} /><h2>See what brings<br />you together.</h2><p>Select a person to discover shared interests and the ways you could help each other.</p><div className="cg-suggestions"><h3>Explore a connection</h3>{filtered.slice(0, 3).map(person => <button key={person.profile.id} onClick={() => focusPerson(person.profile.id)}><Avatar profile={person.profile} /><span><strong>{person.profile.name}</strong><small>{person.theyOffer[0] ?? person.sharedInterests[0] ?? person.profile.role}</small></span><ArrowRight size={15} /></button>)}</div><p className="cg-detail-note">Lines show relationships, not physical distance. Potential introductions are based on shared profile information.</p></div>}
    </aside>
  </section>;
}
