import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, test } from 'node:test';

import { createServer } from '../server/index.mjs';
import { createInMemoryStore, setActiveStore } from '../server/store.mjs';
import { buildGraph } from '../server/graph.mjs';
import { graphResponseSchema } from '../shared/graph-contract.mjs';

const demoSeed = JSON.parse(
  await readFile(new URL('../shared/demo-data.json', import.meta.url), 'utf8'),
);

let server;
let baseUrl;

beforeEach(async () => {
  setActiveStore(createInMemoryStore());
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  setActiveStore(createInMemoryStore());
});

async function fetchGraph(query = '') {
  const response = await fetch(`${baseUrl}/api/graph${query}`);
  return { status: response.status, value: await response.json() };
}

test('GET /api/graph matches the contract with the default seed', async () => {
  const { status, value } = await fetchGraph();
  assert.equal(status, 200);
  const parsed = graphResponseSchema.parse(value);
  assert.equal(parsed.meta.source, 'memory');
  assert.equal(parsed.meta.counts.people, demoSeed.profiles.length);
  assert.equal(parsed.meta.counts.connections, demoSeed.connections.length);
  assert.ok(parsed.meta.counts.hubs > 0, 'expected hub nodes for a shared vocabulary');
  assert.equal(parsed.nodes.find((node) => node.id === 'alex').type, 'person');
});

test('GET /api/graph is deterministic across repeated calls', async () => {
  const first = await fetchGraph();
  const second = await fetchGraph();
  const strip = (graph) => ({ ...graph, meta: { ...graph.meta, generatedAt: '__' } });
  assert.deepEqual(strip(first.value), strip(second.value));
});

test('GET /api/graph never exposes contact channels or bios', async () => {
  const { value } = await fetchGraph();
  for (const node of value.nodes) {
    for (const forbidden of ['contact', 'linkedin', 'website', 'email', 'bio']) {
      assert.ok(!(forbidden in node), `node ${node.id} leaks ${forbidden}`);
    }
  }
});

test('GET /api/graph filters to an event roster', async () => {
  const spatial = demoSeed.events.find((event) => event.id === 'spatial');
  const { value } = await fetchGraph('?eventId=spatial');
  const peopleIds = value.nodes.filter((node) => node.type === 'person').map((node) => node.id);
  assert.equal(peopleIds.length, spatial.participantIds.length);
  for (const id of spatial.participantIds) assert.ok(peopleIds.includes(id));
});

test('GET /api/graph hub filtering removes non-selected node types', async () => {
  const { value } = await fetchGraph('?hubs=event');
  const types = new Set(value.nodes.map((node) => node.type));
  assert.ok(!types.has('interest'));
  assert.ok(!types.has('skill'));
  assert.ok(types.has('person'));
});

test('buildGraph hides fields when profile visibility is off', async () => {
  const seedCopy = JSON.parse(JSON.stringify(demoSeed));
  const alex = seedCopy.profiles.find((profile) => profile.id === 'alex');
  alex.visibility = { ...alex.visibility, interests: false, skills: false, previousConnections: false, activeInEvent: false };
  const graph = await buildGraph(createInMemoryStore(seedCopy), {});
  assert.equal(graph.nodes.find((node) => node.id === 'alex'), undefined, 'hidden profile should not appear');
  // Nobody else should keep a tag link to interests that only Alex would have shared.
  for (const link of graph.links) {
    assert.notEqual(link.source, 'alex');
    assert.notEqual(link.target, 'alex');
  }
});

test('buildGraph edges reference an existing node on both ends', async () => {
  const graph = await buildGraph(createInMemoryStore(), {});
  const ids = new Set(graph.nodes.map((node) => node.id));
  for (const link of graph.links) {
    assert.ok(ids.has(link.source), `missing source ${link.source}`);
    assert.ok(ids.has(link.target), `missing target ${link.target}`);
  }
});

test('buildGraph match edges are symmetric across pair order', async () => {
  const store = createInMemoryStore();
  await store.saveAssessment({
    pairKey: 'alex:maya', userA: 'alex', userB: 'maya', score: 92, route: 'professional', reason: 'stub', source: 'rules', audience: 'network', eventId: null, fingerprint: null, version: 'test',
  });
  await store.saveAssessment({
    pairKey: 'alex:maya', userA: 'maya', userB: 'alex', score: 88, route: 'professional', reason: 'stub', source: 'rules', audience: 'network', eventId: null, fingerprint: null, version: 'test',
  });
  const graph = await buildGraph(store, {});
  const matches = graph.links.filter((link) => link.type === 'match');
  assert.equal(matches.length, 1, 'reversed pair order should collapse to one edge');
  const edge = matches[0];
  assert.deepEqual([edge.source, edge.target].sort(), ['alex', 'maya']);
});

test('GET /api/people/:id returns a projected profile without contact fields', async () => {
  const response = await fetch(`${baseUrl}/api/people/alex`);
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.id, 'alex');
  assert.equal(value.contact, '');
  assert.equal(value.linkedin, '');
  assert.equal(value.website, '');
  assert.equal(value.email, '');
});

test('GET /api/people/:id 404s on unknown ids', async () => {
  const response = await fetch(`${baseUrl}/api/people/does-not-exist`);
  assert.equal(response.status, 404);
});

test('person nodes carry their community as the group value', async () => {
  const seedCopy = JSON.parse(JSON.stringify(demoSeed));
  const alex = seedCopy.profiles.find((profile) => profile.id === 'alex');
  alex.community = 'assistive';
  const graph = await buildGraph(createInMemoryStore(seedCopy), {});
  const alexNode = graph.nodes.find((node) => node.id === 'alex');
  assert.equal(alexNode?.group, 'assistive');
  // People without a community still get a node, just with a null group.
  const untagged = graph.nodes.find((node) => node.type === 'person' && node.id !== 'alex');
  assert.ok(untagged, 'expected at least one non-alex person');
  assert.equal(untagged.group, null);
});
