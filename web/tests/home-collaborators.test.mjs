import test from "node:test";
import assert from "node:assert/strict";
import {
  collaboratorReason,
  homeCollaborators,
} from "../src/collaboratorSuggestions.ts";

function profile(id, overrides = {}) {
  return {
    id,
    name: `${id} Person`,
    role: "Builder",
    bio: "A demo profile",
    interests: [],
    skills: [],
    lookingFor: [],
    avatar: "",
    location: "Atlanta, GA",
    distance: 0,
    ...overrides,
  };
}

test("excludes the user and profiles that are not active in the event", () => {
  const user = profile("user");
  const active = profile("active");
  const inactive = profile("inactive", { visibility: { activeInEvent: false } });

  assert.deepEqual(
    homeCollaborators([user, inactive, active], user).map(
      ({ profile }) => profile.id,
    ),
    ["active"],
  );
  assert.deepEqual(
    homeCollaborators([active], {
      ...user,
      visibility: { activeInEvent: false },
    }),
    [],
  );
});

test("hidden fields on either profile cannot produce a match reason", () => {
  const user = profile("user", { lookingFor: ["Robotics"] });
  const person = profile("person", {
    skills: ["Robotics"],
    visibility: { skills: false },
  });
  assert.equal(collaboratorReason(user, person).reason, null);

  const privateAsk = {
    ...user,
    visibility: { lookingFor: false },
  };
  assert.equal(
    collaboratorReason(privateAsk, { ...person, visibility: undefined }).reason,
    null,
  );
});

test("matches trim whitespace and normalize case", () => {
  const user = profile("user", { lookingFor: ["  Computer Vision "] });
  const person = profile("maya", {
    name: "Maya Chen",
    skills: ["computer vision"],
  });
  const result = collaboratorReason(user, person);

  assert.equal(result.reasonKind, "they-offer");
  assert.equal(result.overlap, "Computer Vision");
  assert.match(result.reason, /Computer Vision/);
});

test("keeps no-overlap participants and ranks real overlap first stably", () => {
  const user = profile("user", { interests: ["Open Source"] });
  const firstNoOverlap = profile("first");
  const firstOverlap = profile("second", { interests: ["open source"] });
  const secondOverlap = profile("third", { interests: ["OPEN SOURCE"] });
  const secondNoOverlap = profile("fourth");
  const results = homeCollaborators(
    [firstNoOverlap, firstOverlap, secondOverlap, secondNoOverlap],
    user,
  );

  assert.deepEqual(results.map(({ profile }) => profile.id), [
    "second",
    "third",
    "first",
    "fourth",
  ]);
  assert.equal(results[2].reason, null);
  assert.equal(results[3].reason, null);
});

test("undefined field visibility defaults to visible for reverse and shared overlap", () => {
  const user = profile("user", {
    skills: ["Electronics"],
    interests: ["Robotics"],
  });
  const reverse = profile("reverse", { lookingFor: ["electronics"] });
  const shared = profile("shared", { interests: ["robotics"] });

  assert.equal(collaboratorReason(user, reverse).reasonKind, "you-offer");
  assert.equal(collaboratorReason(user, shared).reasonKind, "shared-interest");
});
