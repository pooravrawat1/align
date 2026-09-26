import seed from "../shared/demo-data.json" with { type: "json" };
import type { Connection, Profile, State } from "./types.ts";
import { contactHref, sharedContactLinks } from "./contactDestinations.ts";

export interface NetworkPerson {
  profile: Profile;
  connection?: Connection;
  project?: { title: string; description: string; topics: string[] };
  goals: string[];
  sharedInterests: string[];
  theyOffer: string[];
  youOffer: string[];
  reason: string;
  compatibility: {
    status: "ready" | "partial" | "unavailable";
    score: number | null;
    categories: { id: string; label: string; max: number; points: number | null; evidence: string }[];
    summary: string;
    suggestion: string;
    starter: string;
  };
  contacts: { kind: "linkedin" | "github" | "website" | "email"; label: string; href: string }[];
  sample: boolean;
  withdrawn: boolean;
}

const supplements: Record<string, { title: string; description?: string; goals: string[] }> = {
  alex: { title: "Navigation that opens up the world", goals: ["Find a project collaborator", "Exchange technical expertise"] },
  maya: { title: "Visual assistance, beyond the screen", description: "Testing how everyday objects can offer clearer, more natural guidance.", goals: ["Find a project collaborator", "Test an early idea"] },
  jordan: { title: "Making spatial interactions feel natural", goals: ["Prototype with other builders", "Exchange technical expertise"] },
  sam: { title: "A better space for creative collaboration", goals: ["Find a project collaborator", "Learn from other disciplines"] },
  nina: { title: "Small tools, closer communities", goals: ["Prototype with other builders", "Find a project collaborator"] },
  leo: { title: "Robots that navigate alongside us", goals: ["Exchange technical expertise", "Test an early idea"] },
};

const rubric = [
  ["skills", "Reciprocal skill fit", 30],
  ["goals", "Networking goals", 25],
  ["project", "Project synergy", 15],
  ["value", "Mutual value", 15],
  ["interests", "Shared interests", 10],
  ["conversation", "Conversation potential", 5],
] as const;

