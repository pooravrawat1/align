import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { ASSESSMENT_VERSION, assessmentFingerprint, createAssessmentService } from './assessment.mjs';
import { createConnectionRequestStore } from './connection-requests.mjs';
import { createFollowUpService } from './follow-up.mjs';
import { followUpContext } from './follow-up-context.mjs';
import { MATCH_THRESHOLD, experienceRoutes } from '../../matcher/src/rubric.mjs';
import { matchingProfile } from './assessment.mjs';
import { validateProfile as validateMatchProfile } from '../../matcher/src/profiles.mjs';
import { getActiveStore } from './store.mjs';
import { buildGraph } from './graph.mjs';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4311;
const MAX_BODY_BYTES = 16 * 1024;
const profileContract = JSON.parse(
  readFileSync(new URL('../shared/profile-contract.json', import.meta.url), 'utf8'),
);
const {
  stringLimits: STRING_LIMITS,
  topicLimit: ARRAY_LIMIT,
  topicItemLimit: ARRAY_ITEM_LIMIT,
  photo: PHOTO_CONTRACT,
  defaultVisibility: DEFAULT_VISIBILITY,
} = profileContract;
const MAX_PROFILE_BODY_BYTES = MAX_BODY_BYTES + Math.ceil(PHOTO_CONTRACT.maxBytes / 3) * 4;
const PROFILE_FIELDS = new Set([
  'name',
  'role',
  'bio',
  'interests',
  'skills',
  'lookingFor',
  'goals',
  'domains',
  'experiences',
  'location',
  'contact',
  'linkedin',
  'website',
  'email',
  'avatar',
  'visibility',
]);
const FOLLOW_UP_VALUES = new Set(['needed', 'contacted', 'none']);
const GOAL_LIMIT = 3;
const VISIBILITY_FIELDS = new Set(Object.keys(DEFAULT_VISIBILITY));

function seed() {
  return getActiveStore().snapshot();
}
function knownRoomCodes() {
  return new Set(seed().events.map((event) => event.code.toUpperCase()));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalPair(firstId, secondId) {
  return [firstId, secondId].sort((left, right) => left.localeCompare(right));
}

function pairKey(firstId, secondId) {
  return canonicalPair(firstId, secondId).join(':');
}

function connectionKey(ownerId, participantId) {
  return `${ownerId}:${participantId}`;
}

function withProfileDefaults(profile) {
  return {
    ...profile,
    goals: profile.goals ?? [],
    domains: profile.domains ?? [],
    experiences: profile.experiences ?? [],
    contact: profile.contact ?? '',
    linkedin: profile.linkedin ?? '',
    website: profile.website ?? '',
    email: profile.email ?? '',
    visibility: {
      ...DEFAULT_VISIBILITY,
      ...(profile.visibility ?? {}),
    },
  };
}

function withConnectionDefaults(connection) {
  const [userA, userB] = canonicalPair(connection.userA, connection.userB);
  const ownerId = connection.ownerId ?? connection.userA;
  const participantId = connection.participantId ?? (
    ownerId === userA ? userB : userA
  );
  return {
    ...connection,
    userA,
    userB,
    ownerId,
    participantId,
    notes: connection.notes ?? '',
    followUp: connection.followUp ?? 'needed',
    reminderDate: connection.reminderDate ?? '',
    saved: connection.saved ?? true,
  };
}

function cloneSeedData() {
  const data = seed();
  data.profiles = data.profiles.map(withProfileDefaults);
  data.connections = (data.connections ?? []).map(withConnectionDefaults);
  return data;
}

function cloneSeedState() {
  const data = cloneSeedData();
  const connections = new Map();

  for (const connection of data.connections) {
    connections.set(
      connectionKey(connection.ownerId, connection.participantId),
      connection,
    );
  }

  return {
    profiles: data.profiles,
    events: data.events,
    connections,
    customRoomCodes: new Set(),
    matches: [],
    matchFingerprints: new Map(),
  };
}

function publicBootstrap() {
  const data = cloneSeedData();
  return {
    profiles: data.profiles,
    events: data.events,
    connections: data.connections,
    matches: [],
    connectionRequests: [],
    session: null,
    demo: true,
  };
}

function sessionBootstrap(state) {
  if (state.session.activeEventId === undefined) {
    state.session.activeEventId = state.session.code === null ? null : connectionEventId(state);
  }
  const requests = state.requestStore?.involving(state.session.userId) ?? [];
  const accepted = requests.filter((request) => request.status === 'accepted');
  const ownConnections = [...state.connections.values()].filter((connection) => connection.ownerId === state.session.userId);
  const connectionByParticipant = new Map(ownConnections.map((connection) => [connection.participantId, connection]));
  for (const request of accepted) {
    const participantId = request.senderId === state.session.userId ? request.recipientId : request.senderId;
    if (connectionByParticipant.has(participantId)) continue;
    const [userA, userB] = canonicalPair(state.session.userId, participantId);
    connectionByParticipant.set(participantId, {
      userA, userB, ownerId: state.session.userId, participantId, eventId: request.eventId,
      requestId: request.id, saved: false, createdAt: request.updatedAt, notes: '', followUp: 'needed', reminderDate: '',
    });
  }
  const profiles = state.profiles.map((profile) => {
    const current = state.requestStore?.profile(profile.id) ?? profile;
    if (profile.id === state.session.userId) return clone(current);
    const sharesEvent = state.events.some((event) => event.participantIds?.includes(state.session.userId)
      && event.participantIds.includes(profile.id));
    const networkAllowed = connectionByParticipant.has(profile.id)
      && current.visibility?.previousConnections !== false;
    const audience = networkAllowed ? 'network' : sharesEvent ? 'event' : 'network';
    return projectRequestPeer(current, audience);
  });
  const ownProfile = profiles.find((profile) => profile.id === state.session.userId);
  const ownIndex = state.profiles.findIndex((profile) => profile.id === state.session.userId);
  if (ownProfile && ownIndex >= 0) state.profiles[ownIndex] = clone(ownProfile);
  const matches = state.matches.filter((match) => {
    const recorded = state.matchFingerprints?.get(pairKey(match.userA, match.userB));
    if (!recorded) return false;
    const first = state.requestStore?.profile(match.userA)
      ?? state.profiles.find((profile) => profile.id === match.userA);
    const second = state.requestStore?.profile(match.userB)
      ?? state.profiles.find((profile) => profile.id === match.userB);
    return Boolean(first && second)
      && recorded.fingerprint === assessmentFingerprint(first, second, recorded.context);
  });
  state.matches = matches;
  return {
    profiles,
    events: clone(state.events),
    connections: clone([...connectionByParticipant.values()]),
    matches: clone(matches),
    connectionRequests: requests,
    session: clone(state.session),
    demo: true,
  };
}

function projectRequestPeer(profile, audience) {
  const visibility = profile.visibility ?? DEFAULT_VISIBILITY;
  const allowed = audience === 'network' ? visibility.previousConnections !== false : visibility.activeInEvent !== false;
  const visible = (field) => allowed && visibility[field] !== false;
  return {
    ...clone(profile),
    bio: visible('bio') ? profile.bio : '',
    interests: visible('interests') ? profile.interests : [],
    skills: visible('skills') ? profile.skills : [],
    lookingFor: visible('lookingFor') ? profile.lookingFor : [],
    goals: visible('goals') ? (profile.goals ?? []) : [],
    domains: visible('domains') ? (profile.domains ?? []) : [],
    experiences: visible('experiences') ? (profile.experiences ?? []) : [],
    contact: audience === 'network' && visible('contact') ? profile.contact : '',
    linkedin: audience === 'network' && visible('linkedin') ? profile.linkedin : '',
    website: audience === 'network' && visible('website') ? profile.website : '',
    email: audience === 'network' && visible('email') ? profile.email : '',
  };
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'access-control-allow-headers': 'content-type, x-session-id',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-origin': '*',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(body);
}

function sendEmpty(response, status) {
  response.writeHead(status, {
    'access-control-allow-headers': 'content-type, x-session-id',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-origin': '*',
  });
  response.end();
}

function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readJson(request, { maxBytes = MAX_BODY_BYTES, largeField } = {}) {
  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      throw apiError(413, maxBytes === MAX_BODY_BYTES
        ? 'Request body exceeds 16KB'
        : 'Request body exceeds the profile upload limit');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('JSON body must be an object');
    }
    if (size > MAX_BODY_BYTES && largeField !== undefined && !(largeField in value)) {
      throw apiError(413, 'Request body exceeds 16KB');
    }
    return value;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      throw apiError(400, 'Invalid JSON body');
    }
    throw error;
  }
}

