import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { Profile } from "./types";
import { Avatar, Chip } from "./ui";
import {
  homeCollaborators,
  isProfileFieldVisible,
} from "./collaboratorSuggestions";
import "./HomeCollaborators.css";

interface HomeCollaboratorsProps {
  profiles: Profile[];
  user: Profile;
  eventName: string;
  busy: boolean;
  onClose: () => void;
  onEnter: () => void;
}

export function HomeCollaborators({
  profiles,
  user,
  eventName,
  busy,
  onClose,
  onEnter,
}: HomeCollaboratorsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousSelection = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const collaborators = useMemo(
    () => homeCollaborators(profiles, user),
    [profiles, user],
  );
  const selected = collaborators.find(
    ({ profile }) => profile.id === selectedId,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const trigger = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      trigger?.focus();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedId) {
      dialog?.querySelector<HTMLButtonElement>(".home-collaborators-back")?.focus();
    } else if (previousSelection.current) {
      const person = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("[data-person-id]") ?? [])
        .find((button) => button.dataset.personId === previousSelection.current);
      person?.focus();
    }
    previousSelection.current = selectedId;
  }, [selectedId]);

  const headingId = "home-collaborators-heading";

  return (
    <dialog
      ref={dialogRef}
      className="home-collaborators-dialog"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="home-collaborators-drawer">
        <header className="home-collaborators-header">
          <div>
            <span className="home-collaborators-kicker">{eventName}</span>
            <h2 id={headingId}>
              {selected ? selected.profile.name : "People to meet"}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="home-collaborators-icon-button"
            aria-label="Close people to meet"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>

        {selected ? (
          <CollaboratorDetail
            person={selected.profile}
            reason={selected.reason}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="home-collaborators-content">
            <p className="home-collaborators-intro">
              Explore sample profiles through shared interests and complementary skills.
            </p>
            {collaborators.length > 0 ? (
              <ul className="home-collaborators-list">
                {collaborators.map(({ profile, reason }) => (
                  <li key={profile.id}>
                    <button
                      type="button"
                      data-person-id={profile.id}
                      className="home-collaborators-person"
                      onClick={() => setSelectedId(profile.id)}
                    >
                      <Avatar profile={profile} />
                      <span className="home-collaborators-person-copy">
                        <strong>{profile.name}</strong>
                        <span>{profile.role}</span>
                        <small>
                          {reason ??
                            "Explore their profile."}
                        </small>
                      </span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="home-collaborators-empty">
                No demo profiles are available with the current event visibility
                settings.
              </p>
            )}
          </div>
        )}

        <footer className="home-collaborators-footer">
          <button
            type="button"
            className="home-collaborators-enter"
            disabled={busy}
            onClick={onEnter}
          >
            {busy ? "Entering…" : "Enter room"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

function CollaboratorDetail({
  person,
  reason,
  onBack,
}: {
  person: Profile;
  reason: string | null;
  onBack: () => void;
}) {
  return (
    <div className="home-collaborators-content home-collaborators-detail">
      <button type="button" className="home-collaborators-back" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to people
      </button>
      <div className="home-collaborators-identity">
        <Avatar profile={person} />
        <div>
          <strong>{person.name}</strong>
          <span>{person.role}</span>
        </div>
      </div>
      {reason && <p className="home-collaborators-reason">{reason}</p>}
      {isProfileFieldVisible(person, "bio") && person.bio.trim() && (
        <DetailSection label="About">
          <p>{person.bio}</p>
        </DetailSection>
      )}
      {isProfileFieldVisible(person, "interests") &&
        person.interests.length > 0 && (
          <DetailSection label="Interests">
            <TagList items={person.interests} />
          </DetailSection>
        )}
      {isProfileFieldVisible(person, "skills") && person.skills.length > 0 && (
        <DetailSection label="Skills">
          <TagList items={person.skills} />
        </DetailSection>
      )}
      {isProfileFieldVisible(person, "lookingFor") &&
        person.lookingFor.length > 0 && (
          <DetailSection label="Looking for">
            <TagList items={person.lookingFor} />
          </DetailSection>
        )}
    </div>
  );
}

function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="home-collaborators-section">
      <h3>{label}</h3>
      {children}
    </section>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="home-collaborators-tags">
      {items.map((item) => (
        <Chip key={item}>{item}</Chip>
      ))}
    </div>
  );
}
