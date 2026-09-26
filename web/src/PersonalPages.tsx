import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  Download,
  Eye,
  Glasses,
  List,
  LogOut,
  MapPin,
  Network,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Avatar, Button, Empty, Tags, Toggle } from "./ui";
import { DemoMatchRecap } from "./DemoMatchRecap";
import type { Action, Connection, Profile, State } from "./types";
import "./PersonalPages.css";

const navigate = (path: string) => {
  location.hash = `/${path}`;
};
const name = (p: Profile) => p.name.trim().split(" ")[0];
const defaults = {
  bio: true,
  interests: true,
  skills: true,
  lookingFor: true,
  contact: false,
  previousConnections: true,
  activeInEvent: true,
};
const isOwned = (c: Connection, userId: string) =>
  (c.ownerId ?? c.userA) === userId;
function sharedProfile(profile: Profile): Profile {
  const v = { ...defaults, ...profile.visibility };
  const allowed = v.previousConnections;
  return {
    ...profile,
    bio: allowed && v.bio ? profile.bio : "",
    interests: allowed && v.interests ? profile.interests : [],
    skills: allowed && v.skills ? profile.skills : [],
    lookingFor: allowed && v.lookingFor ? profile.lookingFor : [],
    contact: allowed && v.contact ? profile.contact : "",
  };
}
const pair = (state: State, user: Profile, id: string) =>
  state.connections.find(
    (c) =>
      isOwned(c, user.id) &&
      (c.participantId
        ? c.participantId === id
        : (c.userA === user.id && c.userB === id) ||
          (c.userB === user.id && c.userA === id)),
  );
function whyMet(user: Profile, other: Profile, connection?: Connection) {
  if (other.visibility?.previousConnections === false)
    return "This profile is no longer shared with previous connections.";
  if (
    other.visibility &&
    (!other.visibility.interests ||
      !other.visibility.skills ||
      !other.visibility.lookingFor)
  )
    return "Conversation context is private. Your own notes are still available.";
  if (connection?.reason) return connection.reason;
  const skill = other.skills.find((s) =>
    user.lookingFor.some((l) => l.toLowerCase() === s.toLowerCase()),
  );
  if (skill)
    return `${name(other)} can help with ${skill.toLowerCase()}, something you’re looking for.`;
  const shared = user.interests.filter((i) => other.interests.includes(i));
  return shared.length
    ? `You connected over ${shared[0].toLowerCase()}.`
    : "A conversation worth remembering from your shared event.";
}
function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
type PersonalProps = {
  state: State;
  user: Profile;
  connected: string[];
  act: Action;
  busy: boolean;
  notify: (s: string) => void;
};