function requireSession(request, sessions) {
  const sessionId = request.headers['x-session-id'];
  if (typeof sessionId !== 'string' || !sessions.has(sessionId)) {
    throw apiError(401, 'Valid x-session-id header required');
  }
  return sessions.get(sessionId);
}

function validateString(field, value, limit, { nonBlank = false, trimmed = false } = {}) {
  if (typeof value !== 'string') {
    throw apiError(400, `${field} must be a string`);
  }
  if ((trimmed ? value.trim() : value).length > limit) {
    throw apiError(400, `${field} must be ${limit} characters or fewer`);
  }
  if (nonBlank && value.trim().length === 0) {
    throw apiError(400, `${field} must not be blank`);
  }
}

function validateStringArray(field, value) {
  if (!Array.isArray(value) || value.length > ARRAY_LIMIT) {
    throw apiError(400, `${field} must contain at most ${ARRAY_LIMIT} strings`);
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0 || item.length > ARRAY_ITEM_LIMIT) {
      throw apiError(400, `${field} entries must be non-blank strings of ${ARRAY_ITEM_LIMIT} characters or fewer`);
    }
  }
}

function validateContactUrl(field, value, { linkedin = false } = {}) {
  const normalized = value.trim();
  if (normalized === '') return;
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw apiError(400, `${field} must not contain control characters`);
  }

  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw apiError(400, `${field} must be an empty string or a valid http(s) URL`);
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw apiError(400, `${field} must be an http(s) URL without credentials`);
  }
  if (linkedin && url.hostname !== 'linkedin.com' && !url.hostname.endsWith('.linkedin.com')) {
    throw apiError(400, 'linkedin must use linkedin.com or one of its subdomains');
  }
}

