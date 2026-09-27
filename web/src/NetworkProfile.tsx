import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  Mail,
  MapPin,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserPlus,
} from "lucide-react";
import {
  assessmentRouteLabel,
  assessmentRoute,
  assessmentScore,
  assessmentSourceLabel,
  MATCH_THRESHOLD,
  type NetworkPerson,
} from "./networkModel";
import type { Action, ConnectionRequest, Profile, State } from "./types";
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

function CompatibilityValue({ person }: { person: NetworkPerson }) {
  const { compatibility } = person;
  const score = assessmentScore(compatibility);
  const hasScore = score !== null;
  return (
    <div className={`np-score ${hasScore && score >= MATCH_THRESHOLD ? "np-score--high" : ""}`}>
      <span className="np-score-value">
        {hasScore ? score : "—"}
        {hasScore && <small>/100</small>}
      </span>
      <span className="np-score-copy">
        <strong>{hasScore ? assessmentRouteLabel(assessmentRoute(compatibility)) : "Score unavailable"}</strong>
        <small>
          {compatibility.status === "partial" || compatibility.status === "unavailable"
            ? "Not enough shared information"
            : assessmentSourceLabel(compatibility)}
        </small>
      </span>
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

function SaveProfileButton({ saved, busy, onSave }: { saved: boolean; busy: boolean; onSave: () => void }) {
  const [highlighted, setHighlighted] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      busy={busy}
      disabled={busy}
      aria-label={saved ? "Unsave connection" : "Save connection"}
      onPointerEnter={() => setHighlighted(true)}
      onPointerLeave={() => setHighlighted(false)}
      onFocus={() => setHighlighted(true)}
      onBlur={() => setHighlighted(false)}
      onClick={onSave}
      className="np-save-connection"
    >
      {saved ? <Check size={15} aria-hidden="true" /> : <Bookmark size={15} aria-hidden="true" />}
      {saved ? highlighted ? "Unsave" : "Saved" : "Save profile"}
    </Button>
  );
}

function RelationshipActions({ request, userId, eligible, saved, busy, onSave, onRequest, onRespond, onFollowUp }: {
  request?: ConnectionRequest;
  userId: string;
  eligible: boolean;
  saved: boolean;
  busy: boolean;
  onSave: () => void;
  onRequest: () => void;
  onRespond: (action: "accept" | "decline" | "cancel") => void;
  onFollowUp: () => void;
}) {
  const pending = request?.status === "pending";
  const incoming = pending && request.recipientId === userId;
  const outgoing = pending && request.senderId === userId;
  const accepted = request?.status === "accepted";
  return (
    <div className="np-relationship-actions" aria-label="Profile actions">
      {incoming ? (
        <div className="np-request-actions">
          <Button type="button" busy={busy} onClick={() => onRespond("accept")}><UserCheck size={15} />Accept</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => onRespond("decline")}>Decline</Button>
        </div>
      ) : outgoing ? (
        <div className="np-request-actions">
          <Button type="button" variant="secondary" disabled><Clock3 size={15} />Request sent</Button>
          <button className="np-request-text-action" type="button" disabled={busy} onClick={() => onRespond("cancel")}>Cancel request</button>
        </div>
      ) : accepted ? (
        <div className="np-request-actions">
          <Button type="button" variant="secondary" disabled><Check size={15} />Connected</Button>
          <Button type="button" variant="secondary" onClick={onFollowUp}>Follow up</Button>
        </div>
      ) : eligible ? (
        <Button type="button" busy={busy} onClick={onRequest} className="np-request-connection"><UserPlus size={15} />Request to connect</Button>
      ) : saved ? (
        <Button type="button" variant="secondary" onClick={onFollowUp}>Follow up</Button>
      ) : null}
      <SaveProfileButton saved={saved} busy={busy} onSave={onSave} />
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

function CompatibilitySection({ person, loading, onRetry }: { person: NetworkPerson; loading?: boolean; onRetry?: () => void }) {
  const { compatibility } = person;
  const strongestRoute = assessmentRoute(compatibility);
  const hasNetworkingDetails = compatibility.categories.some(category => category.points !== null);
  const detailLabel = compatibility.source === "gemini"
    ? "AI estimate from shared profile information"
    : compatibility.source === "fixture"
      ? "Prepared example details"
      : compatibility.source === "rules"
        ? assessmentSourceLabel(compatibility)
        : "Compatibility details";
  const routes = compatibility.routes
    ? [
        { id: "networking", label: "Networking fit", score: compatibility.routes.networking },
        { id: "professional", label: "Professional experience", score: compatibility.routes.professional },
        { id: "personal", label: "Personal experience", score: compatibility.routes.personal },
      ] as const
    : [];
  return (
    <section className="np-compatibility" aria-labelledby="np-compatibility-title">
      <div className="np-compatibility-head">
        <div className="np-rail-title">
          <Sparkles size={15} aria-hidden="true" />
          <h2 id="np-compatibility-title">Why you should connect</h2>
        </div>
      </div>
      <p className="np-compatibility-summary">{loading ? "Finding the strongest reason for you to talk…" : compatibility.reason || person.reason}</p>
      <div className="np-common-ground">
        <h3>Common ground</h3>
        <TopicList items={person.sharedInterests} empty="No shared interests are visible yet." />
      </div>
      {(person.theyOffer.length > 0 || person.youOffer.length > 0) && (
        <div className="np-contributions">
          {person.theyOffer.length > 0 && <div><h3>{firstName(person.profile)} can help you with</h3><TopicList items={person.theyOffer} empty="" /></div>}
          {person.youOffer.length > 0 && <div><h3>You can help {firstName(person.profile)} with</h3><TopicList items={person.youOffer} empty="" /></div>}
        </div>
      )}

      {compatibility.source === "unavailable" && !loading && onRetry && (
        <button className="np-retry" type="button" onClick={onRetry}><RefreshCw size={14} />Try compatibility again</button>
      )}

      <details className="np-disclosure">
        <summary>{detailLabel} <ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="np-breakdown">
          <CompatibilityValue person={person} />
          {routes.map((route) => (
            <div className="np-category" key={route.id}>
              <div>
                <strong>{route.label}</strong>
                <span>{route.score === null ? "Not assessed" : `${route.score} / 100`}</span>
              </div>
              <p>{strongestRoute === route.id ? "Strongest route" : "Route score"}</p>
            </div>
          ))}
          {hasNetworkingDetails && (
            <p className="np-empty-copy">
              {strongestRoute && strongestRoute !== "networking"
                ? `Networking rubric · separate from the ${assessmentRouteLabel(strongestRoute).toLowerCase()} score`
                : "Networking rubric"}
            </p>
          )}
          {hasNetworkingDetails && compatibility.categories.map((category) => {
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
          {!routes.length && !hasNetworkingDetails && (
            <p className="np-empty-copy">No score details are available for this assessment.</p>
          )}
        </div>
      </details>

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
      notify("Profile removed from your saved people.");
    } catch {
      // The parent presents service errors.
    }
  }

  return (
    <Disclosure
      className="np-follow-up"
      title={connection ? "Your follow-up" : "Start a conversation"}
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
                Remove saved profile
              </button>
            )}
          </>
        )}
      </div>
    </Disclosure>
  );
}

