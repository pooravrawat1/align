import { useEffect, useMemo, useRef, useState } from "react";
import type { Action, Profile, State } from "./types";
import { useCompatibility } from "./CompatibilityContext";
import { networkPerson, ownedConnection } from "./networkModel";
import { NetworkProfile } from "./NetworkProfile";
import { activeEvent } from "./eventModel";
import { consumeProfileTrigger } from "./PeopleDirectory";
import { requestFor } from "./connectionRequests";

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
  const request = selection.personId ? requestFor(state, user.id, selection.personId) : undefined;
  const { assessment, loading, retry } = useCompatibility(visibleInContext ? original?.id : undefined, resolvedEventId, isNetworkRoute ? "network" : "event", visibleInContext);
  const person = useMemo(() => {
    if (!original || !visibleInContext) return undefined;
    const eventPerson = networkPerson(state, user, original, assessment ?? undefined, audience);
    if (audience !== "event" || request?.status !== "accepted" || !connection) return eventPerson;
    const savedPerson = networkPerson(state, user, original, assessment ?? undefined, "network");
    if (savedPerson.withdrawn) return eventPerson;
    return { ...eventPerson, profile: { ...eventPerson.profile, contact: savedPerson.profile.contact }, contacts: savedPerson.contacts };
  }, [assessment, audience, connection, original, request?.status, state, user, visibleInContext]);
  const requestEligible = Boolean(resolvedEventId && event?.participantIds?.includes(user.id) && original && event.participantIds.includes(original.id) && original.visibility?.activeInEvent !== false && request?.status !== "accepted" && request?.status !== "pending");

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
        notify("Profile removed from your saved people.");
        close();
      } else {
        await act("connections", { participantId: person.profile.id, eventId: resolvedEventId });
        notify("Person saved to your network.");
      }
    } catch { /* App presents service errors. */ }
  }

  async function createRequest() {
    if (!person || !resolvedEventId || busy) return;
    try {
      await act("connection-requests", { participantId: person.profile.id, eventId: resolvedEventId });
      notify("Connection request sent.");
    } catch { /* App presents service errors. */ }
  }

  async function respondToRequest(action: "accept" | "decline" | "cancel") {
    if (!request || busy) return;
    try {
      await act(`connection-requests/${request.id}`, { action }, "PATCH");
      notify(action === "accept" ? "Connection accepted." : action === "decline" ? "Request declined." : "Request cancelled.");
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
      <NetworkProfile key={`${user.id}:${person.profile.id}`} person={person} user={user} state={state} act={act} busy={busy} notify={notify} onClose={close} onSave={() => void savePerson()} request={request} requestEligible={requestEligible} onRequest={() => void createRequest()} onRespond={(action) => void respondToRequest(action)} assessmentLoading={loading} onRetryAssessment={retry} />
    </dialog>
  );
}
