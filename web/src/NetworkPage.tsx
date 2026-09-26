import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Compass, List, Network, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { Avatar, Button } from "./ui";
import type { Action, Profile, State } from "./types";
import { networkPerson, type NetworkPerson } from "./networkModel";
import { NetworkMap } from "./NetworkMap";
import { NetworkProfile } from "./NetworkProfile";
import "./NetworkPage.css";

type Props = { state: State; user: Profile; connected: string[]; act: Action; busy: boolean; notify: (message: string) => void };
const params = () => new URLSearchParams(location.hash.split("?")[1]);

export function NetworkProduct({ state, user, act, busy, notify }: Props) {
  const [destination, setDestination] = useState<"network" | "discover">(() => params().get("tab") === "discover" ? "discover" : "network");
  const [view, setView] = useState<"map" | "people">("map");
  const [groupBy, setGroupBy] = useState<"connections" | "event" | "interest">("connections");
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [topic, setTopic] = useState("all");
  const [followUp, setFollowUp] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState("recent");
  const [selectedId, setSelectedId] = useState<string | null>(() => params().get("person"));
  const [expanded, setExpanded] = useState(() => params().get("details") === "1");
  const [mobile, setMobile] = useState(() => matchMedia("(max-width: 760px)").matches);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const fullEntry = useRef<string | null>(null);
  const selectionEntry = useRef<string | null>(null);
  const people = useMemo(() => state.profiles.filter(person => person.id !== user.id).map(person => networkPerson(state, user, person)), [state, user]);
  const saved = people.filter(person => person.connection);
  const discovered = people.filter(person => !person.connection && !person.withdrawn && user.visibility?.activeInEvent !== false);
  const selected = people.find(person => person.profile.id === selectedId && (person.connection || !person.withdrawn));
  const pool = destination === "network" ? saved : discovered;
  const topics = [...new Set(pool.flatMap(person => person.profile.interests))].sort();
  const eventIds = [...new Set(saved.map(person => person.connection!.eventId))];
  const activeFilters = Number(eventFilter !== "all") + Number(topic !== "all") + Number(followUp);
  const visible = pool.filter(person => {
    const profile = person.profile;
    const text = [profile.name, profile.role, profile.bio, ...profile.interests, ...profile.skills, ...profile.lookingFor, person.project?.title ?? ""].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase()) &&
      (topic === "all" || profile.interests.includes(topic)) &&
      (destination === "discover" || eventFilter === "all" || person.connection?.eventId === eventFilter) &&
      (destination === "discover" || !followUp || (person.connection?.followUp ?? "needed") === "needed");
  }).sort((left, right) => {
    if (destination === "discover" || sort === "compatibility") return (right.compatibility.score ?? -1) - (left.compatibility.score ?? -1) || left.profile.name.localeCompare(right.profile.name);
    if (sort === "name") return left.profile.name.localeCompare(right.profile.name);
    return Date.parse(right.connection?.createdAt ?? "1970-01-01") - Date.parse(left.connection?.createdAt ?? "1970-01-01");
  });
  const eventNames = Object.fromEntries(saved.map(person => [person.profile.id, state.events.find(event => event.id === person.connection!.eventId)?.name ?? "Your shared room"]));
  const sharedTopics = Object.fromEntries(saved.map(person => [person.profile.id, person.sharedInterests]));

  useEffect(() => {
    const change = () => {
      setSelectedId(params().get("person"));
      setExpanded(params().get("details") === "1");
      setDestination(params().get("tab") === "discover" ? "discover" : "network");
      if (!params().get("person")) selectionEntry.current = null;
      if (params().get("details") !== "1") fullEntry.current = null;
    };
    const media = matchMedia("(max-width: 760px)");
    const resize = () => setMobile(media.matches);
    addEventListener("hashchange", change);
    media.addEventListener("change", resize);
    return () => { removeEventListener("hashchange", change); media.removeEventListener("change", resize); };
  }, []);

  const navigate = (id: string | null, full = false, target = destination, replace = false) => {
    const next = new URLSearchParams();
    if (target === "discover") next.set("tab", "discover");
    if (id) next.set("person", id);
    if (id && full) next.set("details", "1");
    const hash = `#/network${next.size ? `?${next}` : ""}`;
    if (replace) history.replaceState(history.state, "", hash);
    else location.hash = hash;
    setSelectedId(id);
    setExpanded(full);
    setDestination(target);
  };
  const select = (id: string) => {
    selectionTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!selectedId) selectionEntry.current = location.hash;
    fullEntry.current = null;
    navigate(id, false, destination, !!selectedId);
  };
  const close = () => {
    const depth = Number(!!selectionEntry.current) + Number(!!fullEntry.current);
    if (depth) {
      const afterBack = () => {
        if (params().get("person")) navigate(null, false, destination, true);
        selectionTrigger.current?.focus();
      };
      addEventListener("hashchange", afterBack, { once: true });
      history.go(-depth);
    } else navigate(null, false, destination, true);
    fullEntry.current = null;
    selectionEntry.current = null;
    requestAnimationFrame(() => selectionTrigger.current?.focus());
  };
  const toggleExpanded = () => {
    if (expanded) {
      if (fullEntry.current) { fullEntry.current = null; history.back(); }
      else navigate(selectedId, false, destination, true);
    } else {
      fullEntry.current = location.hash;
      navigate(selectedId, true);
    }
  };
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !selected) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = expanded || mobile;
    const oldOverflow = document.body.style.overflow;
    if (dialog.open) dialog.close();
    if (modal) { dialog.showModal(); document.body.style.overflow = "hidden"; }
    else dialog.show();
    if (modal) dialog.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (modal) document.body.style.overflow = oldOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [selected?.profile.id, expanded, mobile]);

  const switchDestination = (target: "network" | "discover") => {
    setTopic("all"); setEventFilter("all"); setFollowUp(false);
    navigate(null, false, target);
  };
  const resetFilters = () => { setQuery(""); setTopic("all"); setEventFilter("all"); setFollowUp(false); };
  const savePerson = async () => {
    if (!selected || selected.connection) return;
    try {
      await act("connections", { participantId: selected.profile.id });
      notify("Connection saved. Find them in your network.");
    } catch { /* App owns the service error. */ }
  };

  return (
    <div className="nx-page">
      <header className="nx-heading">
        <div><h1>Your network</h1><p>A little common ground. A world of possibility.</p></div>
        <label className="nx-search"><Search size={17} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a person, skill, or interest" aria-label="Search network" />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label>
      </header>
      <div className="nx-navigation">
        <div className="nx-destinations" role="group" aria-label="Network destination">
          <button aria-pressed={destination === "network"} onClick={() => switchDestination("network")}><Users size={16} />Your network<span>{saved.length}</span></button>
          <button aria-pressed={destination === "discover"} onClick={() => switchDestination("discover")}><Compass size={16} />Discover<span>{discovered.length}</span></button>
        </div>
        <div className="nx-view-tools">
          {destination === "network" && <div className="nx-view-switch" role="group" aria-label="Network view"><button aria-pressed={view === "map"} onClick={() => setView("map")}><Network size={15} />Map</button><button aria-pressed={view === "people"} onClick={() => setView("people")}><List size={15} />People</button></div>}
          <button className="nx-filter-trigger" aria-expanded={filtersOpen} aria-controls="network-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15} />Filters{activeFilters > 0 && <span>{activeFilters}</span>}</button>
        </div>
      </div>
      {filtersOpen && <div id="network-filters" className="nx-filters">
        {destination === "network" && <label>Event<select aria-label="Filter by event" value={eventFilter} onChange={event => setEventFilter(event.target.value)}><option value="all">All events</option>{eventIds.map(id => <option key={id} value={id}>{state.events.find(event => event.id === id)?.name ?? "Your shared room"}</option>)}</select></label>}
        <label>Interest<select aria-label="Filter by interest" value={topic} onChange={event => setTopic(event.target.value)}><option value="all">All interests</option>{topics.map(value => <option key={value}>{value}</option>)}</select></label>
        {destination === "network" && <label className="nx-check"><input type="checkbox" checked={followUp} onChange={event => setFollowUp(event.target.checked)} />Needs follow-up</label>}
        {(activeFilters > 0 || query) && <button className="nx-text-button" onClick={resetFilters}>Clear filters</button>}
      </div>}
      <div className={`nx-workspace ${selected ? "nx-has-preview" : ""}`}>
        <section className="nx-browser" aria-label={destination === "network" ? "Saved people" : "Discover people"}>
          <div className="nx-browser-header">
            <div><strong>{destination === "discover" ? "A reason to say hello" : view === "map" ? "People worth knowing" : "Your people"}</strong><span>{destination === "discover" ? "Sample attendees · selected for common ground" : `${visible.length} ${visible.length === 1 ? "person" : "people"}${query || activeFilters ? " in this view" : " in your network"}`}</span></div>
            {destination === "network" && (view === "map" ? <label className="nx-group-label">Group by<select aria-label="Group map by" value={groupBy} onChange={event => setGroupBy(event.target.value as typeof groupBy)}><option value="connections">Connections</option><option value="event">Event</option><option value="interest">Shared interests</option></select></label> : <select aria-label="Sort people" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recently saved</option><option value="compatibility">Compatibility</option><option value="name">Name</option></select>)}
          </div>
          {!visible.length ? <div className="nx-empty"><div className="nx-empty-symbol"><Users size={27} /></div><h2>{query || activeFilters ? "No people in this view" : destination === "network" ? "Your next connection starts here" : "You’re all caught up"}</h2><p>{query || activeFilters ? "Try another name, skill, or interest—or clear your filters." : destination === "network" ? "Explore the people in your room. Save someone you’d like to get to know." : "You’ve explored the available sample attendees. Your saved people are waiting in your network."}</p><Button onClick={query || activeFilters ? resetFilters : () => switchDestination(destination === "network" ? "discover" : "network")}>{query || activeFilters ? "Clear filters" : destination === "network" ? "Discover people" : "View your network"}<ArrowRight size={16} /></Button></div>
          : destination === "network" && view === "map" ? <NetworkMap user={user} people={visible.map(person => person.profile)} selectedId={selectedId} onSelect={select} groupBy={groupBy} eventNames={eventNames} sharedTopics={sharedTopics} />
          : destination === "discover" ? <div className="nx-discover-grid">{visible.map(person => <DiscoverCard key={person.profile.id} person={person} selected={person.profile.id === selectedId} onSelect={() => select(person.profile.id)} />)}</div>
          : <div className="nx-people-list">{visible.map(person => <button key={person.profile.id} className="nx-person-row" aria-pressed={selectedId === person.profile.id} onClick={() => select(person.profile.id)}><Avatar profile={person.profile} /><span className="nx-row-identity"><strong>{person.profile.name}</strong><span>{person.profile.role}</span><small>{person.reason}</small></span><span className="nx-row-context">{eventNames[person.profile.id]}<small>{new Date(person.connection!.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></span><FitLabel person={person} /><ArrowUpRight size={16} className="nx-row-arrow" /></button>)}</div>}
          {visible.length > 0 && <footer className="nx-browser-footer"><span><span className="nx-line-key" />{destination === "network" ? "People you’ve saved" : "Sample profiles, real possibilities"}</span><span>{destination === "network" && view === "map" ? "Select a portrait to explore" : "Select someone to get to know them"}</span></footer>}
        </section>
        {selected && <dialog ref={dialogRef} className={`nx-profile-layer ${expanded ? "nx-profile-expanded" : "nx-profile-preview"}`} aria-label={expanded ? `${selected.profile.name} — full profile` : `${selected.profile.name} — profile preview`} onCancel={event => { event.preventDefault(); expanded ? toggleExpanded() : close(); }} onClick={event => { if (event.target === event.currentTarget && (expanded || mobile)) expanded ? toggleExpanded() : close(); }}>
          <NetworkProfile key={`${user.id}:${selected.profile.id}`} person={selected} user={user} state={state} act={act} busy={busy} notify={notify} expanded={expanded} onExpand={toggleExpanded} onClose={close} onSave={() => void savePerson()} />
        </dialog>}
      </div>
      {selectedId && !selected && <p className="nx-unavailable" role="status">This profile is no longer available. <button onClick={close}>Back to your network</button></p>}
      <p className="nx-footnote">Your connections are yours to keep. Saving a person never sends a message.<span>Interactive preview · sample compatibility</span></p>
    </div>
  );
}

function FitLabel({ person }: { person: NetworkPerson }) {
  return <span className={`nx-fit ${person.compatibility.score === null ? "nx-fit-pending" : ""}`}>{person.compatibility.score !== null ? <><span>{person.compatibility.score}<small>/100</small></span><small>Sample fit</small></> : <small>Explore fit</small>}</span>;
}

function DiscoverCard({ person, selected, onSelect }: { person: NetworkPerson; selected: boolean; onSelect: () => void }) {
  return <button className="nx-discover-card" aria-pressed={selected} onClick={onSelect}>
    <div className="nx-discover-top"><Avatar profile={person.profile} size="large" /><FitLabel person={person} /></div>
    <h2>{person.profile.name}</h2><p className="nx-discover-role">{person.profile.role}</p>
    <p className="nx-discover-bio">{person.project?.description || person.profile.bio || "Get to know what they bring to the room."}</p>
    <div className="nx-discover-reason"><span><Check size={14} /></span><p>{person.reason}</p></div>
    <div className="nx-discover-bottom"><span>Explore profile</span><ArrowRight size={17} /></div>
  </button>;
}
