import type { Connection, PairAssessment, Profile, State } from "./types.ts";
import { contactHref, sharedContactLinks } from "./contactDestinations.ts";
import matchingPolicy from "../../assets/matching-policy.json" with { type: "json" };

export const MATCH_THRESHOLD = matchingPolicy.matchThreshold;

export function assessmentRoute(assessment: PairAssessment | null | undefined): PairAssessment["route"] {
  return assessment?.route;
}

export function assessmentScore(assessment: PairAssessment | null | undefined) {
  return assessment?.status === "ready" ? assessment.score : null;
}

export function assessmentMatchLabel(assessment: PairAssessment | null | undefined) {
  const score = assessmentScore(assessment);
  if (score === null) return "Fit not assessed";
  if (score >= MATCH_THRESHOLD) return "Strong match";
  return score === 0 ? "Different focus" : "Limited match";
}

export function assessmentRouteLabel(route: PairAssessment["route"]) {
  if (route === "networking") return "Networking fit";
  if (route === "professional") return "Professional experience";
  if (route === "personal") return "Personal experience";
  return "Compatibility";
}

export function assessmentSourceLabel(assessment: PairAssessment) {
  if (assessment.source === "gemini") return "AI networking assessment";
  if (assessment.source === "fixture") return "Prepared example";
  if (assessment.source === "rules") {
    const route = assessmentRoute(assessment);
    return route === "professional" || route === "personal"
      ? "Shared-experience match"
      : "Profile-based match";
  }
  return "Assessment unavailable";
}

export interface NetworkPerson {
  profile: Profile;
  connection?: Connection;
  goals: string[];
  sharedInterests: string[];
  theyOffer: string[];
  youOffer: string[];
  topics: string[];
  reason: string;
  compatibility: PairAssessment;
  contacts: { kind: "linkedin" | "github" | "website" | "email"; label: string; href: string }[];
  withdrawn: boolean;
}

const fallbackAssessment = (reason: string, withdrawn: boolean): PairAssessment => ({
  status: "unavailable",
  score: null,
  reason: withdrawn ? "Profile information is private." : reason,
  commonGround: [],
  contributions: [],
  starter: "",
  categories: [],
  source: "unavailable",
  error: withdrawn ? "This person is no longer sharing their profile." : undefined,
});

const normalize = (value: string) => value.trim().toLocaleLowerCase("en-US");

export function intersection(left: string[], right: string[]) {
  const other = new Set(right.map(normalize));
  const seen = new Set<string>();
  return left.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key) || !other.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ownedConnection(state: State, userId: string, personId: string) {
  return state.connections.find((connection) =>
    (connection.ownerId ?? connection.userA) === userId &&
    (connection.participantId ?? (connection.userA === userId ? connection.userB : connection.userA)) === personId,
  );
}

export function recommendationRank(person: Pick<NetworkPerson, "theyOffer" | "youOffer" | "sharedInterests">) {
  const reciprocal = person.theyOffer.length > 0 && person.youOffer.length > 0 ? 100 : 0;
  return reciprocal + (person.theyOffer.length + person.youOffer.length) * 10 + person.sharedInterests.length * 3;
}

type SharedField = "bio" | "interests" | "skills" | "lookingFor" | "goals" | "domains" | "experiences";

function visible(profile: Profile, field: SharedField) {
  return profile.visibility?.[field] !== false;
}

function unique(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalize(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function networkPerson(state: State, user: Profile, original: Profile, assessment?: PairAssessment, audience: "event" | "network" = "network"): NetworkPerson {
  const connection = ownedConnection(state, user.id, original.id);
  const withdrawn = audience === "network"
    ? !connection || original.visibility?.previousConnections === false
    : original.visibility?.activeInEvent === false;
  const allowed = (field: SharedField) => !withdrawn && visible(original, field);
  const profile: Profile = {
    ...original,
    bio: allowed("bio") ? original.bio : "",
    interests: allowed("interests") ? original.interests : [],
    skills: allowed("skills") ? original.skills : [],
    lookingFor: allowed("lookingFor") ? original.lookingFor : [],
    goals: allowed("goals") ? original.goals : [],
    domains: allowed("domains") ? original.domains : [],
    experiences: allowed("experiences") ? original.experiences : [],
    contact: audience === "network" && !withdrawn && !!connection ? original.contact : "",
    linkedin: "",
    website: "",
    email: "",
  };
  const sharedInterests = intersection(visible(user, "interests") ? user.interests : [], profile.interests);
  const theyOffer = intersection(profile.skills, visible(user, "lookingFor") ? user.lookingFor : []);
  const youOffer = intersection(visible(user, "skills") ? user.skills : [], profile.lookingFor);
  const firstName = profile.name.trim().split(/\s+/u)[0] || profile.name;
  const reason = withdrawn
    ? "This person is no longer sharing their profile here."
    : theyOffer.length
      ? `${firstName} brings ${theyOffer[0].toLowerCase()}, which you’re looking for.`
      : youOffer.length
        ? `Your ${youOffer[0].toLowerCase()} experience could help with what ${firstName} is building.`
        : sharedInterests.length
          ? `You both care about ${sharedInterests[0].toLowerCase()}.`
          : "Open their profile to find a useful starting point.";
  const contacts: NetworkPerson["contacts"] = audience === "network" && connection && !withdrawn ? sharedContactLinks(original) : [];
  const withGithub = original as Profile & { github?: string; visibility?: Profile["visibility"] & { github?: boolean } };
  if (audience === "network" && connection && !withdrawn && withGithub.visibility?.github === true) {
    const href = contactHref("website", withGithub.github);
    if (href && (new URL(href).hostname === "github.com" || new URL(href).hostname.endsWith(".github.com"))) {
      contacts.push({ kind: "github", label: "GitHub", href });
    }
  }
  const compatibility = withdrawn ? fallbackAssessment(reason, true) : assessment ?? fallbackAssessment(reason, false);
  return {
    profile,
    connection,
    withdrawn,
    goals: profile.goals ?? [],
    sharedInterests,
    theyOffer,
    youOffer,
    topics: unique([...sharedInterests, ...theyOffer, ...youOffer, ...profile.interests]).slice(0, 3),
    reason: compatibility.status === "ready" || compatibility.status === "partial" ? compatibility.reason : reason,
    compatibility,
    contacts,
  };
}
