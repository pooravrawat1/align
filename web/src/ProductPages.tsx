import { useEffect, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  Glasses,
  MapPin,
  Network,
  Pencil,
  RefreshCw,
  RotateCcw,
  Sparkles,
  UserRound,
  Users,
  Wifi,
} from "lucide-react";
import type {
  Action,
  Connection,
  Event as QuestEvent,
  Profile,
  State,
} from "./types";
import { Avatar, Button, Tags } from "./ui";
import "./ProductPages.css";
import "./Home.css";
import { ContactLinks } from "./ProfileContactLinks";
import { HomeCollaborators } from "./HomeCollaborators";

type ProductProps = {
  state: State;
  user: Profile;
  connected: string[];
  act: Action;
  busy: boolean;
  notify: (message: string) => void;
};

type EventPhase = "before" | "during" | "after";

const FALLBACK_EVENT: QuestEvent = {
  id: "demo",
  code: "DEMO",
  name: "The Builders Room",
  description: "Good ideas start with a conversation.",
  location: "Atlanta · Main hall",
  date: "September 26",
  time: "10:00 AM – 6:00 PM",
  status: "Demo event",
};

function eventPhoto(event: QuestEvent) {
  return event.id === "spatial"
    ? {
        src: "/assets/event-audience.webp",
        alt: "Attendees listening to a conference session — illustrative event photo",
      }
    : {
        src: "/assets/home-conference.webp",
        alt: "Conference venue with round tables and projection screens — illustrative venue photo",
      };
}

const readinessFields = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "bio", label: "Bio" },
  { key: "interests", label: "Interests" },
  { key: "skills", label: "Skills" },
  { key: "lookingFor", label: "Looking for" },
] as const;

function navigate(path: string) {
  location.hash = path.startsWith("#/") ? path.slice(1) : `/${path}`;
}

function currentEvent(state: State) {
  const activeCode = state.session?.code?.toUpperCase();
  return (
    (activeCode
      ? state.events.find((event) => event.code.toUpperCase() === activeCode)
      : undefined) ??
    state.events.find((event) => event.code.toUpperCase() === "DEMO") ??
    state.events[0] ??
    FALLBACK_EVENT
  );
}

function firstName(profile: Profile) {
  return profile.name.trim().split(/\s+/u)[0] || profile.name;
}

function isPresent(value: string | string[]) {
  return Array.isArray(value)
    ? value.some((item) => item.trim().length > 0)
    : value.trim().length > 0;
}

