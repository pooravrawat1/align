import { useEffect, useMemo, useRef, useState } from "react";
import type { Action, Profile, State } from "./types";
import { useCompatibility } from "./CompatibilityContext";
import { networkPerson, ownedConnection } from "./networkModel";
import { NetworkProfile } from "./NetworkProfile";
import { activeEvent } from "./eventModel";
import { consumeProfileTrigger } from "./PeopleDirectory";

type Props = {
  state: State;
  user: Profile;
  act: Action;
  busy: boolean;
  notify: (message: string) => void;
  eventId?: string;
};

function routeSelection() {
  const query = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const audience = query.get("audience");
  return { personId: query.get("person"), eventId: query.get("event") ?? undefined, audience: audience === "network" ? "network" as const : audience === "event" ? "event" as const : undefined };
}

function closeProfileRoute() {
  const [path, raw = ""] = location.hash.split("?");
  const query = new URLSearchParams(raw);
  query.delete("person");
  query.delete("audience");
  history.replaceState(history.state, "", `${path}${query.size ? `?${query}` : ""}`);
  dispatchEvent(new HashChangeEvent("hashchange"));
}

export function PersonProfileDialog({ state, user, act, busy, notify, eventId: suppliedEventId }: Props) {
  const [selection, setSelection] = useState(routeSelection);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => setSelection(routeSelection());
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  const original = state.profiles.find((profile) => profile.id === selection.personId);
  const audience = selection.audience ?? (location.hash.startsWith("#/network") ? "network" : "event");
  const connection = selection.personId ? ownedConnection(state, user.id, selection.personId) : undefined;
  const resolvedEventId = suppliedEventId ?? selection.eventId ?? (audience === "event" ? activeEvent(state)?.id : connection?.eventId);
  const isNetworkRoute = audience === "network";
  const event = resolvedEventId ? state.events.find((candidate) => candidate.id === resolvedEventId) : undefined;
  const visibleInContext = Boolean(original && (isNetworkRoute
    ? connection
    : event?.participantIds?.includes(user.id) && event.participantIds.includes(original.id) && original.visibility?.activeInEvent !== false));
  const { assessment } = useCompatibility(visibleInContext ? original?.id : undefined, resolvedEventId, isNetworkRoute ? "network" : "event", visibleInContext);
  const person = useMemo(() => {
    if (!original || !visibleInContext) return undefined;
    const eventPerson = networkPerson(state, user, original, assessment ?? undefined, audience);
    if (audience !== "event" || !connection) return eventPerson;
    const savedPerson = networkPerson(state, user, original, assessment ?? undefined, "network");
    if (savedPerson.withdrawn) return eventPerson;
    return { ...eventPerson, profile: { ...eventPerson.profile, contact: savedPerson.profile.contact }, contacts: savedPerson.contacts };
  }, [assessment, audience, connection, original, state, user, visibleInContext]);

  const close = () => {
    if (history.state?.catalystProfile) history.back();
    else closeProfileRoute();
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!selection.personId) requestAnimationFrame(() => triggerRef.current?.focus());
  }, [selection.personId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !person) return;
    triggerRef.current = consumeProfileTrigger() ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const overflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => dialog.querySelector<HTMLElement>("[data-profile-focus]")?.focus());
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [person?.profile.id]);

  async function savePerson() {
    if (!person || busy) return;
    try {
      if (person.connection && person.connection.saved !== false) {
        await act(`connections/${person.profile.id}`, undefined, "DELETE");
        notify("Removed from your people.");
        close();
      } else {
        await act("connections", { participantId: person.profile.id, eventId: resolvedEventId });
        notify("Added to your people.");
      }
    } catch { /* App presents service errors. */ }
  }

  if (!selection.personId) return null;
  if (!person) return (
    <div className="nx-profile-unavailable" role="status">
      <p>This profile is no longer available in this context.</p>
      <button type="button" onClick={close}>Go back</button>
    </div>
  );
  return (
    <dialog ref={dialogRef} className="nx-profile-layer nx-profile-expanded" aria-label={`${person.profile.name} — full profile`} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <NetworkProfile key={`${user.id}:${person.profile.id}`} person={person} state={state} act={act} busy={busy} notify={notify} onClose={close} onSave={() => void savePerson()} />
    </dialog>
  );
}
