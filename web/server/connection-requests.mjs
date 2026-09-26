import { randomUUID } from 'node:crypto';

const clone = (value) => JSON.parse(JSON.stringify(value));
const pairKey = (first, second) => [first, second].sort().join(':');

export function createConnectionRequestStore() {
  const requests = new Map();
  const profiles = new Map();
  return {
    rememberProfile(profile, { overwrite = true } = {}) {
      if (overwrite || !profiles.has(profile.id)) profiles.set(profile.id, clone(profile));
    },
    profile(userId) { return profiles.has(userId) ? clone(profiles.get(userId)) : null; },
    involving(userId) {
      return [...requests.values()].filter((request) => request.senderId === userId || request.recipientId === userId).map(clone);
    },
    send({ senderId, recipientId, eventId, now = new Date().toISOString() }) {
      const samePair = [...requests.values()].filter((request) => pairKey(request.senderId, request.recipientId) === pairKey(senderId, recipientId));
      const existing = samePair.find((request) => request.status === 'accepted')
        ?? samePair.find((request) => request.status === 'pending');
      if (existing) return clone(existing);
      const request = { id: randomUUID(), senderId, recipientId, eventId, status: 'pending', createdAt: now, updatedAt: now };
      requests.set(request.id, request);
      return clone(request);
    },
    update(id, actorId, action, now = new Date().toISOString()) {
      const request = requests.get(id);
      if (!request) return { error: 'not-found' };
      const permitted = action === 'cancel' ? request.senderId === actorId : request.recipientId === actorId;
      if (!permitted) return { error: 'forbidden' };
      const target = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'cancelled';
      if (request.status === target) return { request: clone(request) };
      if (request.status !== 'pending') return { error: 'settled' };
      request.status = target;
      request.updatedAt = now;
      return { request: clone(request) };
    },
    removeFor(userId, { eventId, all = false } = {}) {
      for (const [id, request] of requests) {
        const involved = request.senderId === userId || request.recipientId === userId;
        if (involved && (all || request.eventId === eventId)) requests.delete(id);
      }
    },
  };
}