function validateEmail(value) {
  const normalized = value.trim();
  if (normalized === '') return;
  if (
    /[\u0000-\u001f\u007f]/u.test(normalized) ||
    !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/u.test(normalized)
  ) {
    throw apiError(400, 'email must be empty or a single valid email address');
  }
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegDimensions(bytes) {
  if (
    bytes.length < 12 ||
    bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9
  ) {
    return null;
  }

  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8) return null;
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    if (marker === 0xda) return null;
    offset += segmentLength;
  }
  return null;
}

function validateAvatar(value) {
  if (typeof value !== 'string') {
    throw apiError(400, 'avatar must be a string');
  }
  if (value === '') return;

  const prefix = `data:${PHOTO_CONTRACT.mimeType};base64,`;
  if (!value.startsWith(prefix)) {
    throw apiError(400, `avatar must be empty or a ${PHOTO_CONTRACT.mimeType} data URL`);
  }
  const encoded = value.slice(prefix.length);
  if (
    encoded.length === 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)
  ) {
    throw apiError(400, 'avatar must contain valid base64');
  }

  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > PHOTO_CONTRACT.maxBytes) {
    throw apiError(400, `avatar must be ${PHOTO_CONTRACT.maxBytes} bytes or fewer`);
  }
  const dimensions = jpegDimensions(bytes);
  if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
    throw apiError(400, 'avatar must contain a valid JPEG header');
  }
  if (dimensions.width > PHOTO_CONTRACT.size || dimensions.height > PHOTO_CONTRACT.size) {
    throw apiError(400, `avatar dimensions must be ${PHOTO_CONTRACT.size} by ${PHOTO_CONTRACT.size} pixels or smaller`);
  }
}

function validateProfilePatch(body) {
  for (const field of Object.keys(body)) {
    if (!PROFILE_FIELDS.has(field)) {
      throw apiError(400, `Unknown profile field: ${field}`);
    }
  }

  for (const [field, limit] of Object.entries(STRING_LIMITS)) {
    if (field in body) {
      validateString(field, body[field], limit, {
        nonBlank: field === 'name',
        trimmed: field === 'linkedin' || field === 'website' || field === 'email',
      });
    }
  }

  for (const field of ['interests', 'skills', 'lookingFor', 'domains']) {
    if (field in body) validateStringArray(field, body[field]);
  }
  if ('goals' in body) {
    validateStringArray('goals', body.goals);
    if (body.goals.length > GOAL_LIMIT) throw apiError(400, `goals must contain at most ${GOAL_LIMIT} strings`);
  }

  if ('experiences' in body) {
    try {
      validateMatchProfile({ userId: 'validation', name: 'Validation', bio: '', interests: [], skills: [], lookingFor: [], networkingGoal: '', domains: [], experiences: body.experiences });
    } catch (error) { throw apiError(400, error.message); }
  }

  if ('linkedin' in body) validateContactUrl('linkedin', body.linkedin, { linkedin: true });
  if ('website' in body) validateContactUrl('website', body.website);
  if ('email' in body) validateEmail(body.email);
  if ('avatar' in body) validateAvatar(body.avatar);

  if ('visibility' in body) {
    if (!body.visibility || typeof body.visibility !== 'object' || Array.isArray(body.visibility)) {
      throw apiError(400, 'visibility must be an object');
    }
    for (const [field, value] of Object.entries(body.visibility)) {
      if (!VISIBILITY_FIELDS.has(field)) {
        throw apiError(400, `Unknown visibility field: ${field}`);
      }
      if (typeof value !== 'boolean') {
        throw apiError(400, `visibility.${field} must be a boolean`);
      }
    }
  }
}

function normalizedSet(values) {
  return new Map(
    values.map((value) => [value.trim().toLocaleLowerCase('en-US'), value.trim()]),
  );
}

function compactLabel(value, maxWords = 8) {
  return value.trim().split(/\s+/u).slice(0, maxWords).join(' ');
}
function firstName(profile) { return compactLabel(profile.name, 1); }

function visibleProfileValues(profile, field) {
  return profile.visibility[field] ? profile[field] : [];
}

function sharedInterestsForProfiles(firstProfile, secondProfile) {
  if (!firstProfile.visibility.activeInEvent || !secondProfile.visibility.activeInEvent) return [];
  const firstInterests = normalizedSet(visibleProfileValues(firstProfile, 'interests'));
  const secondInterests = normalizedSet(visibleProfileValues(secondProfile, 'interests'));
  return [...firstInterests]
    .filter(([key]) => secondInterests.has(key))
    .map(([, value]) => value)
    .sort((left, right) => left.localeCompare(right, 'en-US', { sensitivity: 'base' }));
}

