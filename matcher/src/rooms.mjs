import { InputError } from './profiles.mjs';

const ROOM_CODE = /^[A-Z0-9_-]{1,24}$/u;
const CLIENT_ID = /^[A-Za-z0-9._:-]{1,96}$/u;
const PROFILE_IDS = new Set(['auto', 'alex', 'maya', 'sam']);
const DEFAULT_MEMBER_TTL_MS = 5000;

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InputError(`${label} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new InputError(`${label}.${key} is not allowed`);
  }
}

function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InputError(`${label} must be a finite number`);
  }
  return value;
}

function validatePose(value) {
  exactKeys(value, new Set([
    'px', 'py', 'pz', 'rx', 'ry', 'rz', 'rw', 'tracked', 'sequence',
  ]), 'pose');
  if (typeof value.tracked !== 'boolean') throw new InputError('pose.tracked must be boolean');
  if (!Number.isInteger(value.sequence) || value.sequence < 0) {
    throw new InputError('pose.sequence must be a non-negative integer');
  }
  const pose = {
    px: finiteNumber(value.px, 'pose.px'),
    py: finiteNumber(value.py, 'pose.py'),
    pz: finiteNumber(value.pz, 'pose.pz'),
    rx: finiteNumber(value.rx, 'pose.rx'),
    ry: finiteNumber(value.ry, 'pose.ry'),
    rz: finiteNumber(value.rz, 'pose.rz'),
    rw: finiteNumber(value.rw, 'pose.rw'),
    tracked: value.tracked,
    sequence: value.sequence,
  };
  if (Math.abs(pose.px) > 50 || Math.abs(pose.py) > 50 || Math.abs(pose.pz) > 50) {
    throw new InputError('pose position is outside the 50 meter safety bound');
  }
  const magnitude = Math.hypot(pose.rx, pose.ry, pose.rz, pose.rw);
  if (magnitude < 0.5 || magnitude > 1.5) {
    throw new InputError('pose rotation must be a normalized quaternion');
  }
  return pose;
}

function validateUpdate(value) {
  exactKeys(value, new Set([
    'roomCode', 'clientId', 'requestedProfileId', 'calibrated', 'pose', 'resetRoom',
  ]), 'request');
  const roomCode = String(value.roomCode ?? '').trim().toUpperCase();
  const clientId = String(value.clientId ?? '').trim();
  const requestedProfileId = String(value.requestedProfileId ?? 'auto').trim().toLowerCase();
  if (!ROOM_CODE.test(roomCode)) throw new InputError('roomCode is invalid');
  if (!CLIENT_ID.test(clientId)) throw new InputError('clientId is invalid');
  if (!PROFILE_IDS.has(requestedProfileId)) throw new InputError('requestedProfileId is invalid');
  if (typeof value.calibrated !== 'boolean') throw new InputError('calibrated must be boolean');
  if (value.resetRoom !== undefined && typeof value.resetRoom !== 'boolean') {
    throw new InputError('resetRoom must be boolean');
  }
  return {
    roomCode,
    clientId,
    requestedProfileId,
    calibrated: value.calibrated,
    pose: validatePose(value.pose),
    resetRoom: value.resetRoom === true,
  };
}

function publicMember(member) {
  return {
    clientId: member.clientId,
    profileId: member.profileId,
    calibrated: member.calibrated,
    pose: member.pose,
  };
}

export function createRoomRelay({ matcher, fixtures, now = () => Date.now(), memberTtlMs = DEFAULT_MEMBER_TTL_MS }) {
  if (!matcher || typeof matcher.match !== 'function') throw new TypeError('matcher is required');
  if (!fixtures?.profiles || !Array.isArray(fixtures.offlineResults)) {
    throw new TypeError('fixtures are required');
  }
  const rooms = new Map();

  function roomFor(code) {
    let room = rooms.get(code);
    if (!room) {
      room = {
        code,
        revision: 0,
        members: new Map(),
        match: null,
        matchSource: '',
        matchPair: '',
        matchGeneration: 0,
        resetGeneration: 0,
        pendingPair: '',
        pending: null,
      };
      rooms.set(code, room);
    }
    return room;
  }

  function removeStale(room, currentTime) {
    let changed = false;
    for (const [id, member] of room.members) {
      if (currentTime - member.lastSeenAt > memberTtlMs) {
        room.members.delete(id);
        changed = true;
      }
    }
    if (changed) {
      room.revision += 1;
      room.match = null;
      room.matchSource = '';
      room.matchPair = '';
      room.pendingPair = '';
      room.matchGeneration += 1;
    }
  }

  function assignedProfile(room, clientId, requestedProfileId) {
    const existing = room.members.get(clientId);
    if (existing) {
      if (existing.profileId === 'alex') return 'alex';
      return requestedProfileId === 'sam' ? 'sam' : 'maya';
    }
    const hasAlex = [...room.members.values()].some((member) => member.profileId === 'alex');
    if (!hasAlex) return 'alex';
    return requestedProfileId === 'sam' ? 'sam' : 'maya';
  }

  function activePair(room) {
    const members = [...room.members.values()]
      .filter((member) => member.calibrated)
      .sort((a, b) => a.clientId.localeCompare(b.clientId))
      .slice(0, 2);
    if (members.length !== 2) return null;
    const profileIds = members.map((member) => member.profileId).sort();
    if (profileIds[0] === profileIds[1]) return null;
    return { members, key: profileIds.join(':') };
  }

  async function ensureMatch(room) {
    const pair = activePair(room);
    if (!pair) {
      room.match = null;
      room.matchSource = '';
      room.matchPair = '';
      return;
    }
    if (room.match && room.matchPair === pair.key) return;
    if (room.pending && room.pendingPair === pair.key) {
      await room.pending;
      return;
    }
    room.match = null;
    room.matchSource = '';
    room.matchPair = '';
    const generation = ++room.matchGeneration;
    room.pendingPair = pair.key;
    room.pending = matcher.match({
      profileA: fixtures.profiles[pair.members[0].profileId],
      profileB: fixtures.profiles[pair.members[1].profileId],
    }).then(({ result, source }) => {
      if (generation !== room.matchGeneration || activePair(room)?.key !== pair.key) return;
      room.match = result;
      room.matchSource = source;
      room.matchPair = pair.key;
      room.revision += 1;
    }).finally(() => {
      if (generation === room.matchGeneration) {
        room.pending = null;
        room.pendingPair = '';
      }
    });
    await room.pending;
  }

  function snapshot(room, clientId) {
    const members = [...room.members.values()]
      .sort((a, b) => a.clientId.localeCompare(b.clientId));
    return {
      roomCode: room.code,
      clientId,
      assignedProfileId: room.members.get(clientId)?.profileId ?? '',
      revision: room.revision,
      resetGeneration: room.resetGeneration,
      participants: members.map(publicMember),
      matchAvailable: Boolean(room.match),
      matchSource: room.matchSource,
      match: room.match ?? { userA: '', userB: '', compatible: false, score: 0, reason: '' },
    };
  }

  async function update(raw) {
    const input = validateUpdate(raw);
    const currentTime = now();
    const room = roomFor(input.roomCode);
    removeStale(room, currentTime);
    if (input.resetRoom) {
      room.resetGeneration += 1;
      for (const member of room.members.values()) {
        member.calibrated = false;
        member.pose = { ...member.pose, tracked: false };
      }
      room.match = null;
      room.matchSource = '';
      room.matchPair = '';
      room.pendingPair = '';
      room.matchGeneration += 1;
      room.revision += 1;
    }
    const profileId = assignedProfile(room, input.clientId, input.requestedProfileId);
    const prior = room.members.get(input.clientId);
    const profileChanged = prior && prior.profileId !== profileId;
    const calibrationChanged = prior && prior.calibrated !== input.calibrated;
    room.members.set(input.clientId, {
      clientId: input.clientId,
      profileId,
      calibrated: input.calibrated,
      pose: input.pose,
      lastSeenAt: currentTime,
    });
    if (!prior || profileChanged || calibrationChanged) {
      room.match = null;
      room.matchSource = '';
      room.matchPair = '';
      room.pendingPair = '';
      room.matchGeneration += 1;
      room.revision += 1;
    }
    await ensureMatch(room);
    return snapshot(room, input.clientId);
  }

  return {
    update,
    clear: () => rooms.clear(),
    roomCount: () => rooms.size,
  };
}