function Expanded({ person, user, state, act, busy, notify, onClose, onSave, request, requestEligible, onRequest, onRespond, assessmentLoading, onRetryAssessment, notes, setNotes, reminder, setReminder, status, setStatus, message, setMessage, messageOpen, setMessageOpen, followUpOpen, setFollowUpOpen }: {
  person: NetworkPerson;
  user: Profile;
  state: State;
  act: Action;
  busy: boolean;
  notify: (message: string) => void;
  onClose: () => void;
  onSave: () => void;
  request?: ConnectionRequest;
  requestEligible: boolean;
  onRequest: () => void;
  onRespond: (action: "accept" | "decline" | "cancel") => void;
  assessmentLoading?: boolean;
  onRetryAssessment?: () => void;
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
          request={request}
          userId={user.id}
          eligible={requestEligible}
          saved={Boolean(connection && connection.saved !== false)}
          busy={busy}
          onSave={onSave}
          onRequest={onRequest}
          onRespond={onRespond}
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
              <CompatibilitySection person={person} loading={assessmentLoading} onRetry={onRetryAssessment} />
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

export function NetworkProfile({ person, user, state, act, busy, notify, onClose, onSave, request, requestEligible = false, onRequest, onRespond, assessmentLoading, onRetryAssessment }: {
  person: NetworkPerson;
  user: Profile;
  state: State;
  act: Action;
  busy: boolean;
  notify: (s: string) => void;
  onClose: () => void;
  onSave: () => void;
  request?: ConnectionRequest;
  requestEligible?: boolean;
  onRequest: () => void;
  onRespond: (action: "accept" | "decline" | "cancel") => void;
  assessmentLoading?: boolean;
  onRetryAssessment?: () => void;
}) {
  const connection = person.connection;
  const [notes, setNotes] = useState(connection?.notes || "");
  const [reminder, setReminder] = useState(connection?.reminderDate || "");
  const [status, setStatus] = useState<"none" | "needed" | "contacted">(connection?.followUp || "needed");
  const suggestedMessage = initialMessage(person);
  const [message, setMessage] = useState(suggestedMessage);
  const [messageOpen, setMessageOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(true);

  useEffect(() => {
    setMessage(suggestedMessage);
    setMessageOpen(false);
  }, [suggestedMessage]);

  return (
    <article className="np-profile np-profile--expanded">
      <Header onClose={onClose} />
      <Expanded
        person={person}
        user={user}
        state={state}
        act={act}
        busy={busy}
        notify={notify}
        onClose={onClose}
        onSave={onSave}
        request={request}
        requestEligible={requestEligible}
        onRequest={onRequest}
        onRespond={onRespond}
        assessmentLoading={assessmentLoading}
        onRetryAssessment={onRetryAssessment}
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
