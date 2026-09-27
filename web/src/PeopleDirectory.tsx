import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, List, Network, Search, SlidersHorizontal, Users, X } from "lucide-react";
import type { Action, PairAssessment, Profile, State } from "./types";
import { Avatar, Button, Chip, PageHeader, PanelHeader } from "./ui";
import {
  assessmentMatchLabel,
  assessmentScore,
  MATCH_THRESHOLD,
  networkPerson,
  recommendationRank,
} from "./networkModel";
import { NetworkMap } from "./NetworkMap";
import { requestFor } from "./connectionRequests";
import { useCompatibility } from "./CompatibilityContext";

export type PeopleDirectoryProps = {
  state: State;
  user: Profile;
  act: Action;
  busy: boolean;
  notify: (message: string) => void;
  eventId?: string;
  mode: "event" | "network";
  limit?: number;
  pageHeading?: boolean;
  headerContent?: ReactNode;
  allowMap?: boolean;
};

let profileTrigger: HTMLElement | null = null;

function hashWithPerson(personId: string, eventId?: string, audience?: "event" | "network") {
  const [path, raw = ""] = location.hash.split("?");
  const query = new URLSearchParams(raw);
  query.set("person", personId);
  if (eventId) query.set("event", eventId);
  if (audience) query.set("audience", audience);
  return `${path || "#/home"}?${query}`;
}

export function openPersonProfile(personId: string, eventId?: string, audience?: "event" | "network") {
  profileTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  history.pushState({ ...history.state, catalystProfile: true, profileOrigin: location.hash }, "", hashWithPerson(personId, eventId, audience));
  dispatchEvent(new HashChangeEvent("hashchange"));
}

export function consumeProfileTrigger() { return profileTrigger; }

function Score({ assessment, loading }: { assessment: PairAssessment | null; loading?: boolean }) {
  const score = assessmentScore(assessment);
  return (
    <span className={`nx-fit ${score !== null && score >= MATCH_THRESHOLD ? "nx-fit-high" : ""}`}>
      {score !== null
        ? <><span>{score}<small>/100</small></span><small>{assessmentMatchLabel(assessment)}</small></>
        : <small>{loading ? "Assessing fit…" : assessment ? "Score unavailable" : "View fit"}</small>}
    </span>
  );
}

function PersonRow({ state, user, profile, eventId, prefetch, audience }: {
  state: State;
  user: Profile;
  profile: Profile;
  eventId?: string;
  prefetch: boolean;
  audience: "event" | "network";
}) {
  const { assessment, loading } = useCompatibility(profile.id, eventId, audience, prefetch);
  const person = networkPerson(state, user, profile, assessment ?? undefined, audience);
  const relationship = requestFor(state, user.id, profile.id);
  return (
    <button className="nx-person-row" aria-label={`View ${profile.name}'s profile`} onClick={() => openPersonProfile(profile.id, eventId, audience)}>
      <Avatar profile={person.profile} />
      <span className="nx-row-identity">
        <strong>{person.profile.name}</strong>
        <span>{person.profile.role}</span>
        {relationship?.status === "accepted" && <small className="nx-relationship is-connected">Connected</small>}
        {relationship?.status === "pending" && <small className="nx-relationship">{relationship.senderId === user.id ? "Request sent" : "Wants to connect"}</small>}
        {audience === "event" && <small className="nx-row-reason">{person.reason}</small>}
        {person.topics.length > 0 && (
          <span className="nx-row-topics" aria-label={`Topics: ${person.topics.join(", ")}`}>
            {person.topics.map((topic) => <Chip key={topic}>{topic}</Chip>)}
          </span>
        )}
      </span>
      <Score assessment={assessment} loading={loading} />
      <ArrowRight className="nx-row-arrow" size={17} aria-hidden="true" />
    </button>
  );
}

