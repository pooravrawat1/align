import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { pathToFileURL } from 'node:url';

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
  'location',
  'contact',
  'linkedin',
  'website',
  'email',
  'avatar',
  'visibility',
]);
const FOLLOW_UP_VALUES = new Set(['needed', 'contacted', 'none']);
const VISIBILITY_FIELDS = new Set(Object.keys(DEFAULT_VISIBILITY));
const DEMO_REASON =
  'You are both building assistive technology. Maya brings computer-vision expertise, while Alex can help deploy it on wearable hardware.';

const seed = JSON.parse(
  readFileSync(new URL('../shared/demo-data.json', import.meta.url), 'utf8'),
);
const seedProfilesById = new Map(seed.profiles.map((profile) => [profile.id, profile]));
const knownRoomCodes = new Set(seed.events.map((event) => event.code.toUpperCase()));

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
  };
}

function cloneSeedData() {
  const data = clone(seed);
  data.profiles = data.profiles.map(withProfileDefaults);
  data.connections = data.connections.map(withConnectionDefaults);
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
    matchCache: new Map(),
  };
}

function publicBootstrap() {
  const data = cloneSeedData();
  return {
    profiles: data.profiles,
    events: data.events,
    connections: data.connections,
    matches: [],
    session: null,
    demo: true,
  };
}