async function calculateMatches(state, demoMode, assessmentService, requestStore) {
  const latestProfile = (profile) => requestStore.profile(profile.id) ?? profile;
  const current = latestProfile(state.profiles.find((profile) => profile.id === state.session.userId));
  const matches = new Map();
  const event = eventForId(state, connectionEventId(state));
  const participants = (demoMode
    ? state.profiles
    : state.profiles.filter((profile) => event?.participantIds?.includes(profile.id)))
    .map(latestProfile);
  const contexts = new Map(participants
    .filter((participant) => participant.id !== current.id)
    .map((participant) => [participant.id, {
      audience: 'event', eventId: event?.id, ...(demoMode ? { fixture: true } : {}),
    }]));
  const inputFingerprints = new Map([...contexts].map(([participantId, context]) => {
    const participant = participants.find((candidate) => candidate.id === participantId);
    return [participantId, assessmentFingerprint(current, participant, context)];
  }));

  if (demoMode) {
    for (const participant of participants) {
      if (participant.id === current.id) continue;
      const assessment = await assessmentService.assess(current, participant, contexts.get(participant.id));
      const [userA, userB] = canonicalPair(current.id, participant.id);
      const match = { userA, userB, compatible: assessment.status === 'ready' && assessment.score >= MATCH_THRESHOLD, score: assessment.score === null ? null : assessment.score / 100, reason: assessment.score >= MATCH_THRESHOLD ? assessment.reason : '', source: assessment.source };
      matches.set(pairKey(match.userA, match.userB), match);
    }
  } else {
    const overlapRank = (participant) => {
      if (!current.visibility.activeInEvent || !participant.visibility.activeInEvent) return 0;
      const count = (left, right) => {
        const rightValues = normalizedSet(right);
        return [...normalizedSet(left).keys()].filter((key) => rightValues.has(key)).length;
      };
      const first = matchingProfile(current, 'event');
      const second = matchingProfile(participant, 'event');
      const routes = experienceRoutes(first, second);
      return Math.max(routes.professional.score, routes.personal.score) * 10
        + count(visibleProfileValues(current, 'skills'), visibleProfileValues(participant, 'lookingFor')) * 100
        + count(visibleProfileValues(participant, 'skills'), visibleProfileValues(current, 'lookingFor')) * 100
        + count(visibleProfileValues(current, 'interests'), visibleProfileValues(participant, 'interests')) * 10
        + count(visibleProfileValues(current, 'goals'), visibleProfileValues(participant, 'goals')) * 5;
    };
    const candidates = participants.filter((participant) => participant.id !== current.id)
      .map((participant) => ({ participant, rank: overlapRank(participant) }))
      .filter((candidate) => candidate.rank > 0)
      .sort((left, right) => right.rank - left.rank || left.participant.id.localeCompare(right.participant.id))
      .slice(0, 3);
    const assessed = await Promise.all(candidates.map(async ({ participant }) => ({
      participant,
      assessment: await assessmentService.assess(current, participant, contexts.get(participant.id)),
    })));
    const byId = new Map(assessed.map((entry) => [entry.participant.id, entry.assessment]));
    for (const participant of participants) {
      if (participant.id === current.id) continue;
      const [userA, userB] = canonicalPair(current.id, participant.id);
      const assessment = byId.get(participant.id);
      const match = assessment ? {
        userA, userB, compatible: assessment.status === 'ready' && assessment.score >= MATCH_THRESHOLD,
        score: assessment.score === null ? null : assessment.score / 100,
        reason: assessment.score >= MATCH_THRESHOLD ? assessment.reason : '', source: assessment.source,
      } : { userA, userB, compatible: false, score: null, reason: '', source: 'unavailable' };
      matches.set(pairKey(match.userA, match.userB), match);
    }
  }

  const latestCurrent = requestStore.profile(current.id) ?? current;
  for (const participant of participants) {
    if (participant.id === current.id) continue;
    const latestParticipant = requestStore.profile(participant.id) ?? participant;
    if (inputFingerprints.get(participant.id)
      !== assessmentFingerprint(latestCurrent, latestParticipant, contexts.get(participant.id))) {
      throw apiError(409, 'Profiles changed while compatibility was being generated');
    }
  }
  return {
    matches: [...matches.values()].sort(
    (left, right) => (right.score ?? -1) - (left.score ?? -1) || pairKey(left.userA, left.userB).localeCompare(pairKey(right.userA, right.userB)),
    ),
    fingerprints: new Map([...inputFingerprints].map(([participantId, fingerprint]) => [
      pairKey(current.id, participantId),
      { fingerprint, context: contexts.get(participantId) },
    ])),
  };
}

async function persistAssessment(store, userA, userB, assessment, context) {
  try {
    const [firstId, secondId] = canonicalPair(userA, userB);
    await store.saveAssessment({
      pairKey: `${firstId}:${secondId}`,
      userA: firstId,
      userB: secondId,
      score: assessment.score,
      route: assessment.route ?? null,
      reason: assessment.reason ?? '',
      source: assessment.source,
      audience: context.audience,
      eventId: context.eventId ?? null,
      fingerprint: assessment.fingerprint,
      version: ASSESSMENT_VERSION,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Persistence is a best-effort cache. Never block the request on it.
    console.warn('Failed to persist assessment:', error?.message ?? error);
  }
}

function eventForId(state, eventId) {
  return state.events.find((event) => event.id === eventId);
}

function eventForCode(state, code) {
  return state.events.find((event) => event.code.toUpperCase() === code.toUpperCase());
}

function requireRosterPair(state, eventId, participantId) {
  const event = eventForId(state, eventId);
  if (!event) throw apiError(404, 'Event not found');
  const roster = event.participantIds ?? [];
  if (!roster.includes(state.session.userId) || !roster.includes(participantId)) {
    throw apiError(403, 'Both people must belong to this event');
  }
  return event;
}

function validateBoolean(body, field) {
  if (field in body && typeof body[field] !== 'boolean') {
    throw apiError(400, `${field} must be a boolean`);
  }
}

function requireJoinedRoom(state) {
  if (state.session.code === null) {
    throw apiError(409, 'Join a room before continuing');
  }
}

function connectionEventId(state) {
  if (state.session.code === null) return state.session.activeEventId ?? 'demo';
  const event = state.events.find(
    (candidate) => candidate.code.toUpperCase() === state.session.code,
  );
  return event?.id ?? state.session.code;
}

function validateReminderDate(value) {
  if (value === '') return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw apiError(400, 'reminderDate must be empty or a valid YYYY-MM-DD date');
  }
  const [year, month, day] = value.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    throw apiError(400, 'reminderDate must be empty or a valid YYYY-MM-DD date');
  }
}

