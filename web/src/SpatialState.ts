import type { Profile } from "./types";

export function selectSpatialCards(profiles: Profile[]) {
  // A match changes the label's material, never which photographed person owns it.
  const sceneIds = ["jordan", "leo", "maya"];
  const rank = (id: string) => sceneIds.includes(id) ? sceneIds.indexOf(id) : sceneIds.length;
  return [...profiles].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id)).slice(0, 3);
}

export type AmbientPanel = "people" | "recovery" | null;
export type ReliabilityKind = "offline" | "alignment-lost";

export type RoomState =
  | { kind: "ambient"; panel: AmbientPanel }
  | { kind: "profile"; profileId: string }
  | { kind: ReliabilityKind; recoveryOpen: boolean }
  | { kind: "outside-boundary" };

export type RoomAction =
  | { type: "OPEN_PANEL"; panel: Exclude<AmbientPanel, null> }
  | { type: "OPEN_PROFILE"; profileId: string }
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
    case "CLOSE_LAYER":
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