export function PeopleDirectory({ state, user, eventId, mode, limit, pageHeading = false, headerContent, allowMap = true }: PeopleDirectoryProps) {
  const [view, setView] = useState<"people" | "map">("people");
  const mapAllowed = allowMap;
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState(eventId ?? "all");
  const [topic, setTopic] = useState("all");
  const [followUp, setFollowUp] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<"recommended" | "recent" | "name">(mode === "event" ? "recommended" : "recent");
  const [groupBy, setGroupBy] = useState<"connections" | "event" | "interest">("connections");
  const compact = limit !== undefined;
  const event = eventId ? state.events.find((candidate) => candidate.id === eventId) : undefined;
  const roster = new Set(event?.participantIds ?? []);
  const people = useMemo(() => state.profiles
    .filter((profile) => profile.id !== user.id)
    .map((profile) => networkPerson(state, user, profile, undefined, mode))
    .filter((person) => mode === "network"
      ? !!person.connection && (!eventId || person.connection.eventId === eventId)
      : roster.has(person.profile.id) && person.profile.visibility?.activeInEvent !== false), [eventId, mode, roster, state, user]);
  const topics = [...new Set(people.flatMap((person) => person.topics))].sort();
  const eventIds = [...new Set(people.flatMap((person) => person.connection?.eventId ? [person.connection.eventId] : []))];
  const activeFilters = Number(eventFilter !== "all" && !eventId) + Number(topic !== "all") + Number(followUp);
  const visible = people.filter((person) => {
    const haystack = [person.profile.name, person.profile.role, person.profile.bio, ...person.profile.interests, ...person.profile.skills, ...person.profile.lookingFor].join(" ").toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) &&
      (eventId || eventFilter === "all" || person.connection?.eventId === eventFilter) &&
      (topic === "all" || person.topics.includes(topic)) &&
      (!followUp || (person.connection?.followUp ?? "needed") === "needed");
  }).sort((left, right) => {
    if (compact && mode === "event" && Boolean(left.connection) !== Boolean(right.connection)) return left.connection ? 1 : -1;
    if (sort === "name") return left.profile.name.localeCompare(right.profile.name);
    if (sort === "recommended") return recommendationRank(right) - recommendationRank(left) || left.profile.name.localeCompare(right.profile.name);
    return Date.parse(right.connection?.createdAt ?? "1970-01-01") - Date.parse(left.connection?.createdAt ?? "1970-01-01") || left.profile.name.localeCompare(right.profile.name);
  });
  const shown = compact ? visible.slice(0, limit) : visible;
  const resetFilters = () => { setQuery(""); setEventFilter(eventId ?? "all"); setTopic("all"); setFollowUp(false); };
  const eventNames = Object.fromEntries(people.map((person) => [person.profile.id, state.events.find((item) => item.id === person.connection?.eventId)?.name ?? "Unknown event"]));
  const sharedTopics = Object.fromEntries(people.map((person) => [person.profile.id, person.sharedInterests]));

  const search = <label className="nx-search"><Search size={17} aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person, skill, or interest" aria-label="Search people" />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label>;
  return (
    <div className={`people-directory ${compact ? "people-directory--compact" : ""}`}>
      {pageHeading && <PageHeader className="nx-heading" title="Your network" description="People you've saved or connected with. Pick up where you left off." action={search} />}
      {headerContent}
      {!compact && (
        <>
          <div className="nx-navigation nx-navigation--directory">
            <div className="nx-directory-title"><Users size={16} /><span>{mode === "network" ? "Your network" : "People at this event"}</span><small>{people.length}</small></div>
            <div className="nx-view-tools">
              {mode === "network" && mapAllowed && <div className="nx-view-switch" role="group" aria-label="Network view"><button aria-pressed={view === "people"} onClick={() => setView("people")}><List size={15} />People</button><button aria-pressed={view === "map"} onClick={() => setView("map")}><Network size={15} />Map</button></div>}
              <button className="nx-filter-trigger" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={15} />Filters{activeFilters > 0 && <span>{activeFilters}</span>}</button>
            </div>
          </div>
          {!pageHeading && <div className="nx-toolbar">{search}</div>}
          {filtersOpen && <div className="nx-filters">
            {mode === "network" && !eventId && <label className="nx-filter-pill nx-filter-select"><span>Event</span><select aria-label="Filter by event" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}><option value="all">All events</option>{eventIds.map((id) => <option key={id} value={id}>{state.events.find((item) => item.id === id)?.name ?? "Unknown event"}</option>)}</select></label>}
            <label className="nx-filter-pill nx-filter-select"><span>Interest</span><select aria-label="Filter by interest" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="all">All interests</option>{topics.map((value) => <option key={value}>{value}</option>)}</select></label>
            {mode === "network" && <label className="nx-filter-pill nx-check"><input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} /><span className="nx-filter-checkmark" aria-hidden="true"><Check size={12} /></span><span>Needs follow-up</span></label>}
            {(activeFilters > 0 || query) && <button className="nx-text-button" onClick={resetFilters}>Clear filters</button>}
          </div>}
        </>
      )}
      <div className={compact ? "" : `nx-workspace ${view === "people" ? "nx-workspace-people" : ""}`}>
      <section className={`nx-browser ${compact ? "nx-browser--compact" : ""}`} aria-label={mode === "network" ? "Your people" : "Event people"}>
        {!compact && <PanelHeader className="nx-browser-header" title={mode === "network" ? "Your people" : "People at this event"} description={`${visible.length} ${visible.length === 1 ? "person" : "people"}${query || activeFilters ? " in this view" : mode === "network" ? " in your network" : " at this event"}`} action={view === "map" ? <label className="nx-group-label">Group by<select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}><option value="connections">Connections</option><option value="event">Event</option><option value="interest">Shared interests</option></select></label> : <select aria-label="Sort people" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>{mode === "event" ? <option value="recommended">Recommended</option> : <option value="recent">Recently added</option>}<option value="name">Name</option></select>} />}
        {!shown.length ? <div className="nx-empty"><div className="nx-empty-symbol"><Users size={26} /></div><h2>{query || activeFilters ? "No people in this view" : mode === "network" ? "No people in your network yet" : "No one is sharing here yet"}</h2><p>{query || activeFilters ? "Try another name, skill, or interest." : mode === "network" ? "Connect with someone or save their profile from an event to keep them here." : "When attendees join this event, their shared profiles will appear here."}</p>{query || activeFilters ? <Button onClick={resetFilters}>Clear filters</Button> : mode === "network" ? <Button onClick={() => { location.hash = "#/home?tab=people"; }}>Find people</Button> : null}</div>
        : mode === "network" && view === "map" && mapAllowed ? <NetworkMap user={user} people={shown.map((person) => person.profile)} selectedId={null} onSelect={(id) => openPersonProfile(id, eventId, "network")} groupBy={groupBy} eventNames={eventNames} sharedTopics={sharedTopics} />
        : <div className="nx-people-list">{shown.map((person) => <PersonRow key={person.profile.id} state={state} user={user} profile={person.profile} eventId={eventId ?? person.connection?.eventId} prefetch={compact || mode === "network"} audience={mode} />)}</div>}
        {!compact && mode === "network" && view === "map" && mapAllowed && shown.length > 0 && <footer className="nx-browser-footer"><span><span className="nx-line-key" />People in your network</span><span>Select a portrait to explore</span></footer>}
      </section>
      </div>
    </div>
  );
}
