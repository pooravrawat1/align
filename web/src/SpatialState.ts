import type { Profile } from "./types";

// The illustrative photo has a fixed cast. Other attendees remain in People;
// an absent or private profile must never donate its photographed head to someone else.
export const spatialSceneHeads: Record<string, { x: number; y: number }> = {
  jordan: { x: 24.5, y: 38 },
  leo: { x: 47.5, y: 52.4 },
  maya: { x: 74.7, y: 44.4 },
};

export function selectSpatialCards(profiles: Profile[]) {
  return Object.keys(spatialSceneHeads).flatMap(id => {
    const profile = profiles.find(person => person.id === id);
    return profile ? [profile] : [];
  });
}

export type AmbientPanel = "people" | "recovery" | null;
export type ReliabilityKind = "offline" | "alignment-lost";

export type RoomState =
  | { kind: "ambient"; panel: AmbientPanel }
  | { kind: "profile"; profileId: string }
  | { kind: "conversation"; profileId: string }
  | { kind: ReliabilityKind; recoveryOpen: boolean }
  | { kind: "outside-boundary" };

export type RoomAction =
  | { type: "OPEN_PANEL"; panel: Exclude<AmbientPanel, null> }
  | { type: "OPEN_PROFILE"; profileId: string }
  | { type: "START_CONVERSATION" }
  | { type: "FINISH_CONVERSATION" }
  | { type: "CLOSE_LAYER" }
  | { type: "SIMULATE_RELIABILITY"; kind: ReliabilityKind }
  | { type: "SIMULATE_BOUNDARY" }
  | { type: "RESTORE_PREVIEW" }
  | { type: "RETURN_AMBIENT" };

export const initialRoomState: RoomState = {
  kind: "ambient",
  panel: null,
};

export function createReplayableRequest<T>() {
  let pending: Promise<T> | null = null;
  return {
    acquire(start: () => Promise<T>) {
      if (pending === null) {
        const request = start();
        pending = request;
        void request.then(
          () => {
            if (pending === request) pending = null;
          },
          () => {
            if (pending === request) pending = null;
          },
        );
      }
      return pending;
    },
  };
}

export function selectActiveRemoteProfiles(
  profiles: Profile[],
  user: Profile,
) {
  const seenIds = new Set<string>();
  return profiles
    .filter((profile) => profile.id !== user.id)
    .filter((profile) => profile.visibility?.activeInEvent !== false)
    .filter((profile) => {
      if (seenIds.has(profile.id)) return false;
      seenIds.add(profile.id);
      return true;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function roomReducer(
  state: RoomState,
  action: RoomAction,
): RoomState {
  switch (action.type) {
    case "OPEN_PANEL":
      if (state.kind === "ambient") {
        return {
          kind: "ambient",
          panel: state.panel === action.panel ? null : action.panel,
        };
      }
      if (state.kind === "offline" || state.kind === "alignment-lost") {
        return { ...state, recoveryOpen: true };
      }
      return state;
    case "OPEN_PROFILE":
      return state.kind === "ambient"
        ? { kind: "profile", profileId: action.profileId }
        : state;
    case "START_CONVERSATION":
      return state.kind === "profile" && spatialSceneHeads[state.profileId] ? { kind: "conversation", profileId: state.profileId } : state;
    case "FINISH_CONVERSATION":
      return state.kind === "conversation" ? { kind: "profile", profileId: state.profileId } : state;
    case "CLOSE_LAYER":
      if (state.kind === "conversation") return { kind: "profile", profileId: state.profileId };
      if (state.kind === "profile" || state.kind === "ambient") {
        return initialRoomState;
      }
      if (state.kind === "offline" || state.kind === "alignment-lost") {
        return { ...state, recoveryOpen: false };
      }
      return state;
    case "SIMULATE_RELIABILITY":
      return { kind: action.kind, recoveryOpen: false };
    case "SIMULATE_BOUNDARY":
      return { kind: "outside-boundary" };
    case "RESTORE_PREVIEW":
    case "RETURN_AMBIENT":
      return initialRoomState;
  }
}
