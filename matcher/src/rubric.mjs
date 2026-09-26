import { normalize } from './profiles.mjs';

export const RUBRIC_VERSION = 'experience-v1';
export const MATCH_THRESHOLD = 70;
export const NETWORKING_MAX = Object.freeze({
  skillToNeed: 30,
  networkingGoals: 25,
  projectAlignment: 15,
  mutualBenefit: 15,
  sharedInterests: 10,
  conversationPotential: 5,
});

function normalizedMap(values) {
  return new Map(values.map((value) => [normalize(value), value]));
}

function sharedValue(first, second) {
  const other = normalizedMap(second);
  return [...normalizedMap(first)]
    .filter(([key]) => other.has(key))
    .sort(([left], [right]) => left.localeCompare(right, 'en-US'))[0]?.[1] ?? null;
}

export function pairEvidence(profileA, profileB) {
  const matches = [];
  for (const skill of profileA.skills) {
    if (profileB.lookingFor.some((need) => normalize(need) === normalize(skill))) {
      matches.push({ provider: profileA.userId, seeker: profileB.userId, skill });
    }
  }
  for (const skill of profileB.skills) {
    if (profileA.lookingFor.some((need) => normalize(need) === normalize(skill))) {
      matches.push({ provider: profileB.userId, seeker: profileA.userId, skill });
    }
  }
  matches.sort((left, right) => normalize(left.skill).localeCompare(normalize(right.skill), 'en-US'));
  return {
    sharedInterest: sharedValue(profileA.interests, profileB.interests),
    sharedDomain: sharedValue(profileA.domains, profileB.domains),
    skillMatch: matches[0] ?? null,
  };
}

function strongestExperience(profileA, profileB, category) {
  let best = null;
  for (const first of profileA.experiences.filter((item) => item.category === category)) {
    for (const second of profileB.experiences.filter((item) => item.category === category)) {
      if (normalize(first.kind) !== normalize(second.kind)) continue;
      const sameLabel = normalize(first.label) === normalize(second.label);
      const sameYear = first.year !== undefined && first.year === second.year;
      const base = category === 'professional'
        ? (sameLabel ? (sameYear ? 90 : 80) : 70)
        : (sameLabel ? 45 : 20);
      const candidate = { base, first, second, sameLabel, sameYear };
      if (!best || base > best.base || (
        base === best.base && normalize(first.label) < normalize(best.first.label)
      )) best = candidate;
    }
  }
  return best;
}

function underThirtyWords(reason, alternate) {
  return reason.trim().split(/\s+/u).length <= 30 ? reason : alternate;
}

function professionalReason(match) {
  if (match.sameLabel) {
    const year = match.sameYear ? ` in ${match.first.year}` : '';
    return underThirtyWords(
      `You both attended ${match.first.label}${year}. What stayed with each of you from it?`,
      `You both attended ${match.first.kind} events. What stayed with you?`,
    );
  }
  return underThirtyWords(
    `You have both been to ${match.first.kind} events. What made one memorable for you?`,
    'You share a past event experience. What made it memorable?',
  );
}

function personalReason(match, evidence) {
  const domain = evidence.sharedDomain ? ` and work in ${evidence.sharedDomain}` : '';
  if (match.sameLabel) {
    return underThirtyWords(
      `You both mention ${match.first.label}${domain}. What made that experience memorable for you?`,
      `You both enjoy ${match.first.kind}. What experience would you recommend?`,
    );
  }
  return underThirtyWords(
    `You both enjoy ${match.first.kind}${domain}. What experience would you recommend to each other?`,
    'You share a personal interest. What would you recommend to each other?',
  );
}

export function experienceRoutes(profileA, profileB) {
  const evidence = pairEvidence(profileA, profileB);
  const professional = strongestExperience(profileA, profileB, 'professional');
  const personal = strongestExperience(profileA, profileB, 'personal');
  const professionalScore = professional
    ? Math.min(100, professional.base + (evidence.sharedInterest ? 5 : 0) + (evidence.skillMatch ? 5 : 0))
    : 0;
  const conversationPoint = personal && (
    personal.sameLabel || evidence.sharedDomain || evidence.sharedInterest || evidence.skillMatch
  ) ? 5 : 0;
  const personalScore = personal
    ? Math.min(100, personal.base + (evidence.sharedDomain ? 25 : 0)
      + (evidence.sharedInterest ? 15 : 0) + (evidence.skillMatch ? 10 : 0)
      + conversationPoint)
    : 0;
  return {
    professional: { score: professionalScore, reason: professional ? professionalReason(professional) : '' },
    personal: { score: personalScore, reason: personal ? personalReason(personal, evidence) : '' },
    evidence,
  };
}

export function chooseResult(profileA, profileB, routes, networking = { score: 0, reason: '' }) {
  const candidates = [
    { ...routes.professional, priority: 0 },
    { ...networking, priority: 1 },
    { ...routes.personal, priority: 2 },
  ];
  candidates.sort((left, right) => right.score - left.score || left.priority - right.priority);
  const winner = candidates[0];
  return {
    userA: profileA.userId,
    userB: profileB.userId,
    compatible: winner.score >= MATCH_THRESHOLD,
    score: winner.score,
    reason: winner.score >= MATCH_THRESHOLD ? winner.reason : '',
  };
}