export function NetworkProduct({
  state,
  user,
  connected,
  act,
  busy,
  notify,
}: PersonalProps) {
  const requested = () =>
    new URLSearchParams(location.hash.split("?")[1]).get("person");
  const [selected, setSelected] = useState<string | null>(
    requested() || connected[0] || null,
  );
  const [view, setView] = useState<"graph" | "list">("graph");
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [interest, setInterest] = useState("all");
  const [followup, setFollowup] = useState(false);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const change = () => {
      if (requested()) setSelected(requested());
    };
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  const connections = state.connections.filter((c) => isOwned(c, user.id));
  const topics = [
    ...new Set(
      state.profiles
        .map(sharedProfile)
        .filter((p) => connected.includes(p.id))
        .flatMap((p) => p.interests),
    ),
  ].sort();
  const eventIds = [...new Set(connections.map((c) => c.eventId))];
  const people = state.profiles
    .map(sharedProfile)
    .filter((p) => {
      const c = pair(state, user, p.id);
      return (
        c &&
        `${p.name} ${p.role} ${p.interests.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (interest === "all" || p.interests.includes(interest)) &&
        (eventFilter === "all" || c.eventId === eventFilter) &&
        (!followup || (c.followUp || "needed") === "needed")
      );
    })
    .sort(
      (a, b) =>
        new Date(pair(state, user, b.id)!.createdAt).getTime() -
        new Date(pair(state, user, a.id)!.createdAt).getTime(),
    );
  const person = people.find((p) => p.id === selected);
  const connection = person ? pair(state, user, person.id) : undefined;
  const positions = [
    [50, 49],
    [79, 31],
    [23, 29],
    [78, 76],
    [25, 77],
    [52, 17],
  ];
  const open = (id: string) => {
    setSelected(id);
    setFull(false);
  };
  return (
    <div className="page-content network-product">
      <Heading
        title="The people behind the possibilities."
        description="Your conversations, connected. A small constellation of people worth knowing."
      />
      <DemoMatchRecap viewerId={user.id} />
      <div className="network-toolbar">
        <div className="segmented" role="group" aria-label="Network view">
          <button
            type="button"
            className={view === "graph" ? "active" : ""}
            aria-pressed={view === "graph"}
            onClick={() => setView("graph")}
          >
            <Network size={16} />
            Constellation
          </button>
          <button
            type="button"
            className={view === "list" ? "active" : ""}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={16} />
            List
          </button>
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a person or interest"
            aria-label="Search connections"
          />
        </label>
        <span className="subtle">{connected.length} connections</span>
      </div>
      <div className="network-filters">
        <select
          aria-label="Filter by event"
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
        >
          <option value="all">All events</option>
          {eventIds.map((id) => (
            <option key={id} value={id}>
              {state.events.find((e) => e.id === id)?.name || `Room ${id}`}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by interest"
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
        >
          <option value="all">All interests</option>
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button
          className={followup ? "active" : ""}
          aria-pressed={followup}
          onClick={() => setFollowup(!followup)}
        >
          <span className="filter-check">
            {followup && <Check size={10} />}
          </span>
          Needs follow-up
        </button>
        <span>Recently met first</span>
      </div>
      <div className={`network-workspace surface ${full ? "full-person" : ""}`}>
        <div className="network-canvas">
          <div className="canvas-label">
            <span className="status-dot" />
            Your constellation<span>Saved people · sample data</span>
          </div>
          {people.length === 0 ? (
            <Empty
              title={
                connected.length
                  ? "No connections in this view."
                  : "No saved connections yet."
              }
            >
              {connected.length ? (
                "Try a different filter or search."
              ) : (
                <>
                  Join an event and save the people you want to remember.
                  <br />
                  <Button variant="secondary" onClick={() => navigate("event")}>
                    Find an event
                    <ArrowUpRight size={14} />
                  </Button>
                </>
              )}
            </Empty>
          ) : view === "graph" ? (
            <div className="connection-graph">
              <div className="graph-glow" />
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <ellipse
                  cx="50"
                  cy="49"
                  rx="33"
                  ry="32"
                  className="graph-orbit"
                />
                {people.map((p, i) => (
                  <path
                    key={p.id}
                    className={selected === p.id ? "selected-edge" : ""}
                    d={`M50 49 Q ${positions[i + 1][0]} 49 ${positions[i + 1][0]} ${positions[i + 1][1]}`}
                  />
                ))}
              </svg>
              {[user, ...people].map((p, i) => (
                <button
                  className={`graph-person ${i === 0 ? "you" : ""} ${p.id === selected ? "selected" : ""}`}
                  style={{
                    left: `${positions[i][0]}%`,
                    top: `${positions[i][1]}%`,
                  }}
                  onClick={() => (i ? open(p.id) : navigate("profile"))}
                  key={p.id}
                  aria-label={i ? `View ${p.name}` : "View your profile"}
                >
                  <span className="graph-avatar">
                    <Avatar profile={p} size="large" />
                    {i === 0 && <span className="graph-you-dot" />}
                  </span>
                  <strong>{i ? name(p) : "You"}</strong>
                  <small>{i ? p.role : "Your shared connections"}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="connection-list">
              {people.map((p) => (
                <button
                  className={p.id === selected ? "selected" : ""}
                  key={p.id}
                  onClick={() => open(p.id)}
                >
                  <Avatar profile={p} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.role}</small>
                    <small className="connection-why">
                      {whyMet(user, p, pair(state, user, p.id))}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          )}
          <div className="canvas-footer">
            <span>
              <span className="legend-line" />
              Saved connection
            </span>
            <span>Select a person to explore</span>
          </div>
        </div>
        <aside className="network-detail">
          {person && connection ? (
            <ConnectionDetail
              key={person.id}
              person={person}
              user={user}
              connection={connection}
              state={state}
              act={act}
              busy={busy}
              notify={notify}
              full={full}
              onExpand={() => setFull(!full)}
              onClose={() => {
                setSelected(null);
                setFull(false);
              }}
            />
          ) : (
            <Empty title="Follow a connection.">
              Choose someone on your map to see what brought you together.
            </Empty>
          )}
        </aside>
      </div>
      <p className="page-footnote">
        Lines show people you deliberately saved. Private notes stay in your
        demo session; saving never sends a message.
      </p>
    </div>
  );
}

function ConnectionDetail({
  person,
  user,
  connection,
  state,
  act,
  busy,
  notify,
  full,
  onExpand,
  onClose,
}: {
  person: Profile;
  user: Profile;
  connection: Connection;
  state: State;
  act: Action;
  busy: boolean;
  notify: (s: string) => void;
  full: boolean;
  onExpand: () => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(connection.notes || "");
  const [reminder, setReminder] = useState(connection.reminderDate || "");
  const [status, setStatus] = useState(connection.followUp || "needed");
  const event = state.events.find((e) => e.id === connection.eventId);
  const shared =
    person.visibility?.previousConnections === false ||
    person.visibility?.interests === false
      ? []
      : (connection.sharedInterests ??
        user.interests.filter((i) => person.interests.includes(i)));
  const save = async () => {
    try {
      await act(
        `connections/${person.id}`,
        { notes, reminderDate: reminder, followUp: status },
        "PATCH",
      );
      notify("Connection details saved.");
    } catch {
      /* Parent owns the service error. */
    }
  };
  return (
    <>
      <div className="detail-top">
        <span>{full ? "Connection profile" : "Connection details"}</span>
        <button
          className="icon-button"
          aria-label="Close connection details"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <Avatar profile={person} size="large" />
      <h2>{person.name}</h2>
      <p>{person.role}</p>
      <span className="location">
        <MapPin size={13} />
        {person.location}
      </span>
      <div className="connection-reason">
        <Sparkles size={15} />
        <p>{whyMet(user, person, connection)}</p>
      </div>
      <div className="met-at">
        <CalendarDays size={16} />
        <span>
          {new Date(connection.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          <strong>{event?.name || `Room ${connection.eventId}`}</strong>
        </span>
      </div>
      <h3>Shared interests</h3>
      {shared.length ? (
        <Tags items={shared} />
      ) : (
        <p>A complementary perspective.</p>
      )}
      <h3>Can help with</h3>
      <Tags items={person.skills} />
      <h3>Looking for</h3>
      <p>{person.lookingFor.join(", ")}</p>
      <button className="connection-expand" onClick={onExpand}>
        {full ? <ChevronLeft size={14} /> : <Eye size={14} />}{" "}
        {full ? "Back to constellation" : "View full profile & follow up"}
        <ArrowUpRight size={14} />
      </button>
      {full && (
        <div className="connection-extra">
          <h3>In their own words</h3>
          <p>{person.bio}</p>
          <h3>All interests</h3>
          <Tags items={person.interests} />
          <h3>Shared contact</h3>
          <p>
            {person.visibility?.contact && person.contact
              ? person.contact
              : "No contact information has been shared."}
          </p>
          <label>
            Follow-up status
            <select
              aria-label="Follow-up status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="needed">Needs follow-up</option>
              <option value="contacted">Contacted</option>
              <option value="none">No follow-up needed</option>
            </select>
          </label>
          <label>
            Private notes
            <textarea
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What would you like to remember?"
            />
          </label>
          <label>
            Follow-up date
            <input
              type="date"
              aria-label="Follow-up date"
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
            />
            <small>
              Saved in this demo. No email or push notification is sent.
            </small>
          </label>
          <Button
            busy={busy}
            className="full-width"
            onClick={() => void save()}
          >
            Save follow-up
            <Check size={15} />
          </Button>
          <button
            className="plain-button remove-connection"
            disabled={busy}
            onClick={async () => {
              try {
                await act(`connections/${person.id}`, undefined, "DELETE");
                onClose();
                notify("Connection removed from your demo network.");
              } catch {
                /* Service error shown. */
              }
            }}
          >
            Remove connection
          </button>
        </div>
      )}
      {!full && (
        <span className="followup-status">
          {(connection.followUp || "needed") === "needed"
            ? "A conversation to continue"
            : connection.followUp === "contacted"
              ? "You’ve followed up"
              : "Connection saved"}
        </span>
      )}
    </>
  );
}

export function ProfileProduct({
  state,
  user,
  act,
  busy,
  notify,
  solid,
  setSolid,
  logout,
}: PersonalProps & {
  solid: boolean;
  setSolid: (v: boolean) => void;
  logout: () => void;
}) {
  const [draft, setDraft] = useState<Profile>({
    ...user,
    visibility: { ...defaults, ...user.visibility },
  });
  const [saved, setSaved] = useState(false);
  const editRevisionRef = useRef(0);
  const [preview, setPreview] = useState<"distant" | "nearby" | "matched">(
    "nearby",
  );
  const [sounds, setSounds] = useState(() => {
    try {
      return localStorage.getItem("questmatch-sounds") === "true";
    } catch {
      return false;
    }
  });
  const change = (key: keyof Profile, value: unknown) => {
    editRevisionRef.current += 1;
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };
  const visibility = { ...defaults, ...draft.visibility };
  const canMatch =
    (visibility.interests && draft.interests.length > 0) ||
    (visibility.skills && draft.skills.length > 0) ||
    (visibility.lookingFor && draft.lookingFor.length > 0);
  const completionSignals = [
    draft.name.trim().length > 0,
    draft.role.trim().length > 0,
    draft.bio.trim().length > 0,
    draft.location.trim().length > 0,
    draft.interests.length > 0,
    draft.skills.length > 0,
    draft.lookingFor.length > 0,
  ];
  const completion = Math.round(
    (completionSignals.filter(Boolean).length / completionSignals.length) * 100,
  );
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const submittedRevision = editRevisionRef.current;
    const {
      name,
      role,
      bio,
      location,
      interests,
      skills,
      lookingFor,
      contact,
      visibility,
    } = draft;
    try {
      await act(
        "profile",
        {
          name,
          role,
          bio,
          location,
          interests,
          skills,
          lookingFor,
          contact: contact || "",
          visibility,
        },
        "PATCH",
      );
      if (editRevisionRef.current === submittedRevision) {
        setSaved(true);
        notify("Your introduction is saved.");
      } else {
        notify("Earlier edits saved. Your latest changes still need saving.");
      }
    } catch {
      /* Service error shown. */
    }
  };
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              profile: user,
              connections: state.connections.filter((c) => isOwned(c, user.id)),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "questmatch-my-information.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Your information was exported.");
  };
  return (
    <div className="page-content profile-product">
      <Heading
        title="Design your introduction."
        description="A little about what you’re building. A little about what you’re looking for."
      />
      <div className="profile-layout">
        <form className="profile-form" onSubmit={(e) => void save(e)}>
          <section>
            <div className="profile-section-heading">
              <h2>Start with yourself</h2>
              <span>Your first hello</span>
            </div>
            <div className="profile-identity">
              <Avatar profile={draft} size="large" />
              <div>
                <strong>{draft.name || "Your name"}</strong>
                <p>Sample photo for this demo.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Full name
                <input
                  required
                  maxLength={60}
                  value={draft.name}
                  onChange={(e) => change("name", e.target.value)}
                />
              </label>
              <label>
                Role or one-liner
                <input
                  required
                  maxLength={80}
                  value={draft.role}
                  onChange={(e) => change("role", e.target.value)}
                />
              </label>
            </div>
            <label>
              What are you building?
              <textarea
                required
                rows={3}
                maxLength={240}
                value={draft.bio}
                onChange={(e) => change("bio", e.target.value)}
              />
              <span className="field-help">
                Give someone a reason to be curious.
                <span>{draft.bio.length}/240</span>
              </span>
            </label>
            <label>
              Based in
              <input
                maxLength={80}
                value={draft.location}
                onChange={(e) => change("location", e.target.value)}
              />
            </label>
          </section>
          <section>
            <div className="profile-section-heading">
              <h2>Make a little common ground</h2>
            </div>
            <ChipField
              label="What are you excited to talk about?"
              values={draft.interests}
              onChange={(v) => change("interests", v)}
              suggestions={[
                "Robotics",
                "Design",
                "Open source",
                "Spatial computing",
              ]}
            />
            <ChipField
              label="What could someone ask you for help with?"
              values={draft.skills}
              onChange={(v) => change("skills", v)}
              suggestions={[
                "Python",
                "Unity",
                "Prototyping",
                "Embedded systems",
              ]}
            />
            <ChipField
              label="Who would make this event valuable for you?"
              values={draft.lookingFor}
              onChange={(v) => change("lookingFor", v)}
              suggestions={[
                "Computer vision",
                "Interaction design",
                "Frontend development",
              ]}
            />
          </section>
          <section>
            <div className="profile-section-heading">
              <h2>Choose what you share</h2>
              <Eye size={16} />
            </div>
            <p className="visibility-intro">
              Your name and role introduce you. You choose the rest. Hidden
              interests and skills won’t be used for demo matching.
            </p>
            {(
              [
                ["bio", "What I’m building"],
                ["interests", "Interests"],
                ["skills", "Skills I can share"],
                ["lookingFor", "Who I want to meet"],
              ] as const
            ).map(([key, label]) => (
              <div className="visibility-row" key={key}>
                <span>{label}</span>
                <Toggle
                  label={`Share ${label}`}
                  checked={visibility[key]}
                  onChange={() =>
                    change("visibility", {
                      ...visibility,
                      [key]: !visibility[key],
                    })
                  }
                />
              </div>
            ))}
            <label className="contact-input">
              Contact to share after connecting
              <input
                maxLength={160}
                value={draft.contact || ""}
                onChange={(e) => change("contact", e.target.value)}
                placeholder="Your professional email or website"
              />
            </label>
            <div className="visibility-row">
              <span>Share contact with saved connections</span>
              <Toggle
                label="Share contact with saved connections"
                checked={visibility.contact}
                onChange={() =>
                  change("visibility", {
                    ...visibility,
                    contact: !visibility.contact,
                  })
                }
              />
            </div>
            <div className="visibility-row">
              <span>
                Active in{" "}
                {state.events.find((e) => e.code === state.session?.code)
                  ?.name || "The Builders Room"}
              </span>
              <Toggle
                label="Active in this event"
                checked={visibility.activeInEvent}
                onChange={() =>
                  change("visibility", {
                    ...visibility,
                    activeInEvent: !visibility.activeInEvent,
                  })
                }
              />
            </div>
            <div className="visibility-row">
              <span>Allow access for previous connections</span>
              <Toggle
                label="Allow access for previous connections"
                checked={visibility.previousConnections}
                onChange={() =>
                  change("visibility", {
                    ...visibility,
                    previousConnections: !visibility.previousConnections,
                  })
                }
              />
            </div>
            <p className="privacy-note">
              Visibility controls are modeled in this local demo. Cross-account
              access enforcement will be part of the connected service.
            </p>
          </section>
          <div className="save-profile">
            <span>
              {saved ? (
                <>
                  <Check size={15} />
                  Introduction saved
                </>
              ) : (
                "Preview updates as you type."
              )}
            </span>
            <Button busy={busy} type="submit">
              Save introduction
              <ArrowRight size={16} />
            </Button>
          </div>
        </form>
        <aside className="profile-preview-column">
          <div className="section-title">
            <h2>Through someone else’s eyes</h2>
            <Glasses size={18} />
          </div>
          <div
            className="preview-tabs segmented"
            role="group"
            aria-label="Profile preview distance"
          >
            {(["distant", "nearby", "matched"] as const).map((s) => (
              <button
                type="button"
                key={s}
                className={preview === s ? "active" : ""}
                aria-pressed={preview === s}
                onClick={() => setPreview(s)}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className={`profile-preview-scene preview-${preview}`}>
            <div className="scene-photo" />
            {!visibility.activeInEvent ? (
              <div className="preview-inactive glass">
                <Eye size={19} />
                <p>Your introduction is paused in this event.</p>
              </div>
            ) : preview === "distant" ? (
              <div className="preview-name glass">
                {name(draft) || "Your name"}
              </div>
            ) : (
              <div
                className={`preview-floating glass ${preview === "matched" && canMatch ? "match" : ""}`}
              >
                {preview === "matched" && canMatch && (
                  <div className="match-label">
                    <Sparkles size={13} />A reason to meet
                  </div>
                )}
                <div className="person-line">
                  <Avatar profile={draft} />
                  <div>
                    <h3>{name(draft) || "Your name"}</h3>
                    <p>{draft.role || "Your one-liner"}</p>
                  </div>
                </div>
                {preview === "nearby" && visibility.interests && (
                  <Tags items={draft.interests} limit={3} />
                )}
                {preview === "matched" && (
                  <p className="match-copy">
                    {!canMatch
                      ? "Share an interest, a skill, or who you want to meet to make room for an introduction."
                      : visibility.interests && draft.interests.length
                        ? `You share a curiosity for ${draft.interests[0].toLowerCase()}. There’s a conversation here.`
                        : "A useful connection appears here when your shared profile offers common ground."}
                  </p>
                )}
              </div>
            )}
            <span>
              {preview === "distant"
                ? "A name, with room to breathe."
                : preview === "nearby"
                  ? "Just enough to say hello."
                  : "An illustrative reason, never a rating."}
            </span>
          </div>
          <div className="profile-completion">
            <div className="completeness">
              <span>Introduction completeness</span>
              <strong>{completion}%</strong>
            </div>
            <div
              className="completion-track"
              role="progressbar"
              aria-label="Introduction completeness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion}
            >
              <span style={{ width: `${completion}%` }} />
            </div>
          </div>
          <div className="profile-guidance">
            <Sparkles size={20} />
            <h3>Specific is interesting.</h3>
            <p>
              “Building a wearable navigation system” gives someone more to
              connect with than “interested in tech.”
            </p>
          </div>
          <div className="preview-context">
            <h3>One introduction. Three distances.</h3>
            <p>
              <strong>Distant</strong> A quiet name marker.
            </p>
            <p>
              <strong>Nearby</strong> Your role and a few shared interests.
            </p>
            <p>
              <strong>Matched</strong> A concrete reason to start talking.
            </p>
          </div>
        </aside>
      </div>
      <section className="profile-preferences">
        <h2>Your space, your preferences.</h2>
        <div className="setting-row">
          <div>
            <h3>Reduce transparency</h3>
            <p>Keep the glass feel, with more opaque surfaces for reading.</p>
          </div>
          <Toggle
            label="Reduce transparency"
            checked={solid}
            onChange={() => setSolid(!solid)}
          />
        </div>
        <div className="setting-row">
          <div>
            <h3>Match sounds</h3>
            <p>
              A soft sound when a useful connection appears in the spatial
              preview.
            </p>
          </div>
          <Toggle
            label="Match sounds"
            checked={sounds}
            onChange={() => {
              setSounds(!sounds);
              try {
                localStorage.setItem("questmatch-sounds", String(!sounds));
              } catch {
                /* Preference remains in memory. */
              }
            }}
          />
        </div>
        <div className="setting-row">
          <div>
            <h3>Export your information</h3>
            <p>Your profile and saved connections as a JSON file.</p>
          </div>
          <Button variant="secondary" onClick={exportData}>
            Export
            <Download size={15} />
          </Button>
        </div>
        <div className="setting-row">
          <div>
            <h3>Clear this event’s data</h3>
            <p>
              Remove saved demo connections and matches, and leave the room.
              Keep your profile.
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={!state.session?.code}
            busy={busy}
            onClick={async () => {
              try {
                await act("event-data/clear");
                notify("Event data cleared. Your introduction is still here.");
              } catch {
                /* Service error shown. */
              }
            }}
          >
            Clear event data
          </Button>
        </div>
        <div className="setting-row">
          <div>
            <h3>Leave the demo</h3>
            <p>Sign out of your temporary account.</p>
          </div>
          <Button variant="secondary" busy={busy} onClick={logout}>
            Sign out
            <LogOut size={15} />
          </Button>
        </div>
        <a className="profile-map-link" href="#/map">
          Explore the product map
          <ArrowUpRight size={14} />
        </a>
      </section>
    </div>
  );
}

function ChipField({
  label,
  values,
  onChange,
  suggestions,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
}) {
  const [input, setInput] = useState("");
  const inputId = useId();
  const add = (value: string) => {
    const clean = value.trim().replace(/,$/, "");
    if (
      clean &&
      clean.length <= 40 &&
      values.length < 6 &&
      !values.some((v) => v.toLowerCase() === clean.toLowerCase())
    )
      onChange([...values, clean]);
    setInput("");
  };
  return (
    <div className="chip-field">
      <label htmlFor={inputId}>{label}</label>
      <span className="chip-input">
        {values.map((v) => (
          <span className="editable-tag" key={v}>
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          maxLength={40}
          value={input}
          disabled={values.length >= 6}
          placeholder={values.length >= 6 ? "Up to 6 topics" : "Add a topic…"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(input);
            }
          }}
          onBlur={() => input && add(input)}
        />
      </span>
      <div className="suggestions">
        <span>Try</span>
        {suggestions
          .filter((s) => !values.includes(s))
          .slice(0, 3)
          .map((s) => (
            <button
              type="button"
              key={s}
              disabled={values.length >= 6}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
            >
              <Plus size={11} />
              {s}
            </button>
          ))}
      </div>
    </div>
  );
}