function sessionBootstrap(state) {
  return {
    profiles: clone(state.profiles),
    events: clone(state.events),
    connections: clone(
      [...state.connections.values()].filter(
        (connection) => connection.ownerId === state.session.userId,
      ),
    ),
    matches: clone(state.matches),
    session: clone(state.session),
    demo: true,
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

  for (const field of ['interests', 'skills', 'lookingFor']) {
    if (field in body) validateStringArray(field, body[field]);
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

function firstName(profile) {
  return compactLabel(profile.name, 1);
}

function profilesEqualSeed(profile) {
  const original = seedProfilesById.get(profile.id);
  if (original === undefined) return false;
  const { avatar: _profileAvatar, ...comparableProfile } = profile;
  const { avatar: _seedAvatar, ...comparableSeed } = withProfileDefaults(original);
  return JSON.stringify(comparableProfile) === JSON.stringify(comparableSeed);
}

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

function deterministicMatch(firstProfile, secondProfile, demoMode) {
  const [userA, userB] = canonicalPair(firstProfile.id, secondProfile.id);
  const profileA = firstProfile.id === userA ? firstProfile : secondProfile;
  const profileB = firstProfile.id === userB ? firstProfile : secondProfile;

  if (
    demoMode &&
    userA === 'alex' &&
    userB === 'maya' &&
    profilesEqualSeed(profileA) &&
    profilesEqualSeed(profileB)
  ) {
    return {
      userA,
      userB,
      compatible: true,
      score: 0.96,
      reason: DEMO_REASON,
      source: 'precomputed',
    };
  }

  if (!profileA.visibility.activeInEvent || !profileB.visibility.activeInEvent) {
    return {
      userA,
      userB,
      compatible: false,
      score: 0,
      reason: '',
      source: 'mock',
    };
  }

  const skillsA = normalizedSet(visibleProfileValues(profileA, 'skills'));
  const skillsB = normalizedSet(visibleProfileValues(profileB, 'skills'));
  const lookingA = normalizedSet(visibleProfileValues(profileA, 'lookingFor'));
  const lookingB = normalizedSet(visibleProfileValues(profileB, 'lookingFor'));
  const skillMatches = [];

  for (const [key, skill] of skillsA) {
    if (lookingB.has(key)) {
      skillMatches.push({ provider: profileA, seeker: profileB, value: skill });
    }
  }
  for (const [key, skill] of skillsB) {
    if (lookingA.has(key)) {
      skillMatches.push({ provider: profileB, seeker: profileA, value: skill });
    }
  }

  skillMatches.sort((left, right) =>
    left.value.localeCompare(right.value, 'en-US', { sensitivity: 'base' }),
  );
  const sharedInterests = sharedInterestsForProfiles(profileA, profileB);

  if (skillMatches.length === 0 && sharedInterests.length === 0) {
    return {
      userA,
      userB,
      compatible: false,
      score: 0,
      reason: '',
      source: 'mock',
    };
  }

  let reason;
  if (skillMatches.length > 0) {
    const match = skillMatches[0];
    reason = `${firstName(match.provider)} offers ${compactLabel(match.value)}, which ${firstName(match.seeker)} is seeking.`;
  } else {
    reason = `${firstName(profileA)} and ${firstName(profileB)} share an interest in ${compactLabel(sharedInterests[0])}.`;
  }

  return {
    userA,
    userB,
    compatible: true,
    score: Math.min(99, 50 + skillMatches.length * 18 + sharedInterests.length * 10) / 100,
    reason,
    source: 'mock',
  };
}

function calculateMatches(state, demoMode) {
  const current = state.profiles.find((profile) => profile.id === state.session.userId);
  const matches = new Map();

  for (const participant of state.profiles) {
    if (participant.id === current.id) continue;
    const match = deterministicMatch(current, participant, demoMode);
    matches.set(pairKey(match.userA, match.userB), match);
  }

  return [...matches.values()].sort(
    (left, right) => right.score - left.score || pairKey(left.userA, left.userB).localeCompare(pairKey(right.userA, right.userB)),
  );
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
  if (state.session.code === null) return 'demo';
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
    (match) => match.userA === userA && match.userB === userB && match.compatible,
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

async function handleRequest(request, response, sessions) {
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${DEFAULT_PORT}`}`);

  if (request.method === 'OPTIONS') {
    sendEmpty(response, 204);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true, demo: true });
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
    const profile = state.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) throw apiError(404, 'Profile not found');
    if ('name' in body) profile.name = body.name.trim();

    const sessionId = randomUUID();
    state.session = {
      id: sessionId,
      code: null,
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
    const profile = state.profiles.find((candidate) => candidate.id === state.session.userId);
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
      state.matchCache.clear();
    }
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
    if (!knownRoomCodes.has(code) && !state.customRoomCodes.has(code) && body.create !== true) {
      throw apiError(404, 'Room not found');
    }
    if (!knownRoomCodes.has(code) && !state.customRoomCodes.has(code) && body.create === true) {
      state.customRoomCodes.add(code);
      state.events.push({
        id: code,
        code,
        name: `Room ${code}`,
        description: 'A local demo room for trying an introduction.',
        location: 'Local preview',
        date: 'Demo session',
        time: 'No scheduled time',
        status: 'Demo event',
      });
    }
    if (state.session.code !== code) {
      state.matches = [];
      state.matchCache.clear();
    }
    state.session.code = code;
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
    state.matchCache.clear();
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
    const cacheKey = `${state.session.userId}:${demoMode ? 'demo' : 'standard'}`;
    if (body.force === true || !state.matchCache.has(cacheKey)) {
      state.matchCache.set(cacheKey, calculateMatches(state, demoMode));
    }
    state.matches = clone(state.matchCache.get(cacheKey));
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/connections') {
    const body = await readJson(request);
    if (Object.keys(body).some((field) => field !== 'participantId')) {
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
    const [userA, userB] = canonicalPair(state.session.userId, body.participantId);
    const key = connectionKey(state.session.userId, body.participantId);
    if (!state.connections.has(key)) {
      const matchContext = connectionMatchContext(state, userA, userB);
      state.connections.set(key, {
        userA,
        userB,
        ownerId: state.session.userId,
        participantId: body.participantId,
        eventId: connectionEventId(state),
        createdAt: new Date().toISOString(),
        notes: '',
        followUp: 'needed',
        reminderDate: '',
        ...matchContext,
      });
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
    const connection = state.connections.get(key);
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
    state.connections.delete(connectionKey(state.session.userId, participantId));
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
    if (state.session.code === null && body.scope !== 'all') {
      throw apiError(409, 'Join an event before clearing its data, or use scope "all"');
    }
    const eventId = state.session.code === null ? null : connectionEventId(state);
    for (const [key, connection] of state.connections) {
      const ownedByCurrentUser = connection.ownerId === state.session.userId;
      const inScope = body.scope === 'all' || connection.eventId === eventId;
      if (ownedByCurrentUser && inScope) state.connections.delete(key);
    }
    state.matches = [];
    state.matchCache.clear();
    state.session.code = null;
    state.session.calibrated = false;
    sendJson(response, 200, sessionBootstrap(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/reset') {
    const body = await readJson(request);
    if (Object.keys(body).length > 0) throw apiError(400, 'Reset body must be empty');
    const resetState = cloneSeedState();
    resetState.session = {
      id: state.session.id,
      code: null,
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

export function createRequestHandler(sessions = new Map()) {
  return (request, response) => {
    handleRequest(request, response, sessions).catch((error) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const status = Number.isInteger(error.status) ? error.status : 500;
      sendJson(response, status, { error: status === 500 ? 'Internal server error' : error.message });
    });
  };
}

export function createServer() {
  return createHttpServer(createRequestHandler());
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
  createServer().listen(port, HOST, () => {
    console.log(`Catalyst demo API listening at http://${HOST}:${port}`);
  });
}
