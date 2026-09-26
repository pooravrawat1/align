import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PairAssessment, Profile, State } from "./types";

export type CompatibilityAudience = "event" | "network";
type Entry = { assessment: PairAssessment | null; loading: boolean };
type CompatibilityStore = {
  state: State;
  user: Profile;
  read: (personId: string, eventId: string | undefined, audience: CompatibilityAudience) => Entry;
  request: (personId: string, eventId: string | undefined, audience: CompatibilityAudience, force?: boolean) => void;
};

const Context = createContext<CompatibilityStore | null>(null);
const unavailable = (message: string): PairAssessment => ({
  status: "unavailable",
  score: null,
  reason: "Compatibility is unavailable right now.",
  commonGround: [],
  contributions: [],
  starter: "",
  categories: [],
  source: "unavailable",
  error: message,
});

function isPairAssessment(value: unknown): value is PairAssessment {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PairAssessment>;
  const categoryValid = (category: PairAssessment["categories"][number]) =>
    Boolean(category && typeof category.id === "string" && typeof category.label === "string" &&
      typeof category.max === "number" && (category.points === null || typeof category.points === "number") &&
      typeof category.evidence === "string");
  const contributionValid = (entry: PairAssessment["contributions"][number]) =>
    Boolean(entry && typeof entry.userId === "string" && Array.isArray(entry.items) && entry.items.every((value) => typeof value === "string"));
  return ["ready", "partial", "unavailable"].includes(item.status ?? "") &&
    (item.score === null || typeof item.score === "number") && typeof item.reason === "string" &&
    Array.isArray(item.commonGround) && item.commonGround.every((entry) => typeof entry === "string") &&
    Array.isArray(item.contributions) && item.contributions.every(contributionValid) &&
    typeof item.starter === "string" && Array.isArray(item.categories) && item.categories.every(categoryValid) &&
    ["gemini", "fixture", "rules", "unavailable"].includes(item.source ?? "") &&
    (item.route === undefined || ["networking", "professional", "personal"].includes(item.route)) &&
    (item.compatible === undefined || typeof item.compatible === "boolean") &&
    (item.routes === undefined || (
      item.routes !== null && typeof item.routes === "object" &&
      (item.routes.networking === null || typeof item.routes.networking === "number") &&
      typeof item.routes.professional === "number" &&
      typeof item.routes.personal === "number"
    ));
}

function profileRevision(profile: Profile | undefined) {
  if (!profile) return "missing";
  return JSON.stringify({
    id: profile.id,
    name: profile.name,
    role: profile.role,
    bio: profile.bio,
    interests: profile.interests,
    skills: profile.skills,
    lookingFor: profile.lookingFor,
    goals: profile.goals ?? [],
    domains: profile.domains ?? [],
    experiences: profile.experiences ?? [],
    visibility: profile.visibility,
  });
}

export function CompatibilityProvider({ state, user, children }: { state: State; user: Profile; children: ReactNode }) {
  const entries = useRef(new Map<string, Entry>());
  const requests = useRef(new Map<string, AbortController>());
  const previousSession = useRef(state.session?.id);
  const [, redraw] = useState(0);
  const personById = useMemo(() => new Map(state.profiles.map((profile) => [profile.id, profile])), [state.profiles]);
  const keyFor = useCallback((personId: string, eventId: string | undefined, audience: CompatibilityAudience) => [
    "v1",
    state.session?.id ?? "no-session",
    audience,
    eventId ?? "no-event",
    profileRevision(user),
    profileRevision(personById.get(personId)),
  ].join("|"), [personById, state.session?.id, user]);

  const read = useCallback((personId: string, eventId: string | undefined, audience: CompatibilityAudience) =>
    entries.current.get(keyFor(personId, eventId, audience)) ?? { assessment: null, loading: false }, [keyFor]);

  const request = useCallback((personId: string, eventId: string | undefined, audience: CompatibilityAudience, force = false) => {
    const key = keyFor(personId, eventId, audience);
    const current = entries.current.get(key);
    if (!force && (current?.loading || current?.assessment)) return;
    requests.current.get(key)?.abort();
    const controller = new AbortController();
    requests.current.set(key, controller);
    entries.current.set(key, { assessment: null, loading: true });
    redraw((value) => value + 1);
    const sessionId = state.session?.id ?? null;
    void fetch("/api/compatibility", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionId ? { "x-session-id": sessionId } : {}),
      },
      body: JSON.stringify({ participantId: personId, eventId, audience, ...(force ? { retry: true } : {}) }),
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not assess this connection.");
      if (!isPairAssessment(body)) throw new Error("The compatibility response was incomplete.");
      return body as PairAssessment;
    }).then((assessment) => {
      if (requests.current.get(key) !== controller) return;
      entries.current.set(key, { assessment, loading: false });
      requests.current.delete(key);
      redraw((value) => value + 1);
    }).catch((error: unknown) => {
      if (controller.signal.aborted || requests.current.get(key) !== controller) return;
      const message = error instanceof Error ? error.message : "Could not assess this connection.";
      entries.current.set(key, { assessment: unavailable(message), loading: false });
      requests.current.delete(key);
      redraw((value) => value + 1);
    });
  }, [keyFor, state.session?.id]);

  useEffect(() => {
    if (previousSession.current === state.session?.id) return;
    previousSession.current = state.session?.id;
    entries.current.clear();
    requests.current.forEach((controller) => controller.abort());
    requests.current.clear();
    redraw((value) => value + 1);
  }, [state.session?.id]);
  useEffect(() => () => {
    requests.current.forEach((controller, key) => {
      controller.abort();
      entries.current.delete(key);
    });
    requests.current.clear();
  }, []);
  return <Context.Provider value={{ state, user, read, request }}>{children}</Context.Provider>;
}

export function useCompatibility(personId: string | undefined, eventId: string | undefined, audience: CompatibilityAudience, enabled = true) {
  const store = useContext(Context);
  if (!store) throw new Error("useCompatibility must be used inside CompatibilityProvider");
  const entry = personId ? store.read(personId, eventId, audience) : { assessment: null, loading: false };
  useEffect(() => {
    if (enabled && personId) store.request(personId, eventId, audience);
  }, [audience, enabled, eventId, personId, store]);
  const retry = useCallback(() => {
    if (personId) store.request(personId, eventId, audience, true);
  }, [audience, eventId, personId, store]);
  return { ...entry, retry };
}
