import type { Profile } from "./types";

export type CollaboratorReasonKind =
  | "they-offer"
  | "you-offer"
  | "shared-interest";

export interface HomeCollaborator {
  profile: Profile;
  reason: string | null;
  reasonKind: CollaboratorReasonKind | null;
  overlap: string | null;
}

type MatchField = "interests" | "skills" | "lookingFor";

export function isProfileFieldVisible(
  profile: Profile,
  field: MatchField | "bio",
) {
  return profile.visibility?.[field] !== false;
}

function normalizedIntersection(left: string[], right: string[]) {
  const rightValues = new Set(
    right.map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
  const seen = new Set<string>();

  return left.flatMap((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized) || !rightValues.has(normalized)) {
      return [];
    }
    seen.add(normalized);
    return [value.trim()];
  });
}

function firstName(profile: Profile) {
  return profile.name.trim().split(/\s+/)[0] || profile.name;
}

export function collaboratorReason(
  user: Profile,
  person: Profile,
): Omit<HomeCollaborator, "profile"> {
  if (
    isProfileFieldVisible(user, "lookingFor") &&
    isProfileFieldVisible(person, "skills")
  ) {
    const [overlap] = normalizedIntersection(user.lookingFor, person.skills);
    if (overlap) {
      return {
        reason: `${firstName(person)} can share ${overlap}, which you’re looking for.`,
        reasonKind: "they-offer",
        overlap,
      };
    }
  }

  if (
    isProfileFieldVisible(person, "lookingFor") &&
    isProfileFieldVisible(user, "skills")
  ) {
    const [overlap] = normalizedIntersection(person.lookingFor, user.skills);
    if (overlap) {
      return {
        reason: `Your ${overlap} experience could help with what ${firstName(person)} is looking for.`,
        reasonKind: "you-offer",
        overlap,
      };
    }
  }

  if (
    isProfileFieldVisible(user, "interests") &&
    isProfileFieldVisible(person, "interests")
  ) {
    const [overlap] = normalizedIntersection(user.interests, person.interests);
    if (overlap) {
      return {
        reason: `You both list ${overlap} as an interest.`,
        reasonKind: "shared-interest",
        overlap,
      };
    }
  }

  return { reason: null, reasonKind: null, overlap: null };
}

export function homeCollaborators(profiles: Profile[], user: Profile) {
  if (user.visibility?.activeInEvent === false) return [];

  return profiles
    .map((profile, index) => ({
      profile,
      index,
      ...collaboratorReason(user, profile),
    }))
    .filter(
      ({ profile }) =>
        profile.id !== user.id && profile.visibility?.activeInEvent !== false,
    )
    .sort((left, right) => {
      const leftHasOverlap = left.reason === null ? 0 : 1;
      const rightHasOverlap = right.reason === null ? 0 : 1;
      return rightHasOverlap - leftHasOverlap || left.index - right.index;
    })
    .map(({ index: _index, ...collaborator }) => collaborator);
}
