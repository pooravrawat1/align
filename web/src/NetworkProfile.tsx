import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
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
} from "lucide-react";
import { type NetworkPerson } from "./networkModel";
import type { Action, Profile, State } from "./types";
import { Avatar, Button, Chip, Disclosure } from "./ui";
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

function Header({ onClose }: {
  onClose: () => void;
}) {
  return (
    <header className="np-header np-header--expanded">
      <button className="np-back" type="button" onClick={onClose} aria-label="Back to network">
        <ArrowLeft size={15} aria-hidden="true" />
        Back
      </button>
    </header>
  );
}

function RememberPersonButton({ saved, busy, onSave }: { saved: boolean; busy: boolean; onSave: () => void }) {
  const [highlighted, setHighlighted] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      busy={busy}
      disabled={busy}
      aria-label={saved ? "Remove from your people" : "Remember this person"}
      onPointerEnter={() => setHighlighted(true)}
      onPointerLeave={() => setHighlighted(false)}
      onFocus={() => setHighlighted(true)}
      onBlur={() => setHighlighted(false)}
      onClick={onSave}
      className="np-save-connection"
    >
      {saved ? <Check size={15} aria-hidden="true" /> : <Bookmark size={15} aria-hidden="true" />}
      {saved ? highlighted ? "Remove" : "Remembered" : "Remember person"}
    </Button>
  );
}