function validateConnectionPatch(body) {
  for (const field of Object.keys(body)) {
    if (!['notes', 'followUp', 'reminderDate'].includes(field)) {
      throw apiError(400, `Unknown connection field: ${field}`);
    }
  }
  if ('notes' in body) validateString('notes', body.notes, 2000);
  if ('followUp' in body && !FOLLOW_UP_VALUES.has(body.followUp)) {
    throw apiError(400, 'followUp must be needed, contacted, or none');
  }
  if ('reminderDate' in body) validateReminderDate(body.reminderDate);
}

function connectionMatchContext(state, userA, userB) {
  const currentMatch = state.matches.find(
    (match) => match.userA === userA && match.userB === userB,
  );
  const profileA = state.profiles.find((profile) => profile.id === userA);
  const profileB = state.profiles.find((profile) => profile.id === userB);
  const sharedInterests = sharedInterestsForProfiles(profileA, profileB);
  const reason = currentMatch?.reason ?? (
    sharedInterests.length > 0
      ? `${firstName(profileA)} and ${firstName(profileB)} share an interest in ${compactLabel(sharedInterests[0])}.`
      : ''
  );
  return { reason, sharedInterests };
}

function acceptedRequestFor(requestStore, firstId, secondId) {
  return requestStore.involving(firstId).find((request) =>
    request.status === 'accepted' &&
    ((request.senderId === firstId && request.recipientId === secondId) || (request.senderId === secondId && request.recipientId === firstId)),
  );
}

function compatibilityProfiles(state, requestStore, participantId, audience) {
  const localCurrent = state.profiles.find((profile) => profile.id === state.session.userId);
  const current = requestStore.profile(state.session.userId) ?? localCurrent;
  const storedParticipant = requestStore.profile(participantId)
    ?? state.profiles.find((profile) => profile.id === participantId);
  if (!current || !storedParticipant) return { current, participant: null };
  return {
    current,
    participant: projectRequestPeer(storedParticipant, audience),
  };
}

function materializeAcceptedConnection(state, requestStore, participantId) {
  const request = acceptedRequestFor(requestStore, state.session.userId, participantId);
  if (!request) return null;
  const [userA, userB] = canonicalPair(state.session.userId, participantId);
  const connection = {
    userA, userB, ownerId: state.session.userId, participantId, eventId: request.eventId,
    requestId: request.id, saved: false, createdAt: request.updatedAt, notes: '', followUp: 'needed', reminderDate: '',
  };
  state.connections.set(connectionKey(state.session.userId, participantId), connection);
  return connection;
}

