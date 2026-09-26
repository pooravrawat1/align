import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  Mail,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import type { NetworkPerson } from "./networkModel";
import type { Action, Profile, State } from "./types";
import { Avatar, Button, Chip } from "./ui";
import "./NetworkProfile.css";

const contactIcons = {
  linkedin: Linkedin,
  github: Github,
  website: Globe,
  email: Mail,
};

function firstName(profile: Profile) {
  return profile.name.trim().split(/\s+/u)[0] || profile.name;
}

function initialMessage(person: NetworkPerson) {
  const shared = person.withdrawn ? [] : person.sharedInterests.slice(0, 2);
  return shared.length
    ? `Hi ${firstName(person.profile)}—I'd love to compare notes on ${shared.join(" and ")}.`
    : `Hi ${firstName(person.profile)}—I'd love to keep in touch.`;
}

function eventName(state: State, person: NetworkPerson) {
  const eventId = person.connection?.eventId;
  if (!eventId) return null;
  return (
    state.events.find((event) => event.id === eventId)?.name ??
    (eventId === "demo" ? "The Builders Room" : eventId)
  );
}

function metDate(person: NetworkPerson) {
  if (!person.connection?.createdAt) return null;
  const date = new Date(person.connection.createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TopicList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="np-empty-copy">{empty}</p>;
  return (
    <ul className="np-topic-list">
      {items.map((item) => (
        <Chip as="li" key={item}>{item}</Chip>
      ))}
    </ul>
  );
}

function ContactLinks({ person }: { person: NetworkPerson }) {
  if (!person.contacts.length) return null;
  return (
    <div className="np-contact-links" aria-label={`Contact links for ${person.profile.name}`}>
      {person.contacts.map((contact) => {
        const Icon = contactIcons[contact.kind];
        const external = contact.kind !== "email";
        return (
          <a
            href={contact.href}
            key={`${contact.kind}:${contact.href}`}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            aria-label={`${contact.label} for ${person.profile.name}`}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{contact.label}</span>
            {external && <ExternalLink className="np-contact-external" size={12} aria-hidden="true" />}
          </a>
        );
      })}
    </div>
  );
}

function CompatibilityValue({ person, compact = false }: { person: NetworkPerson; compact?: boolean }) {
  const { compatibility } = person;
  const hasScore = compatibility.score !== null;
  return (
    <div className={`np-score ${compact ? "np-score--compact" : ""} ${hasScore && compatibility.score! >= 80 ? "np-score--high" : ""}`}>
      <span className="np-score-value">
        {hasScore ? compatibility.score : "—"}
        {hasScore && <small>/100</small>}
      </span>
      <span className="np-score-copy">
        <strong>{hasScore ? "Compatibility" : "Score unavailable"}</strong>
        <small>
          {compatibility.status === "partial"
            ? "More profile detail needed"
            : compatibility.status === "unavailable"
              ? "Not enough shared information"
              : "Based on shared details"}
        </small>
      </span>
    </div>
  );
}

function Header({ expanded, name, onExpand, onClose }: {
  expanded: boolean;
  name: string;
  onExpand: () => void;
  onClose: () => void;
}) {
  return (
    <header className="np-header">
      {expanded ? (
        <button className="np-back" type="button" onClick={onExpand}>
          <ArrowLeft size={15} aria-hidden="true" />
          Back to network
        </button>
      ) : (
        <span>Profile preview</span>
      )}
      <button className="np-close" type="button" onClick={onClose} aria-label={`Close ${name}'s profile`}>
        <X size={17} aria-hidden="true" />
      </button>
    </header>
  );
}

function SaveConnectionButton({ saved, busy, onSave }: { saved: boolean; busy: boolean; onSave: () => void }) {
  return (
    <Button
      type="button"
      variant={saved ? "secondary" : "primary"}
      busy={!saved && busy}
      disabled={saved || busy}
      onClick={onSave}
      className="np-save-connection"
    >
      {saved ? <Check size={15} aria-hidden="true" /> : <Bookmark size={15} aria-hidden="true" />}
      {saved ? "Saved" : "Save connection"}
    </Button>
  );
}

function Preview({ person, busy, onExpand, onSave }: {
  person: NetworkPerson;
  busy: boolean;
  onExpand: () => void;
  onSave: () => void;
}) {
  const profile = person.profile;
  return (
    <div className="np-preview-body">
      <div className="np-preview-identity">
        <Avatar profile={profile} size="large" />

        <h2>{profile.name}</h2>
        <p>{profile.role || "Role not shared"}</p>
        {profile.location && (
          <span className="np-location"><MapPin size={13} aria-hidden="true" />{profile.location}</span>
        )}
        <ContactLinks person={person} />
        {profile.contact && (
          <p className="np-other-contact"><span>Other contact</span>{profile.contact}</p>
        )}
        <button className="np-open-profile" type="button" onClick={onExpand}>
          <span>Explore profile</span> <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>

      {person.withdrawn ? (
        <div className="np-private-notice" role="status">
          <strong>This profile is now private.</strong>
          <p>The person’s shared details are no longer available. Your saved connection notes remain private to you.</p>
        </div>
      ) : (
        <>
          <section className="np-preview-fit" aria-label="Compatibility overview">
            <CompatibilityValue person={person} compact />
            <p>{person.reason}</p>
          </section>

          <section className="np-preview-section">
            <h3>Common ground</h3>
            <TopicList items={person.sharedInterests} empty="No shared interests are visible yet." />
          </section>

          {person.project && (
            <section className="np-preview-project">
              <h3>{person.project.title}</h3>
              <p>{person.project.description}</p>
            </section>
          )}
        </>
      )}

      <div className="np-preview-actions">
        <SaveConnectionButton saved={Boolean(person.connection)} busy={busy} onSave={onSave} />
      </div>
    </div>
  );
}

function MessageComposer({ person, notify, message, setMessage, open, setOpen }: {
  person: NetworkPerson;
  notify: (message: string) => void;
  message: string;
  setMessage: (message: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const fieldId = useId();
  const [copying, setCopying] = useState(false);

  async function copyMessage() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(message);
      notify("Message copied.");
    } catch {
      notify("Couldn’t copy. Select the message and copy it manually.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <details className="np-message" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span>Draft a message</span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="np-message-body">
        <div className="np-message-person">
          <Avatar profile={person.profile} />
          <span><strong>Keep in touch</strong><small>Nothing is sent from Catalyst.</small></span>
        </div>
        <label htmlFor={fieldId}>Message draft</label>
        <textarea
          ref={(node) => {
            if (node && node.dataset.pendingFocus === "true") {
              node.focus();
              delete node.dataset.pendingFocus;
            }
          }}
          id={fieldId}
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <Button type="button" busy={copying} disabled={!message.trim()} onClick={() => void copyMessage()}>
          Copy message <Copy size={15} aria-hidden="true" />
        </Button>
      </div>
    </details>
  );
}

function CompatibilityRail({ person, useStarter }: { person: NetworkPerson; useStarter: () => void }) {
  const { compatibility } = person;
  return (
    <section className="np-compatibility" aria-labelledby="np-compatibility-title">
      <div className="np-rail-title">
        <Sparkles size={15} aria-hidden="true" />
        <h2 id="np-compatibility-title">Why you connect</h2>
      </div>
      <CompatibilityValue person={person} />
      <p className="np-compatibility-summary">{compatibility.summary || person.reason}</p>

      <details className="np-disclosure">
        <summary>Compatibility details <ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="np-breakdown">
          {compatibility.categories.map((category) => {
            const known = category.points !== null;
            const width = known && category.max > 0
              ? `${Math.min(100, Math.max(0, (category.points! / category.max) * 100))}%`
              : "0%";
            return (
              <div className="np-category" key={category.id}>
                <div><strong>{category.label}</strong><span>{known ? category.points : "—"} / {category.max}</span></div>
                <span className="np-category-track" aria-hidden="true"><span style={{ width }} /></span>
                <p>{category.evidence}</p>
              </div>
            );
          })}
        </div>
      </details>

      <details className="np-disclosure np-insight">
        <summary>AI insight <ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="np-insight-body">
          <p>{compatibility.suggestion}</p>
          {compatibility.starter && (
            <>
              <blockquote>{compatibility.starter}</blockquote>
              <button type="button" onClick={useStarter}>Use this in a message</button>
            </>
          )}

        </div>
      </details>
    </section>
  );
}

function FollowUp({ person, busy, act, notify, onClose, notes, setNotes, reminder, setReminder, status, setStatus, message, setMessage, messageOpen, setMessageOpen }: {
  person: NetworkPerson;
  busy: boolean;
  act: Action;
  notify: (message: string) => void;
  onClose: () => void;
  notes: string;
  setNotes: (value: string) => void;
  reminder: string;
  setReminder: (value: string) => void;
  status: "none" | "needed" | "contacted";
  setStatus: (value: "none" | "needed" | "contacted") => void;
  message: string;
  setMessage: (message: string) => void;
  messageOpen: boolean;
  setMessageOpen: (open: boolean) => void;
}) {
  const connection = person.connection;

  async function saveDetails() {
    if (!connection) return;
    try {
      await act(`connections/${person.profile.id}`, { notes, reminderDate: reminder, followUp: status }, "PATCH");
      notify("Connection details saved.");
    } catch {
      // The parent presents service errors.
    }
  }

  async function removeConnection() {
    if (!connection) return;
    try {
      await act(`connections/${person.profile.id}`, undefined, "DELETE");
      onClose();
      notify("Connection removed from your network.");
    } catch {
      // The parent presents service errors.
    }
  }

  return (
    <section className="np-follow-up" aria-labelledby="np-follow-up-title">
      <h2 id="np-follow-up-title">{connection ? "Your follow-up" : "Start a conversation"}</h2>
      <MessageComposer
        person={person}
        notify={notify}
        message={message}
        setMessage={setMessage}
        open={messageOpen}
        setOpen={setMessageOpen}
      />
      {connection && (
        <>
          <div className="np-fields">
            <label>
              Follow-up status
              <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                <option value="needed">Needs follow-up</option>
                <option value="contacted">Contacted</option>
                <option value="none">No follow-up needed</option>
              </select>
            </label>
            <label>
              Private notes
              <textarea
                rows={4}
                maxLength={2000}
                placeholder="What would you like to remember?"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <label>
              Follow-up date
              <input type="date" value={reminder} onChange={(event) => setReminder(event.target.value)} />
              <small>Only visible to you. No reminder is sent.</small>
            </label>
          </div>
          <Button type="button" busy={busy} onClick={() => void saveDetails()} className="np-save-details">
            Save follow-up <Check size={15} aria-hidden="true" />
          </Button>
          <button className="np-remove" type="button" disabled={busy} onClick={() => void removeConnection()}>
            Remove connection
          </button>
        </>
      )}
    </section>
  );
}

function Expanded({ person, state, act, busy, notify, onClose, onSave, notes, setNotes, reminder, setReminder, status, setStatus, message, setMessage, messageOpen, setMessageOpen }: {
  person: NetworkPerson;
  state: State;
  act: Action;
  busy: boolean;
  notify: (message: string) => void;
  onClose: () => void;
  onSave: () => void;
  notes: string;
  setNotes: (value: string) => void;
  reminder: string;
  setReminder: (value: string) => void;
  status: "none" | "needed" | "contacted";
  setStatus: (value: "none" | "needed" | "contacted") => void;
  message: string;
  setMessage: (value: string) => void;
  messageOpen: boolean;
  setMessageOpen: (open: boolean) => void;
}) {
  const connection = person.connection;
  const draftRef = useRef(message);
  draftRef.current = message;

  function useStarter() {
    setMessage(person.compatibility.starter || draftRef.current);
    setMessageOpen(true);
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLTextAreaElement>(".np-message textarea");
      if (field) {
        field.dataset.pendingFocus = "true";
        field.focus();
        delete field.dataset.pendingFocus;
      }
    });
  }

  const profile = person.profile;
  const event = eventName(state, person);
  const date = metDate(person);
  const showAbout = Boolean(
    profile.bio.trim() &&
    profile.bio.trim() !== person.project?.description.trim(),
  );
  return (
    <div className="np-expanded-body">
      <section className="np-identity">
        <Avatar profile={profile} size="large" />
        <div className="np-identity-copy">
          <div className="np-name-line">
            <h1>{profile.name}</h1>

          </div>
          <p>{profile.role || "Role not shared"}</p>
          <div className="np-identity-meta">
            {profile.location && <span><MapPin size={13} aria-hidden="true" />{profile.location}</span>}
            {(event || date) && <span><CalendarDays size={13} aria-hidden="true" />{date}{event && `${date ? " · " : ""}${event}`}</span>}
          </div>
          <ContactLinks person={person} />
          {profile.contact && (
            <p className="np-other-contact"><span>Other contact</span>{profile.contact}</p>
          )}
        </div>
        <SaveConnectionButton saved={Boolean(connection)} busy={busy} onSave={onSave} />
      </section>

      <div className="np-columns">
        <div className="np-main">
          {person.withdrawn ? (
            <div className="np-private-notice" role="status">
              <strong>This profile is now private.</strong>
              <p>The person’s shared profile details are no longer available. Your own notes and follow-up status remain available in your follow-up.</p>
            </div>
          ) : (
            <>
              {person.project && (
                <section className="np-project">
                  <div>
                    <h2>{person.project.title}</h2>
                    <p>{person.project.description}</p>
                  </div>
                  <TopicList items={person.project.topics} empty="No project topics shared." />
                </section>
              )}

              {showAbout && (
                <section className="np-section">
                  <h2>About</h2>
                  <p className="np-prose">{profile.bio}</p>
                </section>
              )}

              <section className="np-section">
                <h2>Common ground</h2>
                <TopicList items={person.sharedInterests} empty="No shared interests are visible yet." />
              </section>

              <section className="np-bring" aria-label="What each person brings">
                <div>
                  <h2>They bring</h2>
                  <TopicList items={person.theyOffer} empty="No matching skills visible." />
                </div>
                <div>
                  <h2>You bring</h2>
                  <TopicList items={person.youOffer} empty="No complementary skills visible." />
                </div>
              </section>

              {person.goals.length > 0 && (
                <section className="np-section">
                  <h2>Goals</h2>
                  <TopicList items={person.goals} empty="" />
                </section>
              )}

              {(profile.skills.length > 0 || profile.lookingFor.length > 0) && (
                <section className="np-split-section">
                  {profile.skills.length > 0 && (
                    <div>
                      <h2>Skills</h2>
                      <TopicList items={profile.skills} empty="" />
                    </div>
                  )}
                  {profile.lookingFor.length > 0 && (
                    <div>
                      <h2>Looking for</h2>
                      <TopicList items={profile.lookingFor} empty="" />
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        <aside className="np-rail">
          {!person.withdrawn && <CompatibilityRail person={person} useStarter={useStarter} />}
          <FollowUp
            person={person}
            busy={busy}
            act={act}
            notify={notify}
            onClose={onClose}
            notes={notes}
            setNotes={setNotes}
            reminder={reminder}
            setReminder={setReminder}
            status={status}
            setStatus={setStatus}
            message={message}
            setMessage={setMessage}
            messageOpen={messageOpen}
            setMessageOpen={setMessageOpen}
          />
        </aside>
      </div>
    </div>
  );
}

export function NetworkProfile({ person, state, act, busy, notify, expanded, onExpand, onClose, onSave }: {
  person: NetworkPerson;
  user: Profile;
  state: State;
  act: Action;
  busy: boolean;
  notify: (s: string) => void;
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const connection = person.connection;
  const [notes, setNotes] = useState(connection?.notes || "");
  const [reminder, setReminder] = useState(connection?.reminderDate || "");
  const [status, setStatus] = useState<"none" | "needed" | "contacted">(connection?.followUp || "needed");
  const suggestedMessage = initialMessage(person);
  const [message, setMessage] = useState(suggestedMessage);
  const [messageOpen, setMessageOpen] = useState(false);

  useEffect(() => {
    setMessage(suggestedMessage);
    setMessageOpen(false);
  }, [suggestedMessage]);

  return (
    <article className={`np-profile ${expanded ? "np-profile--expanded" : "np-profile--preview"}`}>
      <Header expanded={expanded} name={person.profile.name} onExpand={onExpand} onClose={expanded ? onExpand : onClose} />
      {expanded ? (
        <Expanded
          person={person}
          state={state}
          act={act}
          busy={busy}
          notify={notify}
          onClose={onClose}
          onSave={onSave}
          notes={notes}
          setNotes={setNotes}
          reminder={reminder}
          setReminder={setReminder}
          status={status}
          setStatus={setStatus}
          message={message}
          setMessage={setMessage}
          messageOpen={messageOpen}
          setMessageOpen={setMessageOpen}
        />
      ) : (
        <Preview person={person} busy={busy} onExpand={onExpand} onSave={onSave} />
      )}
    </article>
  );
}