function RelationshipActions({ saved, busy, onSave, onFollowUp }: {
  saved: boolean;
  busy: boolean;
  onSave: () => void;
  onFollowUp: () => void;
}) {
  return (
    <div className="np-relationship-actions" aria-label="Profile actions">
      {saved && <Button type="button" variant="secondary" onClick={onFollowUp}>Follow up</Button>}
      <RememberPersonButton saved={saved} busy={busy} onSave={onSave} />
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

function SharedContext({ person, state }: { person: NetworkPerson; state: State }) {
  const event = eventName(state, person);
  const date = metDate(person);
  const readyReason = person.compatibility.status === "ready" ? person.compatibility.reason : "";
  return (
    <section className="np-compatibility" aria-labelledby="np-shared-context-title">
      <div className="np-rail-title">
        <Sparkles size={15} aria-hidden="true" />
        <h2 id="np-shared-context-title">What you share</h2>
      </div>
      {(event || date) && (
        <div className="np-common-ground">
          <h3>How you know each other</h3>
          <p>{event ? `Met at ${event}` : "Met through Catalyst"}{date ? ` · ${date}` : ""}</p>
        </div>
      )}
      {person.sharedExperiences.length > 0 && (
        <div className="np-common-ground">
          <h3>Shared experiences</h3>
          <TopicList items={person.sharedExperiences.map((experience) => experience.label)} empty="" />
        </div>
      )}
      {readyReason && <p className="np-compatibility-summary">{readyReason}</p>}
      {person.sharedInterests.length > 0 && (
        <div className="np-common-ground">
          <h3>Common ground</h3>
          <TopicList items={person.sharedInterests} empty="" />
        </div>
      )}
      {!person.sharedExperiences.length && !person.sharedInterests.length && !readyReason && (
        <p className="np-empty-copy">Add a private note about what you talked about.</p>
      )}
    </section>
  );
}

function FollowUp({ person, useStarter, busy, act, notify, onClose, notes, setNotes, reminder, setReminder, status, setStatus, message, setMessage, messageOpen, setMessageOpen, open, setOpen }: {
  person: NetworkPerson;
  useStarter: () => void;
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
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const connection = person.connection;

  async function saveDetails() {
    if (!connection) return;
    try {
      await act(`connections/${person.profile.id}`, { notes, reminderDate: reminder, followUp: status }, "PATCH");
      notify("Follow-up details saved.");
    } catch {
      // The parent presents service errors.
    }
  }

  async function removeConnection() {
    if (!connection) return;
    try {
      await act(`connections/${person.profile.id}`, undefined, "DELETE");
      onClose();
      notify("Removed from your people.");
    } catch {
      // The parent presents service errors.
    }
  }

  return (
    <Disclosure
      className="np-follow-up"
      title={connection ? "Your follow-up" : "After you meet"}
      description={connection ? "Message, notes, and reminder" : "Draft a message when you’re ready"}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <div className="np-follow-up-body">
        {!person.withdrawn && person.compatibility.starter && <div className="np-conversation-starter"><span>Conversation starter</span><blockquote>{person.compatibility.starter}</blockquote><button type="button" onClick={useStarter}>Use this in a message</button></div>}
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
                Follow-up date
                <input type="date" value={reminder} onChange={(event) => setReminder(event.target.value)} />
                <small>Only visible to you. No reminder is sent.</small>
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
            </div>
            <Button type="button" busy={busy} onClick={() => void saveDetails()} className="np-save-details">
              Save follow-up <Check size={15} aria-hidden="true" />
            </Button>
            {connection.saved !== false && (
              <button className="np-remove" type="button" disabled={busy} onClick={() => void removeConnection()}>
                Remove from your people
              </button>
            )}
          </>
        )}
      </div>
    </Disclosure>
  );
}

function Expanded({ person, state, act, busy, notify, onClose, onSave, notes, setNotes, reminder, setReminder, status, setStatus, message, setMessage, messageOpen, setMessageOpen, followUpOpen, setFollowUpOpen }: {
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
  followUpOpen: boolean;
  setFollowUpOpen: (open: boolean) => void;
}) {
  const connection = person.connection;
  const draftRef = useRef(message);
  draftRef.current = message;

  function useStarter() {
    setMessage(person.compatibility.starter || draftRef.current);
    setFollowUpOpen(true);
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
  const showMore = person.goals.length > 0 || profile.skills.length > 0 || profile.lookingFor.length > 0 || !!profile.domains?.length || !!profile.experiences?.length;
  return (
    <div className="np-expanded-body">
      <section className="np-identity">
        <Avatar profile={profile} size="large" />
        <div className="np-identity-copy">
          <div className="np-name-line">
            <h1 tabIndex={-1} data-profile-focus>{profile.name}</h1>
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
        <RelationshipActions
          saved={Boolean(connection && connection.saved !== false)}
          busy={busy}
          onSave={onSave}
          onFollowUp={() => {
            setFollowUpOpen(true);
            requestAnimationFrame(() => document.querySelector(".np-follow-up")?.scrollIntoView({ block: "nearest" }));
          }}
        />
      </section>

      <div className="np-main">
          {person.withdrawn ? (
            <div className="np-private-notice" role="status">
              <strong>This profile is now private.</strong>
              <p>The person’s shared profile details are no longer available. Your own notes and follow-up status remain available in your follow-up.</p>
            </div>
          ) : (
            <>
              <SharedContext person={person} state={state} />
              {profile.bio && (
                <section className="np-project">
                  <div>
                    <h2>What {firstName(profile)} is working on</h2>
                    <p>{profile.bio}</p>
                  </div>
                </section>
              )}

            </>
          )}
          <FollowUp
            person={person}
            useStarter={useStarter}
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
            open={followUpOpen}
            setOpen={setFollowUpOpen}
          />
          {!person.withdrawn && showMore && (
            <Disclosure className="np-more-profile" title={`More about ${firstName(profile)}`} description="Goals, skills, and past experiences">
              <div className="np-more-profile-body">
                {person.goals.length > 0 && <div><h2>Goals</h2><TopicList items={person.goals} empty="" /></div>}
                {profile.skills.length > 0 && <div><h2>Skills</h2><TopicList items={profile.skills} empty="" /></div>}
                {profile.lookingFor.length > 0 && <div><h2>Looking for</h2><TopicList items={profile.lookingFor} empty="" /></div>}
                {!!profile.domains?.length && <div><h2>Domains</h2><TopicList items={profile.domains} empty="" /></div>}
                {!!profile.experiences?.length && <div><h2>Past experiences</h2>{profile.experiences.map((experience, index) => <p key={index}>{experience.label} · {experience.kind}{experience.year ? ` · ${experience.year}` : ""}</p>)}</div>}
              </div>
            </Disclosure>
          )}
      </div>
    </div>
  );
}

export function NetworkProfile({ person, state, act, busy, notify, onClose, onSave }: {
  person: NetworkPerson;
  state: State;
  act: Action;
  busy: boolean;
  notify: (s: string) => void;
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
  const [followUpOpen, setFollowUpOpen] = useState(false);

  useEffect(() => {
    setMessage(suggestedMessage);
    setMessageOpen(false);
  }, [suggestedMessage]);

  return (
    <article className="np-profile np-profile--expanded">
      <Header onClose={onClose} />
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
        followUpOpen={followUpOpen}
        setFollowUpOpen={setFollowUpOpen}
      />
    </article>
  );
}
