import type { Connection, Profile } from "./types";

export type AmbientPanel = "event" | "people" | "recovery" | null;
export type SaveStatus = "idle" | "saving" | "saved";
export type ReliabilityKind = "offline" | "alignment-lost";

export type RoomState =
  | { kind: "ambient"; panel: AmbientPanel; matchNotice: number | null }
  | { kind: "profile"; profileId: string }
  | {
      kind: "conversation";
      profileId: string;
      promptOpen: boolean;
      saveStatus: SaveStatus;
    }
  | { kind: ReliabilityKind; recoveryOpen: boolean }
  | { kind: "outside-boundary" }
  | { kind: "recap" };

export type RoomAction =
  | { type: "OPEN_PANEL"; panel: Exclude<AmbientPanel, null> }
  | { type: "OPEN_PROFILE"; profileId: string }
  | { type: "CLOSE_LAYER" }
  | { type: "START_CONVERSATION"; profileId: string; saved: boolean }
  | { type: "DISMISS_PROMPT" }
  | { type: "SAVE_PENDING" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_FAILED" }
  | { type: "FINISH_CONVERSATION" }
  | { type: "SHOW_MATCH_NOTICE"; count: number }
  | { type: "CLEAR_MATCH_NOTICE" }
  | { type: "SIMULATE_RELIABILITY"; kind: ReliabilityKind }
  | { type: "SIMULATE_BOUNDARY" }
  | { type: "CALIBRATION_CANCELLED" }
  | { type: "CALIBRATION_SUCCEEDED" }
  | { type: "RETURN_AMBIENT" }
  | { type: "SHOW_RECAP" };

export const initialRoomState: RoomState = {
  kind: "ambient",
  panel: null,
  matchNotice: null,
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

export function connectionIdsForEvent(
  connections: Connection[],
  userId: string,
  eventId: string | null,
) {
  if (eventId === null) return [];
  return connections
    .filter((connection) => connection.eventId === eventId)
    .filter(
      (connection) =>
        connection.userA === userId || connection.userB === userId,
    )
    .map((connection) =>
      connection.userA === userId ? connection.userB : connection.userA,
    );
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
          matchNotice: null,
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
    case "START_CONVERSATION":
      if (state.kind !== "profile") return state;
      return {
        kind: "conversation",
        profileId: action.profileId,
        promptOpen: true,
        saveStatus: action.saved ? "saved" : "idle",
      };
    case "DISMISS_PROMPT":
      return state.kind === "conversation"
        ? { ...state, promptOpen: false }
        : state;
    case "SAVE_PENDING":
      return state.kind === "conversation"
        ? { ...state, saveStatus: "saving" }
        : state;
    case "SAVE_SUCCESS":
      return state.kind === "conversation"
        ? { ...state, saveStatus: "saved" }
        : state;
    case "SAVE_FAILED":
      return state.kind === "conversation"
        ? { ...state, saveStatus: "idle" }
        : state;
    case "FINISH_CONVERSATION":
      return state.kind === "conversation" ? initialRoomState : state;
    case "SHOW_MATCH_NOTICE":
      return state.kind === "ambient"
        ? { ...state, matchNotice: action.count }
        : state;
    case "CLEAR_MATCH_NOTICE":
      return state.kind === "ambient"
        ? { ...state, matchNotice: null }
        : state;
    case "SIMULATE_RELIABILITY":
      return { kind: action.kind, recoveryOpen: true };
    case "SIMULATE_BOUNDARY":
      return { kind: "outside-boundary" };
    case "CALIBRATION_CANCELLED":
      return state;
    case "CALIBRATION_SUCCEEDED":
    case "RETURN_AMBIENT":
      return initialRoomState;
    case "SHOW_RECAP":
      return state.kind === "conversation" || state.kind === "profile"
        ? state
        : { kind: "recap" };
  }
}
