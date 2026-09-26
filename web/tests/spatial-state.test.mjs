import assert from "node:assert/strict";
import test from "node:test";

import {
  createReplayableRequest,
  initialRoomState,
  roomReducer,
  selectActiveRemoteProfiles,
  selectSpatialCards,
} from "../src/SpatialState.ts";

test("spatial identities stay attached to their scene positions as the roster grows", () => {
  const profiles = ['maya', 'alex', 'jordan', 'leo', 'amina', 'elena'].map(id => ({ id }));
  assert.deepEqual(selectSpatialCards(profiles).map(p => p.id), ['jordan', 'leo', 'maya']);
  assert.deepEqual(selectSpatialCards(profiles.slice().reverse()).map(p => p.id), ['jordan', 'leo', 'maya']);
  assert.deepEqual(selectSpatialCards([{ id: 'custom' }]), []);
  assert.deepEqual(selectSpatialCards(profiles.filter(p => p.id !== 'jordan')).map(p => p.id), ['leo', 'maya']);
  assert.deepEqual(selectSpatialCards([{ id: 'maya' }]).map(p => p.id), ['maya']);
  assert.deepEqual(selectSpatialCards([]), []);
  assert.deepEqual(profiles.map(p => p.id), ['maya', 'alex', 'jordan', 'leo', 'amina', 'elena']);
});

test("effect replay reuses one pending request and can start again after settlement", async () => {
  const requests = createReplayableRequest();
  let starts = 0;
  let settle;
  const start = () => {
    starts += 1;
    return new Promise((resolve) => {
      settle = resolve;
    });
  };

  const firstSetup = requests.acquire(start);
  const replaySetup = requests.acquire(start);
  assert.equal(firstSetup, replaySetup);
  assert.equal(starts, 1);

  settle("matched");
  await replaySetup;
  await Promise.resolve();

  const nextEntry = requests.acquire(() => {
    starts += 1;
    return Promise.resolve("matched again");
  });
  assert.notEqual(nextEntry, firstSetup);
  assert.equal(starts, 2);
});

test("closing recovery does not reveal cards or admit a profile while interrupted", () => {
  for (const kind of ["offline", "alignment-lost"]) {
    const interrupted = roomReducer(initialRoomState, { type: "SIMULATE_RELIABILITY", kind });
    assert.equal(roomReducer(interrupted, { type: "OPEN_PROFILE", profileId: "maya" }), interrupted);
    const opened = roomReducer(interrupted, { type: "OPEN_PANEL", panel: "recovery" });
    assert.equal(opened.recoveryOpen, true);
    const closed = roomReducer(opened, { type: "CLOSE_LAYER" });
    assert.equal(closed.kind, kind);
    assert.equal(closed.recoveryOpen, false);
    assert.deepEqual(roomReducer(closed, { type: "RESTORE_PREVIEW" }), initialRoomState);
  }
});

test("people list opens a profile, and closing returns to the room", () => {
  const people = roomReducer(initialRoomState, { type: "OPEN_PANEL", panel: "people" });
  const profile = roomReducer(people, { type: "OPEN_PROFILE", profileId: "maya" });
  assert.deepEqual(profile, { kind: "profile", profileId: "maya" });
  assert.deepEqual(roomReducer(profile, { type: "CLOSE_LAYER" }), initialRoomState);
});

test("participant selection uses profile IDs, not names, as identity", () => {
  const user = { id: "jordan", name: "Maya Chen" };
  const profiles = [
    user,
    { id: "maya", name: "Maya Chen" },
    {
      id: "nina",
      name: "Nina Patel",
      visibility: { activeInEvent: false },
    },
    { id: "sam", name: "Sam Rivera" },
    { id: "sam", name: "Sam Rivera duplicate record" },
  ];

  assert.deepEqual(
    selectActiveRemoteProfiles(profiles, user).map((profile) => profile.id),
    ["maya", "sam"],
  );
});


test("conversation starts only from a selected profile and finishes back at that same profile", () => {
  assert.equal(roomReducer(initialRoomState, { type: "START_CONVERSATION" }), initialRoomState);
  const unpicturedProfile = { kind: "profile", profileId: "sam" };
  assert.equal(roomReducer(unpicturedProfile, { type: "START_CONVERSATION" }), unpicturedProfile);
  const profile = { kind: "profile", profileId: "maya" };
  const conversation = roomReducer(profile, { type: "START_CONVERSATION" });
  assert.deepEqual(conversation, { kind: "conversation", profileId: "maya" });
  assert.deepEqual(roomReducer(conversation, { type: "FINISH_CONVERSATION" }), profile);
  assert.deepEqual(roomReducer(conversation, { type: "CLOSE_LAYER" }), profile);
  assert.deepEqual(roomReducer(conversation, { type: "SIMULATE_RELIABILITY", kind: "offline" }), { kind: "offline", recoveryOpen: false });
});