async function handleRequest(request, response, sessions, assessmentService, requestStore, followUpService) {
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${DEFAULT_PORT}`}`);

  if (request.method === 'OPTIONS') {
    sendEmpty(response, 204);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true, demo: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/graph') {
    const store = getActiveStore();
    const eventId = url.searchParams.get('eventId') ?? null;
    const hubsParam = url.searchParams.get('hubs');
    const allowedHubs = new Set(['interest', 'skill', 'event']);
    const hubs = hubsParam
      ? hubsParam.split(',').map((value) => value.trim()).filter((value) => allowedHubs.has(value))
      : [...allowedHubs];
    const graph = await buildGraph(store, {
      eventId,
      hubs,
      viewerId: request.headers['x-session-id']
        ? sessions.get(request.headers['x-session-id'])?.session?.userId ?? null
        : null,
    });
    sendJson(response, 200, graph);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/people/')) {
    const store = getActiveStore();
    const id = decodeURIComponent(url.pathname.slice('/api/people/'.length));
    if (!id) throw apiError(400, 'person id required');
    const profile = await store.findPerson(id);
    if (!profile) throw apiError(404, 'Person not found');
    sendJson(response, 200, withProfileDefaults(projectRequestPeer(withProfileDefaults(profile), 'network')));
    return;
  }

  if (request.method === 'POST' && (url.pathname === '/api/follow-up-demo' || url.pathname === '/api/follow-up')) {
    const body = await readJson(request);
    const state = url.pathname === '/api/follow-up' ? requireSession(request, sessions) : null;
    const context = () => followUpContext(body, state ? sessionBootstrap(state) : null);
    const input = context();
    const result = await followUpService.generate(input);
    if (state && (!sessions.has(state.session.id) || JSON.stringify(context()) !== JSON.stringify(input))) throw apiError(409, 'Connection details changed. Generate again with the updated profile.');
    sendJson(response, 200, result);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/bootstrap') {
    const sessionId = request.headers['x-session-id'];
    if (sessionId === undefined) {
      sendJson(response, 200, publicBootstrap());
      return;
    }
    const state = requireSession(request, sessions);
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/login') {
    const body = await readJson(request);
    const profileId = body.profileId ?? 'alex';
    if (typeof profileId !== 'string') throw apiError(400, 'profileId must be a string');
    if ('name' in body) validateString('name', body.name, STRING_LIMITS.name, { nonBlank: true });
    for (const field of Object.keys(body)) {
      if (field !== 'name' && field !== 'profileId') {
        throw apiError(400, `Unknown login field: ${field}`);
      }
    }

    const state = cloneSeedState();
    state.requestStore = requestStore;
    let profile = state.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) throw apiError(404, 'Profile not found');
    const storedProfile = requestStore.profile(profileId);
    if (storedProfile) {
      profile = withProfileDefaults(storedProfile);
      const index = state.profiles.findIndex((candidate) => candidate.id === profileId);
      state.profiles[index] = profile;
    }
    if ('name' in body) profile.name = body.name.trim();
    requestStore.rememberProfile(profile, { overwrite: 'name' in body });

    const sessionId = randomUUID();
    state.session = {
      id: sessionId,
      code: null,
      activeEventId: null,
      userId: profile.id,
      calibrated: false,
    };
    sessions.set(sessionId, state);
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  const state = requireSession(request, sessions);

  if (request.method === 'PATCH' && url.pathname === '/api/profile') {
    const body = await readJson(request, {
      maxBytes: MAX_PROFILE_BODY_BYTES,
      largeField: 'avatar',
    });
    validateProfilePatch(body);
    const profileIndex = state.profiles.findIndex((candidate) => candidate.id === state.session.userId);
    const profile = withProfileDefaults(
      requestStore.profile(state.session.userId) ?? state.profiles[profileIndex],
    );
    state.profiles[profileIndex] = profile;
    const avatarOnly = Object.keys(body).length === 1 && 'avatar' in body;
    for (const field of PROFILE_FIELDS) {
      if (!(field in body)) continue;
      if (field === 'visibility') {
        profile.visibility = { ...profile.visibility, ...body.visibility };
      } else if (Array.isArray(body[field])) {
        profile[field] = [...body[field]];
      } else if (field === 'contact' || field === 'avatar') {
        profile[field] = body[field];
      } else {
        profile[field] = body[field].trim();
      }
    }
    if (!avatarOnly) {
      state.matches = [];
      state.matchFingerprints.clear();
    }
    requestStore.rememberProfile(profile);
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/room') {
    const body = await readJson(request);
    validateBoolean(body, 'create');
    if (typeof body.code !== 'string' || !/^[a-z0-9]{3,8}$/iu.test(body.code)) {
      throw apiError(400, 'code must be 3-8 alphanumeric characters');
    }
    for (const field of Object.keys(body)) {
      if (field !== 'code' && field !== 'create') throw apiError(400, `Unknown room field: ${field}`);
    }
    const code = body.code.toUpperCase();
    const rooms = knownRoomCodes();
    if (!rooms.has(code) && !state.customRoomCodes.has(code) && body.create !== true) {
      throw apiError(404, 'Room not found');
    }
    if (!rooms.has(code) && !state.customRoomCodes.has(code) && body.create === true) {
      state.customRoomCodes.add(code);
      state.events.push({
        id: code,
        code,
        name: `Room ${code}`,
        description: 'A local demo room for trying an introduction.',
        location: 'Local preview',
        date: 'Demo session',
        time: 'No scheduled time',
        status: 'Open room',
        participantIds: state.profiles.map((profile) => profile.id),
      });
    }
    if (state.session.code !== code) {
      state.matches = [];
      state.matchFingerprints.clear();
    }
    state.session.code = code;
    const joinedEvent = eventForCode(state, code);
    state.session.activeEventId = joinedEvent?.id ?? code;
    if (joinedEvent && !joinedEvent.participantIds?.includes(state.session.userId)) {
      joinedEvent.participantIds = [...(joinedEvent.participantIds ?? []), state.session.userId];
    }
    state.session.calibrated = false;
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/calibrate') {
    const body = await readJson(request);
    if (Object.keys(body).length > 0) throw apiError(400, 'Calibration body must be empty');
    requireJoinedRoom(state);
    state.session.calibrated = true;
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/leave') {
    const body = await readJson(request);
    if (Object.keys(body).length > 0) throw apiError(400, 'Leave body must be empty');
    state.matches = [];
    state.matchFingerprints.clear();
    state.session.code = null;
    state.session.calibrated = false;
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/matches') {
    const body = await readJson(request);
    validateBoolean(body, 'force');
    validateBoolean(body, 'demo');
    for (const field of Object.keys(body)) {
      if (field !== 'force' && field !== 'demo') throw apiError(400, `Unknown matches field: ${field}`);
    }
    requireJoinedRoom(state);
    const demoMode = body.demo === true;
    const sessionId = state.session.id;
    const roomContext = JSON.stringify({
      code: state.session.code,
      activeEventId: state.session.activeEventId ?? null,
    });
    const calculated = await calculateMatches(state, demoMode, assessmentService, requestStore);
    if (sessions.get(sessionId) !== state || roomContext !== JSON.stringify({
      code: state.session.code,
      activeEventId: state.session.activeEventId ?? null,
    })) {
      throw apiError(409, 'Event changed while compatibility was being generated');
    }
    state.matches = clone(calculated.matches);
    state.matchFingerprints = calculated.fingerprints;
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/compatibility') {
    const body = await readJson(request);
    for (const field of Object.keys(body)) {
      if (!['participantId', 'eventId', 'audience', 'retry'].includes(field)) throw apiError(400, `Unknown compatibility field: ${field}`);
    }
    validateBoolean(body, 'retry');
    if (typeof body.participantId !== 'string') throw apiError(400, 'participantId must be a string');
    if (body.participantId === state.session.userId) throw apiError(400, 'Cannot assess a profile against itself');
    if (body.audience !== 'event' && body.audience !== 'network') throw apiError(400, 'audience must be event or network');
    let { current, participant } = compatibilityProfiles(state, requestStore, body.participantId, body.audience);
    if (!participant) throw apiError(404, 'Participant not found');
    let eventId = null;
    if (body.audience === 'event') {
      eventId = body.eventId ?? (state.session.code === null ? null : connectionEventId(state));
      if (typeof eventId !== 'string') throw apiError(400, 'eventId is required for event compatibility');
      requireRosterPair(state, eventId, participant.id);
    } else {
      const connected = state.connections.has(connectionKey(state.session.userId, participant.id))
        || Boolean(acceptedRequestFor(requestStore, state.session.userId, participant.id));
      if (!connected) throw apiError(403, 'Save this person or connect before requesting network compatibility');
      if (participant.visibility.previousConnections === false) throw apiError(403, 'This profile is not shared with saved connections');
    }
    const context = { audience: body.audience, eventId, retry: body.retry === true };
    const before = assessmentFingerprint(current, participant, context);
    const assessment = await assessmentService.assess(current, participant, context);
    ({ current, participant } = compatibilityProfiles(state, requestStore, body.participantId, body.audience));
    if (!current || !participant || before !== assessmentFingerprint(current, participant, context)) {
      throw apiError(409, 'Profiles changed while compatibility was being generated');
    }
    if (assessment.status === 'ready') {
      await persistAssessment(getActiveStore(), current.id, participant.id, assessment, context);
    }
    sendJson(response, 200, assessment);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/connection-requests') {
    const body = await readJson(request);
    for (const field of Object.keys(body)) {
      if (field !== 'participantId' && field !== 'eventId') throw apiError(400, `Unknown connection request field: ${field}`);
    }
    if (typeof body.participantId !== 'string') throw apiError(400, 'participantId must be a string');
    if (body.participantId === state.session.userId) throw apiError(400, 'Cannot request a connection with yourself');
    if (typeof body.eventId !== 'string') throw apiError(400, 'eventId must be a string');
    requireRosterPair(state, body.eventId, body.participantId);
    const sender = requestStore.profile(state.session.userId) ?? state.profiles.find((profile) => profile.id === state.session.userId);
    const recipient = requestStore.profile(body.participantId) ?? state.profiles.find((profile) => profile.id === body.participantId);
    if (!sender || !recipient) throw apiError(404, 'Participant not found');
    if (sender.visibility?.activeInEvent === false || recipient.visibility?.activeInEvent === false) {
      throw apiError(403, 'Both people must be sharing their profile in this event');
    }
    requestStore.send({ senderId: state.session.userId, recipientId: body.participantId, eventId: body.eventId });
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'PATCH' && url.pathname.startsWith('/api/connection-requests/')) {
    const body = await readJson(request);
    if (Object.keys(body).some((field) => field !== 'action')) throw apiError(400, 'Unknown connection request field');
    if (!['accept', 'decline', 'cancel'].includes(body.action)) throw apiError(400, 'action must be accept, decline, or cancel');
    const id = decodeURIComponent(url.pathname.slice('/api/connection-requests/'.length));
    if (!id || id.includes('/')) throw apiError(400, 'Connection request id is required');
    const result = requestStore.update(id, state.session.userId, body.action);
    if (result.error === 'not-found') throw apiError(404, 'Connection request not found');
    if (result.error === 'forbidden') throw apiError(403, 'Only the appropriate participant can perform this action');
    if (result.error === 'settled') throw apiError(409, 'Connection request is already settled');
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/connections') {
    const body = await readJson(request);
    if (Object.keys(body).some((field) => field !== 'participantId' && field !== 'eventId')) {
      throw apiError(400, 'Unknown connections field');
    }
    if (typeof body.participantId !== 'string') {
      throw apiError(400, 'participantId must be a string');
    }
    if (body.participantId === state.session.userId) {
      throw apiError(400, 'Cannot connect a profile to itself');
    }
    if (!state.profiles.some((profile) => profile.id === body.participantId)) {
      throw apiError(404, 'Participant not found');
    }
    const eventId = body.eventId ?? connectionEventId(state);
    if (typeof eventId !== 'string') throw apiError(400, 'eventId must be a string');
    requireRosterPair(state, eventId, body.participantId);
    const [userA, userB] = canonicalPair(state.session.userId, body.participantId);
    const key = connectionKey(state.session.userId, body.participantId);
    if (!state.connections.has(key)) {
      const matchContext = connectionMatchContext(state, userA, userB);
      state.connections.set(key, {
        userA,
        userB,
        ownerId: state.session.userId,
        participantId: body.participantId,
        eventId,
        createdAt: new Date().toISOString(),
        notes: '',
        followUp: 'needed',
        reminderDate: '',
        saved: true,
        requestId: acceptedRequestFor(requestStore, state.session.userId, body.participantId)?.id,
        ...matchContext,
      });
    } else if (state.connections.get(key).saved === false) {
      state.connections.set(key, { ...state.connections.get(key), saved: true });
    }
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'PATCH' && url.pathname.startsWith('/api/connections/')) {
    const body = await readJson(request);
    validateConnectionPatch(body);
    const participantId = decodeURIComponent(url.pathname.slice('/api/connections/'.length));
    if (!participantId || participantId.includes('/')) {
      throw apiError(400, 'participantId is required');
    }
    const key = connectionKey(state.session.userId, participantId);
    const connection = state.connections.get(key) ?? materializeAcceptedConnection(state, requestStore, participantId);
    if (!connection) throw apiError(404, 'Saved connection not found');
    state.connections.set(key, { ...connection, ...body });
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'DELETE' && url.pathname.startsWith('/api/connections/')) {
    await readJson(request);
    const participantId = decodeURIComponent(url.pathname.slice('/api/connections/'.length));
    if (!participantId || participantId.includes('/')) {
      throw apiError(400, 'participantId is required');
    }
    const key = connectionKey(state.session.userId, participantId);
    const connection = state.connections.get(key);
    if (connection && acceptedRequestFor(requestStore, state.session.userId, participantId)) {
      state.connections.set(key, { ...connection, saved: false });
    } else {
      state.connections.delete(key);
    }
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/event-data/clear') {
    const body = await readJson(request);
    for (const field of Object.keys(body)) {
      if (field !== 'scope') throw apiError(400, `Unknown clear event data field: ${field}`);
    }
    if ('scope' in body && body.scope !== 'all') {
      throw apiError(400, 'scope must be "all" when provided');
    }
    if (state.session.activeEventId === null && body.scope !== 'all') {
      throw apiError(409, 'Select an event before clearing its data, or use scope "all"');
    }
    const eventId = state.session.activeEventId ?? (state.session.code === null ? null : connectionEventId(state));
    for (const [key, connection] of state.connections) {
      const ownedByCurrentUser = connection.ownerId === state.session.userId;
      const inScope = body.scope === 'all' || connection.eventId === eventId;
      if (ownedByCurrentUser && inScope) state.connections.delete(key);
    }
    requestStore.removeFor(state.session.userId, { eventId, all: body.scope === 'all' });
    state.matches = [];
    state.matchFingerprints.clear();
    state.session.code = null;
    state.session.activeEventId = body.scope === 'all' ? null : state.session.activeEventId;
    state.session.calibrated = false;
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/reset') {
    const body = await readJson(request);
    if (Object.keys(body).length > 0) throw apiError(400, 'Reset body must be empty');
    const resetState = cloneSeedState();
    requestStore.removeFor(state.session.userId, { all: true });
    requestStore.rememberProfile(
      resetState.profiles.find((profile) => profile.id === state.session.userId),
    );
    resetState.requestStore = requestStore;
    resetState.session = {
      id: state.session.id,
      code: null,
      activeEventId: null,
      userId: state.session.userId,
      calibrated: false,
    };
    sessions.set(state.session.id, resetState);
    sendJson(response, 200, sessionBootstrap(resetState));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/logout') {
    const body = await readJson(request);
    if (Object.keys(body).length > 0) throw apiError(400, 'Logout body must be empty');
    sessions.delete(state.session.id);
    sendJson(response, 200, { ok: true });
    return;
  }

  throw apiError(404, 'Endpoint not found');
}