function profileReadiness(user: Profile) {
  const items = readinessFields.map(({ key, label }) => ({
    key,
    label,
    ready: isPresent(user[key]),
  }));
  const readyCount = items.filter((item) => item.ready).length;
  return {
    items,
    readyCount,
    complete: readyCount === items.length,
  };
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function intersect(left: string[], right: string[]) {
  const rightValues = new Set(right.map(normalize));
  return left.filter((item) => rightValues.has(normalize(item)));
}

function connectionParticipantId(
  connection: Connection,
  userId: string,
): string | undefined {
  const ownerId = connection.ownerId ?? connection.userA;
  if (ownerId !== userId) return undefined;
  return (
    connection.participantId ??
    (ownerId === connection.userA ? connection.userB : connection.userA)
  );
}

function otherProfile(state: State, connection: Connection, userId: string) {
  const otherId = connectionParticipantId(connection, userId);
  return state.profiles.find((profile) => profile.id === otherId);
}

function connectionIdentity(connection: Connection) {
  return `${connection.ownerId ?? connection.userA}-${connection.participantId ?? connection.userB}-${connection.createdAt}`;
}

function userConnections(state: State, user: Profile, connected: string[]) {
  const connectedIds = new Set(connected);
  return state.connections
    .filter((connection) => {
      const participantId = connectionParticipantId(connection, user.id);
      return participantId ? connectedIds.has(participantId) : false;
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );
}

function connectionVisibility(profile: Profile) {
  return {
    previousConnections: profile.visibility?.previousConnections !== false,
    interests: profile.visibility?.interests !== false,
    skills: profile.visibility?.skills !== false,
    lookingFor: profile.visibility?.lookingFor !== false,
  };
}

function explicitConnectionReason(
  user: Profile,
  person: Profile,
  connection: Connection,
  format: "sentence" | "summary" = "sentence",
) {
  const visibility = connectionVisibility(person);
  if (!visibility.previousConnections) {
    return "This profile is no longer shared with previous connections.";
  }
  if (!visibility.interests || !visibility.skills || !visibility.lookingFor) {
    return "Conversation context is private. Your own notes are still available.";
  }

  const historicalReason = connection.reason?.trim();
  if (historicalReason) return historicalReason;

  const sharedInterests = [
    ...new Set([
      ...(connection.sharedInterests ?? []),
      ...intersect(user.interests, person.interests),
    ]),
  ];
  if (sharedInterests.length > 0) {
    if (format === "summary") {
      return `In common: ${sharedInterests.slice(0, 2).join(", ")}`;
    }
    return `You both care about ${sharedInterests.slice(0, 2).join(" and ")}.`;
  }

  const theyOffer = intersect(user.lookingFor, person.skills);
  if (theyOffer.length > 0) {
    return `${firstName(person)} offers ${theyOffer[0]}, which you’re looking for.`;
  }

  const youOffer = intersect(person.lookingFor, user.skills);
  if (youOffer.length > 0) {
    return `Your ${youOffer[0]} experience complements what ${firstName(person)} is looking for.`;
  }

  return "No explicit profile overlap is recorded yet.";
}

function connectionEventName(state: State, connection: Connection) {
  return (
    state.events.find((event) => event.id === connection.eventId)?.name ??
    (connection.eventId === "demo" ? "The Builders Room" : connection.eventId)
  );
}

function followUpLabel(connection: Connection) {
  if (!connection.followUp || connection.followUp === "none") return null;
  return connection.followUp === "contacted" ? "Contacted" : "Follow-up needed";
}

function sharedTopics(state: State, user: Profile, connections: Connection[]) {
  const topics = new Set<string>();
  for (const connection of connections) {
    const person = otherProfile(state, connection, user.id);
    if (!person) continue;
    const visibility = connectionVisibility(person);
    if (!visibility.previousConnections) continue;
    if (visibility.interests) {
      for (const topic of connection.sharedInterests ?? []) topics.add(topic);
      for (const topic of intersect(user.interests, person.interests))
        topics.add(topic);
    }
    if (visibility.skills) {
      for (const topic of intersect(user.lookingFor, person.skills))
        topics.add(topic);
    }
    if (visibility.lookingFor) {
      for (const topic of intersect(person.lookingFor, user.skills))
        topics.add(topic);
    }
  }
  return [...topics];
}

function ReadinessCard({ user }: { user: Profile }) {
  const readiness = profileReadiness(user);
  return (
    <section className="product-readiness-card" aria-label="Profile readiness">
      <div className="product-card-heading">
        <div>
          <span className="product-eyebrow">Profile readiness</span>
          <h3>
            {readiness.readyCount} of {readiness.items.length} ready
          </h3>
        </div>
        <span
          className={`product-readiness-score ${readiness.complete ? "product-is-complete" : ""}`}
        >
          {Math.round((readiness.readyCount / readiness.items.length) * 100)}%
        </span>
      </div>
      <div className="product-progress" aria-hidden="true">
        <span
          style={{
            width: `${(readiness.readyCount / readiness.items.length) * 100}%`,
          }}
        />
      </div>
      <ul className="product-checklist">
        {readiness.items.map((item) => (
          <li key={item.key} className={item.ready ? "product-is-ready" : ""}>
            {item.ready ? <Check size={14} /> : <span />}
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConnectionRows({
  state,
  user,
  connections,
  limit,
  variant = "default",
}: {
  state: State;
  user: Profile;
  connections: Connection[];
  limit?: number;
  variant?: "default" | "home";
}) {
  return (
    <div className="product-connection-list">
      {connections.slice(0, limit).map((connection) => {
        const person = otherProfile(state, connection, user.id);
        if (!person) return null;
        const followUp = followUpLabel(connection);
        const identity = connectionIdentity(connection);
        const content = (
          <>
            <Avatar profile={person} />
            <span className="product-connection-copy">
              <strong>
                {person.name}
                <small>{person.role}</small>
              </strong>
              <span>
                {explicitConnectionReason(
                  user,
                  person,
                  connection,
                  variant === "home" ? "summary" : "sentence",
                )}
              </span>
              {variant !== "home" && (
                <small>
                  {connectionEventName(state, connection)}
                  {followUp ? ` · ${followUp}` : ""}
                </small>
              )}
            </span>
          </>
        );
        if (variant === "home") {
          return (
            <div className="product-connection-row" key={identity}>
              <a
                className="home-connection-profile"
                href={`#/network?person=${encodeURIComponent(person.id)}&details=1`}
                aria-label={`View connection with ${person.name}`}
              >
                {content}
              </a>
              <ContactLinks profile={person} />
            </div>
          );
        }
        return (
          <button
            className="product-connection-row"
            key={identity}
            onClick={() => navigate(`network?person=${encodeURIComponent(person.id)}`)}
          >
            {content}
            <ArrowUpRight size={17} />
          </button>
        );
      })}
    </div>
  );
}

export function HomeProduct(props: ProductProps) {
  const { state, user, connected, busy, act } = props;
  const [expandedFocus, setExpandedFocus] = useState(false);
  const [previewPeople, setPreviewPeople] = useState(() =>
    new URLSearchParams(location.hash.split("?")[1]).get("people") === "1",
  );
  useEffect(() => {
    const sync = () => setPreviewPeople(
      new URLSearchParams(location.hash.split("?")[1]).get("people") === "1",
    );
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const event = currentEvent(state);
  const readiness = profileReadiness(user);
  const connections = userConnections(state, user, connected)
    .filter((connection) => otherProfile(state, connection, user.id));
  const joinedEvent = state.session?.code?.toUpperCase() === event.code.toUpperCase();
  const otherEvents = state.events.filter((item) => item.id !== event.id).slice(0, 2);
  const lookingFor = user.lookingFor.filter((item) => item.trim());
  const enterRoom = async () => {
    if (!readiness.complete) {
      navigate("profile?section=focus");
      return;
    }
    try {
      if (!joinedEvent) await act("room", { code: event.code });
      navigate("spatial");
    } catch {
      // The action owner presents service errors without losing the current view.
    }
  };
  const missingFields = readiness.items
    .filter((item) => !item.ready)
    .map((item) => item.label.toLowerCase());

  return (
    <div className="home-page">
      <header className="home-heading">
        <h1>Good to see you, {firstName(user)}.</h1>
      </header>

      <section className="home-event" aria-labelledby="home-event-title">
        <img
          className="home-event-image"
          src="/assets/home-conference.webp"
          alt=""
          fetchPriority="high"
        />
        <div className="home-event-topline">
          <span>{event.date} <span aria-hidden="true">·</span> {event.location}</span>
          <span className="home-room-code">{joinedEvent ? "Your demo room" : "Available demo"}</span>
        </div>
        <div className="home-event-content">
          <div className="home-event-copy">
            <h2 id="home-event-title">{event.name}</h2>
            <div className="home-event-actions">
              <Button
                busy={busy}
                onClick={() => void enterRoom()}
              >
                {readiness.complete ? "Enter room" : "Finish profile"}
                <ArrowRight size={17} />
              </Button>
              <button className="home-text-action" onClick={() => navigate(`event?event=${encodeURIComponent(event.id)}`)}>
                Event details
              </button>
            </div>
          </div>
          <button
            className="home-profile-card"
            onClick={() => navigate("profile")}
            aria-label={`Edit your profile${readiness.complete ? "" : `: add ${missingFields.join(", ")}`}`}
          >
            <span className="home-person">
              <Avatar profile={user} size="large" />
              <span className="home-person-copy">
                <strong>{user.name}</strong>
                <span>{user.role || "Add your role"}</span>
                {!readiness.complete && <span className="home-profile-missing">Complete profile</span>}
              </span>
              <span className="home-profile-edit" aria-hidden="true"><Pencil size={14} /></span>
            </span>
          </button>
        </div>
      </section>

      <div className="product-home-grid">
        <section className="product-panel home-focus-panel" aria-labelledby="home-focus-title">
          <div className="card-header">
            <h2 className="home-section-title" id="home-focus-title">Your focus</h2>
            <a className="home-focus-edit" href="#/profile?section=focus" aria-label="Edit focus">
              <Pencil size={16} aria-hidden="true" />
            </a>
          </div>
          {user.bio.trim() ? (
            <>
              <p className="home-focus-statement">{user.bio}</p>
              {lookingFor.length > 0 && (
                <div className="home-focus-topics">
                  <p>Looking for</p>
                  <div className="home-focus-pills" id="home-focus-topics">
                    {lookingFor.slice(0, expandedFocus ? undefined : 2).map((item) => <span key={item}>{item}</span>)}
                    {lookingFor.length > 2 && (
                      <button aria-expanded={expandedFocus} aria-controls="home-focus-topics" onClick={() => setExpandedFocus(!expandedFocus)}>
                        {expandedFocus ? "Show less" : `+${lookingFor.length - 2} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <Button className="home-focus-action" onClick={() => navigate("home?people=1")}>Find collaborators</Button>
            </>
          ) : (
            <>
              <p className="home-focus-statement">What are you working on?</p>
              <p className="home-focus-hint">Share what you’re building and who you’d like to meet.</p>
              <Button className="home-focus-action" onClick={() => navigate("profile?section=focus")}>Set your focus</Button>
            </>
          )}
        </section>
        <section className="product-panel product-connections-panel">
          <div className="card-header">
            <h2 className="home-section-title">Recent connections</h2>
            {connections.length > 0 && (
              <button
                className="product-quiet-link"
                onClick={() => navigate("network")}
              >
                View network
              </button>
            )}
          </div>
          {connections.length > 0 ? (
            <ConnectionRows
              state={state}
              user={user}
              connections={connections}
              limit={3}
              variant="home"
            />
          ) : (
            <div className="home-connections-empty">
              <h3>Your network starts in the room.</h3>
              <p>Meet someone, find common ground, and save their profile here.</p>
              <Button variant="secondary" busy={busy} onClick={() => void enterRoom()}>
                {readiness.complete ? "Enter room" : "Finish profile"}
              </Button>
            </div>
          )}
        </section>

      </div>

      <section className="product-panel home-explore" aria-labelledby="home-explore-title">
        <div className="card-header">
          <h2 className="home-section-title" id="home-explore-title">Other events</h2>
          <a className="product-quiet-link" href="#/event">All events</a>
        </div>
        <div className="home-explore-list">
          {otherEvents.map((space) => (
            <a className="home-space" key={space.id} href={`#/event?event=${encodeURIComponent(space.id)}`}>
              <span className="home-space-icon" aria-hidden="true"><CalendarDays size={22} /></span>
              <span className="home-space-copy">
                <span className="home-space-meta">{space.status} · {space.date}</span>
                <strong>{space.name}</strong>
                <span>{space.description}</span>
                <span className="home-space-meta">{space.location}</span>
              </span>
            </a>
          ))}
          {otherEvents.length === 0 && <p className="home-focus-hint">Find a space with an event code in All events.</p>}
        </div>
      </section>
      {previewPeople && (
        <HomeCollaborators
          profiles={state.profiles}
          user={user}
          eventName={event.name}
          busy={busy}
          onClose={() => location.replace("#/home")}
          onEnter={() => void enterRoom()}
        />
      )}
    </div>
  );
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/\n/gu, "\\n")
    .replace(/,/gu, "\\,")
    .replace(/;/gu, "\\;");
}

function calendarTimes(event: QuestEvent) {
  const months: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  const dateMatch = event.date.match(/^([A-Za-z]+)\s+(\d{1,2})$/u);
  const timeMatches = [...event.time.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gu)];
  const month = dateMatch
    ? months[dateMatch[1].toLocaleLowerCase()]
    : undefined;

  if (!dateMatch || !month || timeMatches.length < 2) return null;
  const day = dateMatch[2].padStart(2, "0");

  function formatTime(match: RegExpMatchArray) {
    let hour = Number(match[1]);
    if (match[3] === "PM" && hour !== 12) hour += 12;
    if (match[3] === "AM" && hour === 12) hour = 0;
    return `2026${month}${day}T${String(hour).padStart(2, "0")}${match[2]}00`;
  }

  return {
    start: formatTime(timeMatches[0]),
    end: formatTime(timeMatches[1]),
  };
}

function downloadCalendar(event: QuestEvent) {
  const times = calendarTimes(event);
  if (!times) return;
  const { start, end } = times;
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Catalyst//Demo Event//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}-2026@catalyst.demo`,
    "DTSTAMP:20260926T120000Z",
    `DTSTART;TZID=America/New_York:${start}`,
    `DTEND;TZID=America/New_York:${end}`,
    `SUMMARY:${escapeIcs(event.name)}`,
    `DESCRIPTION:${escapeIcs(`${event.description} Sample Catalyst demo event. Room code: ${event.code}.`)}`,
    `LOCATION:${escapeIcs(event.location)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${event.name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/(^-|-$)/gu, "")}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function PhaseTabs({
  phase,
  setPhase,
}: {
  phase: EventPhase;
  setPhase: (phase: EventPhase) => void;
}) {
  return (
    <div className="product-phase-control" aria-label="Preview event state">
      <span>Preview event state</span>
      <div role="group" aria-label="Event state">
        {(["before", "during", "after"] as const).map((item) => (
          <button
            key={item}
            className={phase === item ? "product-is-active" : ""}
            aria-pressed={phase === item}
            onClick={() => setPhase(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EventProduct({
  state,
  user,
  connected,
  act,
  busy,
  notify,
}: ProductProps) {
  const requestedEvent = () => state.events.find((item) =>
    item.id === new URLSearchParams(location.hash.split("?")[1]).get("event"),
  );
  const [browsing, setBrowsing] = useState(() => !requestedEvent());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => requestedEvent()?.id ?? null);
  const event =
    state.events.find((e) => e.id === selectedEventId) || currentEvent(state);
  const [phase, setPhase] = useState<EventPhase>(() =>
    requestedEvent() && state.session?.code !== requestedEvent()?.code.toUpperCase() ? "before" : "during",
  );
  useEffect(() => {
    const sync = () => {
      const selected = state.events.find((item) =>
        item.id === new URLSearchParams(location.hash.split("?")[1]).get("event"),
      );
      setSelectedEventId(selected?.id ?? null);
      setBrowsing(!selected);
      if (selected) setPhase(state.session?.code === selected.code.toUpperCase() ? "during" : "before");
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [state.events, state.session?.code]);
  const [roomCode, setRoomCode] = useState(() => {
    const query = location.hash.split("?")[1] ?? "";
    return new URLSearchParams(query).get("code")?.toUpperCase() ?? "";
  });
  const [creatingRoom, setCreatingRoom] = useState(false);
  const roomUrl = `${location.origin}${location.pathname}#/events?code=${encodeURIComponent(event.code)}`;
  const isSeededEvent = event.id === "demo" || event.id === "spatial";
  const hasCalendar = isSeededEvent && calendarTimes(event) !== null;
  const readiness = profileReadiness(user);
  const activeInEvent = user.visibility?.activeInEvent !== false;
  const allConnections = userConnections(state, user, connected);
  const eventConnections = allConnections.filter(
    (connection) => connection.eventId === event.id,
  );
  const topics = sharedTopics(state, user, eventConnections);
  const followUps = eventConnections.filter(
    (connection) => connection.followUp && connection.followUp !== "none",
  );
  const joinedCurrentRoom = state.session?.code === event.code.toUpperCase();
  const compatibleMatches = state.matches.filter(
    (match) =>
      match.compatible && (match.userA === user.id || match.userB === user.id),
  ).length;

  const submitRoom = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    try {
      const code = roomCode.trim().toUpperCase();
      const result = await act("room", { code, create: creatingRoom });
      const joined = result.events.find((item) => item.code === code) ?? currentEvent(result);
      setSelectedEventId(joined.id);
      navigate(`event?event=${encodeURIComponent(joined.id)}`);
      setBrowsing(false);
      setPhase("during");
      window.scrollTo(0, 0);
      notify(
        creatingRoom
          ? `Sample room ${code} created.`
          : `Joined sample room ${code}.`,
      );
    } catch {
      // The parent action owner presents API errors consistently.
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(event.code);
      notify(`Room code ${event.code} copied.`);
    } catch {
      notify("Couldn’t copy the room code. You can select it instead.");
    }
  };

  const runRecovery = async (
    action: () => Promise<void>,
    successMessage: string,
  ) => {
    try {
      await action();
      notify(successMessage);
    } catch {
      // The parent action owner presents API errors consistently.
    }
  };

  const joinBeforeMatching = async () => {
    if (!joinedCurrentRoom) await act("room", { code: event.code });
  };

  const selectEvent = (selectedEvent: QuestEvent) => {
    navigate(`event?event=${encodeURIComponent(selectedEvent.id)}`);
  };

  const enterExperience = async () => {
    if (!readiness.complete) {
      navigate("profile");
      return;
    }
    try {
      if (!joinedCurrentRoom) await act("room", { code: event.code });
      navigate("spatial");
    } catch {
      /* Shared service error. */
    }
  };

  if (browsing)
    return (
      <div className="page-content event-browser">
        <div className="page-heading">
          <div>
            <h1>Find your room.</h1>
            <p>Small rooms. Interesting people. Space for something new.</p>
          </div>
        </div>
        <div className="join-row surface">
          <div>
            <h2>
              {creatingRoom ? "Create a demo room" : "Have an event code?"}
            </h2>
            <p>
              {creatingRoom
                ? "Give your shared space a short, memorable code."
                : "Your next conversation is waiting on the other side."}
            </p>
          </div>
          <form onSubmit={(submitEvent) => void submitRoom(submitEvent)}>
            <label className="sr-only" htmlFor="browse-room-code">
              Room code
            </label>
            <input
              id="browse-room-code"
              value={roomCode}
              onChange={(inputEvent) =>
                setRoomCode(inputEvent.target.value.toUpperCase())
              }
              placeholder="Enter code"
              minLength={3}
              maxLength={8}
              pattern="[A-Z0-9]{3,8}"
              required
            />
            <Button busy={busy} type="submit">
              {creatingRoom ? "Create room" : "Join room"}
              <ArrowRight size={16} />
            </Button>
          </form>
        </div>
        <button
          className="plain-button create-room-link"
          onClick={() => setCreatingRoom(!creatingRoom)}
        >
          {creatingRoom
            ? "Join an existing room instead"
            : "Or create a demo room"}
          <ArrowUpRight size={14} />
        </button>
        <div className="section-title">
          <h2>Spaces to explore</h2>
          <span className="subtle">Illustrative events</span>
        </div>
        <div className="event-grid">
          {state.events.map((item) => (
            <article className="event-card surface" key={item.id}>
              <div className="event-cover">
                <img className="event-preview-photo" {...eventPhoto(item)} />
                <span className="glass-label">{item.status}</span>
              </div>
              <div className="event-card-body">
                <div className="event-date">
                  <CalendarDays size={15} />
                  {item.date}
                  <span>{item.time}</span>
                </div>
                <h2>{item.name}</h2>
                <p>{item.description}</p>
                <span className="event-location">
                  <MapPin size={14} />
                  {item.location}
                </span>
                <Button
                  variant="primary"
                  busy={busy}
                  onClick={() => void selectEvent(item)}
                >
                  Explore event
                  <ArrowUpRight size={15} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    );

  return (
    <div className="product-page product-event-page">
      <button
        className="product-quiet-link product-back-events"
        onClick={() => navigate("event")}
      >
        <ArrowLeft size={15} />
        All event spaces
      </button>
      <header className="product-page-heading product-event-heading">
        <div>
          <span className="product-eyebrow">{joinedCurrentRoom ? "Your demo room" : "Sample event"}</span>
          <h1>{event.name}</h1>
          <p>{event.description}</p>
        </div>
        <PhaseTabs phase={phase} setPhase={setPhase} />
      </header>

      {phase === "before" && (
        <div className="product-phase-page product-before-page">
          <section className="product-panel product-event-overview">
            <div className="product-overview-image">
              <img className="event-preview-photo" {...eventPhoto(event)} />
              <div className="product-scene-wash" />
              <span className="product-sample-label">SAMPLE EVENT</span>
              <div>
                <span>Hosted by the Catalyst demo team · sample host</span>
                <h2>{event.name}</h2>
              </div>
            </div>
            <div className="product-overview-body">
              <div className="product-event-meta">
                <span>
                  <CalendarDays size={16} />
                  <strong>{event.date}</strong>
                  {event.time}
                </span>
                <span>
                  <MapPin size={16} />
                  <strong>{event.location}</strong>
                  Demo venue
                </span>
              </div>
              <div className="product-room-code-block">
                <div>
                  <span>Event code</span>
                  <strong>{event.code}</strong>
                </div>
                {isSeededEvent ? (
                  <div className="product-room-share">
                    <div className="product-room-qr">
                      <QRCodeSVG
                        value={roomUrl}
                        size={74}
                        bgColor="#f2f4ef"
                        fgColor="#0b0e0d"
                        level="M"
                        title={`Open the ${event.name} local preview on this computer`}
                      />
                    </div>
                    <div>
                      <span>Local preview link · opens on this computer</span>
                      <button onClick={() => void copyCode()}>
                        <Copy size={16} /> Copy code
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="product-room-share">
                    <span>Available only in this local demo session.</span>
                  </div>
                )}
              </div>
              {hasCalendar && (
                <button
                  className="product-download-button"
                  onClick={() => downloadCalendar(event)}
                >
                  <Download size={17} /> Download calendar file
                </button>
              )}
            </div>
          </section>

          <div className="product-before-side">
            <ReadinessCard user={user} />
            <section className="product-panel product-instructions">
              <span className="product-eyebrow">Before you arrive</span>
              <h2>Bring a little context.</h2>
              <ol>
                <li>
                  <span>1</span>
                  Complete the profile you want people to see.
                </li>
                <li>
                  <span>2</span>
                  Join the room with the event code.
                </li>
                <li>
                  <span>3</span>
                  Put on the headset and follow calibration.
                </li>
              </ol>
              <Button
                variant="secondary"
                busy={busy}
                onClick={() => void enterExperience()}
              >
                {readiness.complete ? "Preview experience" : "Finish profile"}
                <ArrowUpRight size={16} />
              </Button>
            </section>
          </div>

          <section className="product-panel product-room-entry">
            <div>
              <span className="product-eyebrow">Sample room access</span>
              <h2>
                {creatingRoom
                  ? "Create a temporary room"
                  : "Join with a room code"}
              </h2>
              <p>
                {creatingRoom
                  ? "Created rooms are temporary demo spaces."
                  : `Try the seeded event code ${event.code}.`}
              </p>
            </div>
            <form onSubmit={(formEvent) => void submitRoom(formEvent)}>
              <label htmlFor="product-room-code">Room code</label>
              <input
                id="product-room-code"
                value={roomCode}
                onChange={(inputEvent) =>
                  setRoomCode(inputEvent.target.value.toUpperCase())
                }
                placeholder={event.code}
                minLength={3}
                maxLength={8}
                pattern="[A-Za-z0-9]{3,8}"
                autoComplete="off"
                required
              />
              <Button busy={busy} type="submit">
                {creatingRoom ? "Create room" : "Join room"}
                <ArrowRight size={16} />
              </Button>
            </form>
            <button
              className="product-quiet-link"
              onClick={() => setCreatingRoom((current) => !current)}
            >
              {creatingRoom
                ? "Join an existing room instead"
                : "Create a temporary demo room"}
            </button>
          </section>
        </div>
      )}

      {phase === "during" && (
        <div className="product-phase-page product-during-page">
          <section className="product-cinematic product-during-hero">
            <img className="event-preview-photo" {...eventPhoto(event)} />
            <div className="product-scene-wash" />
            <div className="product-hero-topline">
              <span className="product-live-badge">
                <span /> SAMPLE LIVE
              </span>
              <span>Simulated event state · not live timing</span>
            </div>
            <div className="product-during-content">
              <div>
                <span className="product-kicker">Room {event.code}</span>
                <h2>A room full of possibility.</h2>
                <p>
                  {state.profiles.length} sample participants are available in
                  this demo experience.
                </p>
                <Button busy={busy} onClick={() => void enterExperience()}>
                  Enter experience <Glasses size={17} />
                </Button>
              </div>
              <div className="product-setup-glass">
                <span className="product-eyebrow">Sample session setup</span>
                <ul>
                  <li className={readiness.complete ? "product-is-ready" : ""}>
                    {readiness.complete ? <CheckCircle2 /> : <UserRound />}
                    <span>
                      Profile {readiness.complete ? "ready" : "needs details"}
                      <small>
                        {readiness.readyCount}/6 profile fields complete
                      </small>
                    </span>
                  </li>
                  <li className={state.session?.code ? "product-is-ready" : ""}>
                    <Wifi />
                    <span>
                      {state.session?.code
                        ? `Room ${state.session.code} joined`
                        : "Room not joined"}
                      <small>
                        Connection state comes from the demo session
                      </small>
                    </span>
                  </li>
                  <li className="product-is-simulated">
                    <Sparkles />
                    <span>
                      Spatial origin simulated
                      <small>Headset position is a concept preview</small>
                    </span>
                  </li>
                  <li
                    className={compatibleMatches > 0 ? "product-is-ready" : ""}
                  >
                    <Users />
                    <span>
                      {compatibleMatches > 0
                        ? `${compatibleMatches} compatible sample ${compatibleMatches === 1 ? "match" : "matches"}`
                        : "Matching ready to run"}
                      <small>Based on compatible sample profiles</small>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <div className="product-during-grid">
            <section className="product-panel product-shared-profile">
              <div className="product-section-heading">
                <div>
                  <span className="product-eyebrow">
                    {activeInEvent
                      ? "Visible in this room"
                      : "Visibility paused"}
                  </span>
                  <h2>
                    {activeInEvent
                      ? "Profile being shared"
                      : "Profile sharing paused"}
                  </h2>
                </div>
                <button
                  className="product-quiet-link"
                  onClick={() => navigate("profile")}
                >
                  Edit <ArrowUpRight size={15} />
                </button>
              </div>
              {activeInEvent ? (
                <>
                  <div className="product-profile-summary">
                    <Avatar profile={user} size="large" />
                    <div>
                      <h3>{user.name}</h3>
                      <p>{user.role}</p>
                    </div>
                  </div>
                  {user.visibility?.bio !== false && (
                    <p className="product-profile-bio">{user.bio}</p>
                  )}
                  <div className="product-shared-fields">
                    {user.visibility?.interests !== false &&
                      user.interests.length > 0 && (
                        <div>
                          <span>Interests</span>
                          <Tags items={user.interests} limit={4} />
                        </div>
                      )}
                    {user.visibility?.skills !== false &&
                      user.skills.length > 0 && (
                        <div>
                          <span>Skills</span>
                          <Tags items={user.skills} limit={4} />
                        </div>
                      )}
                    {user.visibility?.lookingFor !== false &&
                      user.lookingFor.length > 0 && (
                        <div>
                          <span>Looking for</span>
                          <Tags items={user.lookingFor} limit={4} />
                        </div>
                      )}
                  </div>
                  <small className="product-privacy-note">
                    Only profile fields enabled for the room are represented
                    here.
                  </small>
                </>
              ) : (
                <p className="product-inline-empty">
                  Your profile is not visible to people in this room. Turn on
                  Active in event from Profile to resume sharing.
                </p>
              )}
            </section>

            <section className="product-panel product-headset-panel">
              <span className="product-eyebrow">In the headset</span>
              <h2>What happens next</h2>
              <ul>
                <li>
                  <span>
                    <UserRound size={17} />
                  </span>
                  Participant cards appear around the room.
                </li>
                <li>
                  <span>
                    <Sparkles size={17} />
                  </span>
                  Compatible sample profiles reveal a reason to meet.
                </li>
                <li>
                  <span>
                    <Clipboard size={17} />
                  </span>
                  You choose which conversations to save.
                </li>
              </ul>
            </section>

            <section className="product-panel product-live-connections">
              <div className="product-section-heading">
                <div>
                  <span className="product-eyebrow">Saved so far</span>
                  <h2>Recent connections</h2>
                </div>
                <span className="product-count-pill">
                  {eventConnections.length}
                </span>
              </div>
              {eventConnections.length > 0 ? (
                <ConnectionRows
                  state={state}
                  user={user}
                  connections={eventConnections}
                  limit={3}
                />
              ) : (
                <p className="product-inline-empty">
                  Saved conversations will appear here.
                </p>
              )}
            </section>
          </div>

          <details className="product-recovery">
            <summary>
              <span>
                <RefreshCw size={16} /> Recovery controls
              </span>
              <small>For this sample event</small>
            </summary>
            <div className="product-recovery-grid">
              <button
                disabled={busy}
                onClick={() =>
                  void runRecovery(async () => {
                    await act("room", { code: event.code });
                  }, `Reconnected to room ${event.code}.`)
                }
              >
                <Wifi size={17} />
                <span>
                  Reconnect room
                  <small>{event.code}</small>
                </span>
              </button>
              <button
                disabled={busy}
                onClick={() => navigate("spatial?calibrate=1")}
              >
                <Glasses size={17} />
                <span>
                  Recalibrate
                  <small>Continue in spatial setup</small>
                </span>
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void runRecovery(async () => {
                    await joinBeforeMatching();
                    await act("matches", { force: true, demo: true });
                  }, "Sample matches refreshed.")
                }
              >
                <RefreshCw size={17} />
                <span>
                  Re-run matches
                  <small>Joins {event.code} before matching</small>
                </span>
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void runRecovery(async () => {
                    await joinBeforeMatching();
                    await act("matches", { demo: true });
                  }, "Known demo match is ready.")
                }
              >
                <Sparkles size={17} />
                <span>
                  Known demo match
                  <small>Uses precomputed sample behavior</small>
                </span>
              </button>
              <button
                className="product-reset-control"
                disabled={busy}
                onClick={() =>
                  void runRecovery(async () => {
                    await act("reset");
                  }, "Sample data reset.")
                }
              >
                <RotateCcw size={17} />
                <span>
                  Reset demo
                  <small>Restore seeded sample data</small>
                </span>
              </button>
            </div>
            {!joinedCurrentRoom && (
              <p className="product-recovery-note">
                You are not currently joined to {event.code}. Match actions
                reconnect first.
              </p>
            )}
          </details>
        </div>
      )}

      {phase === "after" && (
        <div className="product-phase-page product-after-page">
          <section className="product-panel product-recap-hero">
            <span className="product-recap-icon">
              <Check size={22} />
            </span>
            <span className="product-eyebrow">Sample event recap</span>
            <h2>Keep the useful conversations moving.</h2>
            <p>
              You saved {eventConnections.length}{" "}
              {eventConnections.length === 1 ? "connection" : "connections"}{" "}
              from {event.name}.
            </p>
            <Button onClick={() => navigate("network")}>
              Open event network <Network size={17} />
            </Button>
          </section>

          <div className="product-after-grid">
            <section className="product-panel product-topic-panel">
              <span className="product-eyebrow">Explicit profile overlap</span>
              <h2>Shared topics</h2>
              {topics.length > 0 ? (
                <div className="product-topic-cloud">
                  {topics.map((topic) => (
                    <span key={topic}>{topic}</span>
                  ))}
                </div>
              ) : (
                <p className="product-inline-empty">
                  No shared profile topics were recorded for this event.
                </p>
              )}
            </section>

            <section className="product-panel product-followup-panel">
              <span className="product-eyebrow">Saved connection metadata</span>
              <h2>Follow-ups</h2>
              {followUps.length > 0 ? (
                <ul>
                  {followUps.map((connection) => {
                    const person = otherProfile(state, connection, user.id);
                    if (!person) return null;
                    return (
                      <li key={connectionIdentity(connection)}>
                        <Avatar profile={person} size="small" />
                        <span>
                          <strong>{person.name}</strong>
                          <small>{followUpLabel(connection)}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="product-inline-empty">
                  No follow-ups are recorded in this sample yet.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