// Authored examples for the UI, independent of the service's simpler match score.
const samplePoints: Record<string, number[]> = {
  "alex:maya": [28, 23, 14, 14, 8, 5],
  "alex:leo": [28, 20, 13, 13, 10, 5],
  "alex:jordan": [22, 20, 10, 12, 6, 5],
  "alex:nina": [12, 20, 9, 10, 6, 4],
  "alex:sam": [8, 19, 7, 8, 0, 3],
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("en-US");
export function intersection(left: string[], right: string[]) {
  const other = new Set(right.map(normalize));
  const seen = new Set<string>();
  return left.filter(value => {
    const key = normalize(value);
    if (!key || seen.has(key) || !other.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ownedConnection(state: State, userId: string, personId: string) {
  return state.connections.find(connection =>
    (connection.ownerId ?? connection.userA) === userId &&
    (connection.participantId ?? (connection.userA === userId ? connection.userB : connection.userA)) === personId,
  );
}

function unchangedSample(profile: Profile) {
  const original = seed.profiles.find(candidate => candidate.id === profile.id);
  return !!original && ["bio", "interests", "skills", "lookingFor"].every(field =>
    JSON.stringify(profile[field as keyof Profile]) === JSON.stringify(original[field as keyof typeof original]),
  );
}

function visible(profile: Profile, field: "bio" | "interests" | "skills" | "lookingFor") {
  return profile.visibility?.[field] !== false;
}

export function networkPerson(state: State, user: Profile, original: Profile): NetworkPerson {
  const connection = ownedConnection(state, user.id, original.id);
  const withdrawn = connection ? original.visibility?.previousConnections === false : original.visibility?.activeInEvent === false;
  const allowed = (field: "bio" | "interests" | "skills" | "lookingFor") => !withdrawn && visible(original, field);
  const profile: Profile = {
    ...original,
    bio: allowed("bio") ? original.bio : "",
    interests: allowed("interests") ? original.interests : [],
    skills: allowed("skills") ? original.skills : [],
    lookingFor: allowed("lookingFor") ? original.lookingFor : [],
    contact: !withdrawn && !!connection && original.visibility?.contact === true ? original.contact : "",
    linkedin: "", website: "", email: "",
  };
  const sharedInterests = intersection(visible(user, "interests") ? user.interests : [], profile.interests);
  const theyOffer = intersection(profile.skills, visible(user, "lookingFor") ? user.lookingFor : []);
  const youOffer = intersection(visible(user, "skills") ? user.skills : [], profile.lookingFor);
  const firstName = profile.name.trim().split(/\s+/u)[0];
  const reason = withdrawn ? "This person is no longer sharing their profile here."
    : theyOffer.length ? `${firstName} brings ${theyOffer[0].toLowerCase()}, which you’re looking for.`
    : youOffer.length ? `Your ${youOffer[0].toLowerCase()} experience could help with what ${firstName} is building.`
    : sharedInterests.length ? `You both care about ${sharedInterests[0].toLowerCase()}.`
    : "A different perspective. Explore what they’re working on.";
  const supplement = unchangedSample(original) && allowed("bio") ? supplements[original.id] : undefined;
  const goals = supplement && allowed("lookingFor") ? supplement.goals : [];
  const allVisible = !withdrawn && ["bio", "interests", "skills", "lookingFor"].every(field =>
    visible(original, field as "bio") && visible(user, field as "bio"),
  );
  const key = [user.id, profile.id].sort().join(":");
  const points = allVisible && unchangedSample(user) && unchangedSample(original) ? samplePoints[key] : undefined;
  const evidence = [
    [theyOffer.length ? `${firstName} offers ${theyOffer.join(", ")}.` : "No direct skill-to-need overlap from them is listed.", youOffer.length ? `You offer ${youOffer.join(", ")}.` : "No direct skill-to-need overlap from you is listed."].join(" "),
    goals.length ? `Their goals: ${goals.join("; ").toLowerCase()}.` : "Networking goals have not been shared.",
    supplement && visible(user, "bio") && user.bio ? `Compare your work: “${user.bio}” Their work: “${profile.bio}”` : "More project detail is needed to explain this category.",
    theyOffer.length && youOffer.length ? `You could exchange ${youOffer[0].toLowerCase()} and ${theyOffer[0].toLowerCase()} expertise.` : sharedInterests.length ? `An exchange of perspectives on ${sharedInterests[0].toLowerCase()}; a concrete two-way outcome is still to explore.` : "A concrete benefit for each person is still to explore.",
    sharedInterests.length ? `You both list ${sharedInterests.join(", ")}.` : "No shared interests are listed.",
    theyOffer.length ? `Ask how they approach ${theyOffer[0].toLowerCase()}.` : sharedInterests.length ? `Compare what you’re exploring in ${sharedInterests[0].toLowerCase()}.` : "Start with what each of you is working on.",
  ];
  const categories = rubric.map(([id, label, max], index) => ({ id, label, max, points: points?.[index] ?? null, evidence: evidence[index] }));
  const starter = sharedInterests.length
    ? `Hi ${firstName}—I'd love to compare notes on ${sharedInterests.slice(0, 2).join(" and ")}.`
    : `Hi ${firstName}—I'd love to keep in touch.`;
  const contacts: NetworkPerson["contacts"] = connection && !withdrawn ? sharedContactLinks(original) : [];
  const withGithub = original as Profile & { github?: string; visibility?: Profile["visibility"] & { github?: boolean } };
  if (connection && !withdrawn && withGithub.visibility?.github === true) {
    const href = contactHref("website", withGithub.github);
    if (href && (new URL(href).hostname === "github.com" || new URL(href).hostname.endsWith(".github.com"))) contacts.push({ kind: "github", label: "GitHub", href });
  }
  return {
    profile, connection, withdrawn, goals, sharedInterests, theyOffer, youOffer, reason, contacts,
    project: supplement ? { title: supplement.title, description: supplement.description ?? profile.bio, topics: profile.interests.slice(0, 3) } : undefined,
    sample: !!supplement || !!points,
    compatibility: {
      status: withdrawn ? "unavailable" : points ? "ready" : "partial",
      score: points ? points.reduce((sum, value) => sum + value, 0) : null,
      categories,
      summary: withdrawn ? "Profile information is private." : reason,
      suggestion: withdrawn ? "" : theyOffer.length && youOffer.length
        ? `Explore a small prototype together: combine your ${youOffer[0].toLowerCase()} experience with their ${theyOffer[0].toLowerCase()} skills.`
        : sharedInterests.length ? `Bring one open question about ${sharedInterests[0].toLowerCase()} and compare approaches.` : "Share what you’re building and find one question you could explore together.",
      starter,
    },
  };
}
