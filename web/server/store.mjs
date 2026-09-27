import { readFileSync } from 'node:fs';

const seedPath = new URL('../shared/demo-data.json', import.meta.url);

// Loaded once. `snapshot()` deep-clones so callers can mutate freely.
export const defaultSeed = JSON.parse(readFileSync(seedPath, 'utf8'));

/**
 * In-memory store used by tests and offline demos. Reads the bundled JSON
 * seed and keeps every response deterministic between runs.
 */
export function createInMemoryStore(seed = defaultSeed) {
  const assessments = new Map();
  return {
    source: 'memory',
    async close() {},
    snapshot() {
      return {
        profiles: structuredClone(seed.profiles),
        events: structuredClone(seed.events),
        connections: structuredClone(seed.connections ?? []),
      };
    },
    async findPerson(id) {
      const profile = seed.profiles.find((candidate) => candidate.id === id);
      return profile ? structuredClone(profile) : null;
    },
    async listPeople() {
      return structuredClone(seed.profiles);
    },
    async listEvents() {
      return structuredClone(seed.events);
    },
    async listConnections() {
      return structuredClone(seed.connections ?? []);
    },
    async findAssessment(pairKey) {
      const record = assessments.get(pairKey);
      return record ? structuredClone(record) : null;
    },
    async saveAssessment(record) {
      assessments.set(record.pairKey, structuredClone(record));
    },
    async listAssessments({ minScore = 0, pairKeys } = {}) {
      const records = [...assessments.values()];
      const filtered = records
        .filter((record) => (record.score ?? 0) >= minScore)
        .filter((record) => !pairKeys || pairKeys.has(record.pairKey));
      return structuredClone(filtered);
    },
  };
}

/**
 * MongoDB-backed store. Loads the full profile/event/connection catalogue
 * into memory once at startup so the sync request pipeline in index.mjs can
 * keep using it without becoming async. Assessment reads/writes stay online.
 */
export async function createMongoStore(db) {
  const stripId = (docs) => docs.map(({ _id, ...rest }) => rest);
  const [profileDocs, eventDocs, connectionDocs] = await Promise.all([
    db.collection('profiles').find({}).toArray(),
    db.collection('events').find({}).toArray(),
    db.collection('connections').find({}).toArray(),
  ]);
  const cache = {
    profiles: stripId(profileDocs),
    events: stripId(eventDocs),
    connections: stripId(connectionDocs),
  };
  return {
    source: 'mongo',
    db,
    async close() {},
    snapshot() {
      return {
        profiles: structuredClone(cache.profiles),
        events: structuredClone(cache.events),
        connections: structuredClone(cache.connections),
      };
    },
    async findPerson(id) {
      const doc = await db.collection('profiles').findOne({ id });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    },
    async listPeople() {
      const docs = await db.collection('profiles').find({}).toArray();
      return stripId(docs);
    },
    async listEvents() {
      const docs = await db.collection('events').find({}).toArray();
      return stripId(docs);
    },
    async listConnections() {
      const docs = await db.collection('connections').find({}).toArray();
      return stripId(docs);
    },
    async findAssessment(pairKey) {
      const doc = await db.collection('assessments').findOne({ pairKey });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    },
    async saveAssessment(record) {
      await db.collection('assessments').updateOne(
        { pairKey: record.pairKey },
        { $set: record },
        { upsert: true },
      );
    },
    async listAssessments({ minScore = 0, pairKeys } = {}) {
      const filter = { score: { $gte: minScore } };
      if (pairKeys) filter.pairKey = { $in: [...pairKeys] };
      const docs = await db.collection('assessments').find(filter).toArray();
      return stripId(docs);
    },
  };
}

// Module-scoped active store used by the sync request pipeline in index.mjs.
let activeStore = createInMemoryStore();

export function getActiveStore() {
  return activeStore;
}

export function setActiveStore(store) {
  activeStore = store;
}
