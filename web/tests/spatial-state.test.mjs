import assert from "node:assert/strict";
import test from "node:test";

import {
  connectionIdsForEvent,
  createReplayableRequest,
  initialRoomState,
  roomReducer,
  selectActiveRemoteProfiles,
} from "../src/SpatialState.ts";

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

test("cancelling recalibration preserves hidden-card reliability states", () => {
  for (const kind of ["offline", "alignment-lost"]) {
    const interrupted = roomReducer(initialRoomState, {
      type: "SIMULATE_RELIABILITY",
      kind,
    });
    const cancelled = roomReducer(interrupted, {
      type: "CALIBRATION_CANCELLED",
    });

    assert.deepEqual(cancelled, interrupted);
    assert.equal(cancelled.kind, kind);
  }
});

test("successful calibration is the transition that restores ambient cards", () => {
  const interrupted = roomReducer(initialRoomState, {
    type: "SIMULATE_RELIABILITY",
    kind: "alignment-lost",
  });

  assert.deepEqual(
    roomReducer(interrupted, { type: "CALIBRATION_SUCCEEDED" }),
    initialRoomState,
  );
});

test("failed conversation save becomes idle and can be retried", () => {
  const profile = roomReducer(initialRoomState, {
    type: "OPEN_PROFILE",
    profileId: "maya",
  });
  const conversation = roomReducer(profile, {
    type: "START_CONVERSATION",
    profileId: "maya",
    saved: false,
  });
  const saving = roomReducer(conversation, { type: "SAVE_PENDING" });
  const failed = roomReducer(saving, { type: "SAVE_FAILED" });
  const retrying = roomReducer(failed, { type: "SAVE_PENDING" });

  assert.equal(failed.kind, "conversation");
  assert.equal(failed.saveStatus, "idle");
  assert.equal(retrying.kind, "conversation");
  assert.equal(retrying.saveStatus, "saving");
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

test("recap connection selection is scoped to the current event and user", () => {
  const connections = [
    { userA: "alex", userB: "maya", eventId: "demo" },
    { userA: "alex", userB: "sam", eventId: "spatial" },
    { userA: "maya", userB: "sam", eventId: "demo" },
  ];

  assert.deepEqual(connectionIdsForEvent(connections, "alex", "demo"), [
    "maya",
  ]);
  assert.deepEqual(connectionIdsForEvent(connections, "alex", null), []);
});
