import { MATCH_THRESHOLD } from '../../matcher/src/rubric.mjs';

const HUB_MIN_MEMBERS = 2;
const MAX_MATCH_EDGES_PER_PERSON = 5;

function normalize(value) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

function slug(value) {
  return normalize(value).replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}

function isProfileVisible(profile) {
  const visibility = profile.visibility ?? {};
  return visibility.previousConnections !== false && visibility.activeInEvent !== false;
}

function allowedList(profile, field) {
  const visibility = profile.visibility ?? {};
  if (visibility[field] === false) return [];
  return profile[field] ?? [];
}

function canonicalPair(a, b) {
  return [a, b].sort((left, right) => left.localeCompare(right));
}

/**
 * Build an Obsidian-style network graph from the store snapshot.
 * People appear as person nodes; shared interests, skills, and events become
 * hub nodes that group them. Precomputed rules-scored matches and connections
 * add extra edges. No contact information ever leaves this function.
 */
export async function buildGraph(store, options = {}) {
  const { eventId = null, hubs = ['interest', 'skill', 'event'], viewerId = null } = options;
  const wantHub = new Set(hubs);
  const snapshot = store.snapshot();
  const events = snapshot.events ?? [];

  // Restrict to attendees of a specific event if requested.
  let people = snapshot.profiles.filter(isProfileVisible);
  let eventRoster = null;
  if (eventId) {
    const event = events.find((candidate) => candidate.id === eventId);
    if (event) {
      eventRoster = new Set(event.participantIds ?? []);
      people = people.filter((profile) => eventRoster.has(profile.id));
    } else {
      people = [];
    }
  }

  const personIds = new Set(people.map((profile) => profile.id));

  // Person nodes. `group` carries the community so the frontend can color
  // dots and build a legend.
  const nodes = new Map();
  for (const profile of people) {
    nodes.set(profile.id, {
      id: profile.id,
      type: 'person',
      label: profile.name,
      group: profile.community ?? null,
      degree: 0,
      avatar: profile.avatar || null,
      role: profile.role || null,
      synthetic: profile.synthetic === true,
    });
  }

  const links = [];

  // Hubs: interests, skills, and events.
  const hubBuckets = new Map();
  function hubKey(kind, value) {
    return `${kind}:${slug(value)}`;
  }

  if (wantHub.has('interest') || wantHub.has('skill')) {
    for (const profile of people) {
      if (wantHub.has('interest')) {
        for (const interest of allowedList(profile, 'interests')) {
          const key = hubKey('interest', interest);
          if (!hubBuckets.has(key)) hubBuckets.set(key, { type: 'interest', label: interest, members: [] });
          hubBuckets.get(key).members.push(profile.id);
        }
      }
      if (wantHub.has('skill')) {
        for (const skill of allowedList(profile, 'skills')) {
          const key = hubKey('skill', skill);
          if (!hubBuckets.has(key)) hubBuckets.set(key, { type: 'skill', label: skill, members: [] });
          hubBuckets.get(key).members.push(profile.id);
        }
      }
    }
  }

  if (wantHub.has('event')) {
    for (const event of events) {
      const members = (event.participantIds ?? []).filter((id) => personIds.has(id));
      if (members.length === 0) continue;
      const key = hubKey('event', event.id);
      hubBuckets.set(key, { type: 'event', label: event.name, members });
    }
  }

  let hubCount = 0;
  for (const [key, bucket] of hubBuckets) {
    if (bucket.members.length < HUB_MIN_MEMBERS) continue;
    nodes.set(key, {
      id: key,
      type: bucket.type,
      label: bucket.label,
      group: bucket.type,
      degree: bucket.members.length,
      avatar: null,
    });
    hubCount += 1;
    for (const memberId of bucket.members) {
      const personNode = nodes.get(memberId);
      if (!personNode) continue;
      personNode.degree += 1;
      links.push({ source: memberId, target: key, type: 'tag', weight: 1 });
    }
  }

  // Connection edges from the connections collection.
  let connectionCount = 0;
  const seenConnectionPairs = new Set();
  for (const connection of snapshot.connections ?? []) {
    const [a, b] = canonicalPair(connection.userA, connection.userB);
    if (!personIds.has(a) || !personIds.has(b)) continue;
    const pairKey = `${a}:${b}`;
    if (seenConnectionPairs.has(pairKey)) continue;
    seenConnectionPairs.add(pairKey);
    links.push({ source: a, target: b, type: 'connection', weight: 3 });
    nodes.get(a).degree += 1;
    nodes.get(b).degree += 1;
    connectionCount += 1;
  }

  // Precomputed rules-scored matches from the assessments collection. Cap
  // per-person match edges so a very connected person doesn't drown out the
  // rest of the graph.
  const assessments = await store.listAssessments({ minScore: MATCH_THRESHOLD });
  const eligible = assessments
    .map((record) => {
      const [a, b] = canonicalPair(record.userA, record.userB);
      return { a, b, score: record.score ?? MATCH_THRESHOLD, pairKey: `${a}:${b}` };
    })
    .filter(({ a, b, pairKey }) => personIds.has(a) && personIds.has(b) && !seenConnectionPairs.has(pairKey))
    .sort((left, right) => right.score - left.score);

  const perPersonCounts = new Map();
  const seenMatchPairs = new Set();
  let matchCount = 0;
  for (const record of eligible) {
    if (seenMatchPairs.has(record.pairKey)) continue;
    const countA = perPersonCounts.get(record.a) ?? 0;
    const countB = perPersonCounts.get(record.b) ?? 0;
    if (countA >= MAX_MATCH_EDGES_PER_PERSON || countB >= MAX_MATCH_EDGES_PER_PERSON) continue;
    seenMatchPairs.add(record.pairKey);
    perPersonCounts.set(record.a, countA + 1);
    perPersonCounts.set(record.b, countB + 1);
    links.push({
      source: record.a,
      target: record.b,
      type: 'match',
      weight: Math.max(0.5, record.score / 100),
    });
    nodes.get(record.a).degree += 1;
    nodes.get(record.b).degree += 1;
    matchCount += 1;
  }

  // Count orphans (people with no links) for the outer ring in the UI.
  let orphans = 0;
  for (const node of nodes.values()) {
    if (node.type === 'person' && node.degree === 0) orphans += 1;
  }

  const graph = {
    nodes: [...nodes.values()],
    links,
    meta: {
      source: store.source,
      generatedAt: new Date().toISOString(),
      eventId,
      hubs: [...wantHub].sort(),
      viewerId,
      counts: {
        people: people.length,
        hubs: hubCount,
        matches: matchCount,
        connections: connectionCount,
        orphans,
      },
    },
  };
  return graph;
}