export function createRequestHandler(sessions = new Map(), options = {}) {
  const assessmentService = options.assessmentService ?? createAssessmentService(options);
  const requestStore = options.connectionRequestStore ?? createConnectionRequestStore();
  const followUpService = options.followUpService ?? createFollowUpService(options);
  return (request, response) => {
    handleRequest(request, response, sessions, assessmentService, requestStore, followUpService).catch((error) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const status = Number.isInteger(error.status) ? error.status : 500;
      sendJson(response, status, { error: status === 500 ? 'Internal server error' : error.message });
    });
  };
}

export function createServer(options = {}) {
  return createHttpServer(createRequestHandler(new Map(), options));
}

function configuredPort() {
  if (process.env.PORT === undefined) return DEFAULT_PORT;
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

const executedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (executedDirectly) {
  const port = configuredPort();
  await ensureDataSource();
  createServer().listen(port, HOST, () => {
    console.log(`Catalyst demo API listening at http://${HOST}:${port} (data: ${getActiveStore().source})`);
  });
}

let bootstrapping = null;

// Safe to call on every request: serverless instances load MongoDB once and
// reuse the store while warm. A failed load is retried on the next call.
export function ensureDataSource() {
  bootstrapping ??= bootstrapDataSource().then((loaded) => {
    if (!loaded) bootstrapping = null;
  });
  return bootstrapping;
}

async function bootstrapDataSource() {
  if (!process.env.MONGODB_URI) return true;
  try {
    const { getDb } = await import('./mongodb.mjs');
    const { createMongoStore, setActiveStore } = await import('./store.mjs');
    const db = await getDb();
    const store = await createMongoStore(db);
    setActiveStore(store);
    console.log(`Loaded ${store.snapshot().profiles.length} profiles from MongoDB (${db.databaseName}).`);
    return true;
  } catch (error) {
    console.warn(`MongoDB startup failed, falling back to bundled seed: ${error?.message ?? error}`);
    return false;
  }
}
