#!/usr/bin/env node
// Deterministic seed for the align MongoDB database.
//
// Generates ~400 fictional attendees, keeps the 11 existing demo people
// unchanged, distributes them across the existing events plus several past
// events, and precomputes rules-scored assessment records for every pair at or
// above the match threshold. Safe to run repeatedly; upserts by stable id.
//
// Usage: npm run seed  (requires MONGODB_URI in web/.env)

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import {
  MATCH_THRESHOLD,
  RUBRIC_VERSION,
  experienceRoutes,
  chooseResult,
} from '../../matcher/src/rubric.mjs';
import { getDb, disconnectFromMongoDB } from '../server/mongodb.mjs';

if (existsSync(new URL('../.env', import.meta.url))) {
  loadEnvFile(new URL('../.env', import.meta.url));
}

const TARGET_ATTENDEES = 400;
const SEED = 0x416c69676e; // "Align" as a stable hex seed.

// --- Deterministic PRNG (mulberry32) ---
function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(SEED);
const pick = (list) => list[Math.floor(rng() * list.length)];
const pickN = (list, n) => {
  const copy = [...list];
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i += 1) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
};

// --- Vocabulary pools, grouped into loose communities so clusters form. ---
const COMMUNITIES = [
  {
    name: 'assistive',
    interests: ['Assistive technology', 'Inclusive design', 'Accessibility', 'Robotics', 'Wearable computing'],
    skills: ['Embedded systems', 'Computer vision', 'C++', 'Electronics', 'Signal processing', 'Prototyping', 'Accessibility', 'Machine learning'],
    lookingFor: ['Computer vision', 'Hardware', 'Embedded systems', 'User research'],
    domains: ['Assistive technology', 'Wearable computing', 'Robotics'],
    roles: ['Hardware engineer', 'Computer vision engineer', 'Robotics researcher', 'Accessibility researcher'],
    proExperiences: ['Build Together', 'AT Hack', 'Robotics Summit', 'Assistive Systems Lab'],
    persExperiences: [
      { kind: 'hiking', label: 'Appalachian Trail day hike' },
      { kind: 'volunteering', label: 'Community garden weekends' },
    ],
  },
  {
    name: 'spatial',
    interests: ['Spatial computing', 'Design', 'Creative tools', 'Open source', 'Interaction design'],
    skills: ['Unity', 'Three.js', 'Interaction design', 'Shader programming', 'C#', 'Prototyping', 'Blender'],
    lookingFor: ['Audio design', 'Machine learning', 'Interaction design'],
    domains: ['Spatial computing', 'Creative tools'],
    roles: ['Creative technologist', 'Spatial designer', 'XR engineer', 'Spatial audio engineer'],
    proExperiences: ['XR Jam', 'Spatial Sessions', 'Immersive Studio Week'],
    persExperiences: [
      { kind: 'cycling', label: 'Coastal cycling trip' },
      { kind: 'live music', label: 'Late-night jazz sets' },
    ],
  },
  {
    name: 'ai',
    interests: ['Machine learning', 'Data visualization', 'Open source', 'Startups', 'Robotics'],
    skills: ['Python', 'Machine learning', 'PyTorch', 'Data engineering', 'MLOps', 'TypeScript'],
    lookingFor: ['Interaction design', 'Product design', 'Frontend development'],
    domains: ['Applied AI', 'Data platforms'],
    roles: ['ML researcher', 'Data engineer', 'Applied scientist', 'ML infra engineer'],
    proExperiences: ['Neural Meet', 'Open Models Day', 'Applied AI Summit'],
    persExperiences: [
      { kind: 'chess', label: 'Weekend chess tournaments' },
      { kind: 'reading', label: 'Sci-fi book club' },
    ],
  },
  {
    name: 'design',
    interests: ['Design', 'Creative tools', 'Communities', 'Interaction design', 'Type design'],
    skills: ['Figma', 'Interaction design', 'Research', 'Prototyping', 'Illustration', 'Motion design'],
    lookingFor: ['Frontend development', 'Illustration', 'Engineering'],
    domains: ['Product design', 'Creative tools'],
    roles: ['Product designer', 'Design engineer', 'Illustrator', 'Brand designer'],
    proExperiences: ['Creative Systems Studio', 'Design in the Wild', 'Type Camp'],
    persExperiences: [
      { kind: 'painting', label: 'Sunday watercolor sessions' },
      { kind: 'cooking', label: 'Neighborhood supper club' },
    ],
  },
  {
    name: 'civic',
    interests: ['Communities', 'Civic technology', 'Open source', 'Data visualization', 'Climate tech'],
    skills: ['TypeScript', 'Facilitation', 'Community research', 'Mapping', 'Python', 'Public speaking'],
    lookingFor: ['Frontend development', 'Data engineering', 'Design'],
    domains: ['Civic technology', 'Communities'],
    roles: ['Civic technology organizer', 'Community researcher', 'Program manager', 'Policy technologist'],
    proExperiences: ['Code for Neighborhoods', 'Civic Data Day', 'Community Systems Workshop'],
    persExperiences: [
      { kind: 'running', label: 'Weekend park runs' },
      { kind: 'gardening', label: 'Balcony gardening projects' },
    ],
  },
  {
    name: 'climate',
    interests: ['Climate tech', 'Open source', 'Data visualization', 'Sustainable hardware', 'Communities'],
    skills: ['Python', 'Data engineering', 'Mapping', 'Hardware', 'CAD', 'GIS'],
    lookingFor: ['Interaction design', 'Hardware', 'Firmware'],
    domains: ['Climate tech', 'Sustainable hardware'],
    roles: ['Climate data engineer', 'Sustainability researcher', 'Sensor engineer', 'Environmental analyst'],
    proExperiences: ['Climate Signals Summit', 'Green Hardware Jam', 'Sensor Weekend'],
    persExperiences: [
      { kind: 'sailing', label: 'Weekend sailing club' },
      { kind: 'birding', label: 'Migratory bird counts' },
    ],
  },
];

// Fixed community assignments for the 11 seeded demo people.
const DEMO_COMMUNITY = {
  alex: 'assistive',
  maya: 'assistive',
  leo: 'assistive',
  priya: 'assistive',
  theo: 'assistive',
  jordan: 'spatial',
  elena: 'spatial',
  sam: 'design',
  nina: 'civic',
  amina: 'civic',
  mateo: 'climate',
};

const CITIES = [
  'Atlanta, GA', 'Brooklyn, NY', 'Austin, TX', 'Boston, MA', 'Chicago, IL',
  'Miami, FL', 'Seattle, WA', 'New York, NY', 'San Francisco, CA', 'Denver, CO',
  'Toronto, ON', 'Portland, OR', 'Oakland, CA', 'Los Angeles, CA', 'Minneapolis, MN',
];

const GOAL_POOL = [
  'Collaboration', 'Learning', 'Mentorship', 'Cofounder search',
  'Hiring', 'Job search', 'Community building', 'Investment',
];

// Relationship memories make the network feel like a record of people you
// actually met, not a list of professional recommendations. These belong to
// the connection: two people can remember the same concert or activity even
// when neither puts it on their public profile.
const MUSIC_ARTISTS = [
  'Khruangbin', 'Japanese Breakfast', 'Men I Trust', 'The Marías',
  'Hiatus Kaiyote', 'Parcels', 'Little Simz', 'Mitski', 'BADBADNOTGOOD',
  'Jungle', 'Big Thief', 'Toro y Moi', 'Cleo Sol', 'Tame Impala',
  'Snarky Puppy', 'Kaytranada',
];
const MUSIC_VENUES = [
  'Shaky Knees', 'The Eastern', 'Variety Playhouse', 'Terminal West',
  'Music Midtown', 'The Tabernacle', 'Aisle 5', 'Chastain Park',
  'The Masquerade', 'a rooftop set downtown',
];
const ACTIVITY_MEMORIES = [
  'Ran the BeltLine night 5K', 'Joined the same street photography walk',
  'Took the same weekend ceramics class', 'Climbed at the same bouldering gym',
  'Joined a sunrise hike at Stone Mountain', 'Played in the same casual soccer league',
  'Tried the same dumpling-making class', 'Rode the Silver Comet Trail',
  'Joined a Saturday sketching group', 'Took the same beginner salsa class',
  'Went kayaking on the Chattahoochee', 'Joined the same sci-fi book club',
  'Played at a neighborhood chess night', 'Took part in a city architecture walk',
  'Joined a screen-printing workshop', 'Visited the same independent film screening',
  'Took a native-plant gardening class', 'Joined the same Sunday run club',
  'Volunteered at a bicycle repair workshop', 'Went to the same pop-up supper club',
  'Joined a night-sky viewing session', 'Took the same woodworking introduction',
  'Visited the High Museum on member night', 'Joined a weekend bird-count walk',
];
const COMMUNITY_MEMORIES = [
  'Helped at an Atlanta maker meetup', 'Joined an open-source volunteer night',
  'Met before at a neighborhood supper club', 'Mentored at a student hackathon',
  'Volunteered at a community garden workday', 'Helped run a neighborhood repair café',
  'Joined a mutual-aid supply drive', 'Worked the same local arts festival',
  'Helped map accessible city routes', 'Joined a library technology clinic',
  'Volunteered at a youth robotics showcase', 'Attended a transit advocacy meetup',
  'Helped at a community tool library', 'Joined a local climate-action cleanup',
  'Hosted tables at the same makers market', 'Attended a neighborhood planning session',
  'Volunteered at an electronics recycling day', 'Joined a civic design critique',
  'Helped organize a food-rescue pickup', 'Attended an inclusive-design meetup',
  'Joined a public-data volunteer sprint', 'Helped at a community science fair',
  'Volunteered at an adaptive sports day', 'Joined a local creative-coding meetup',
];
const PROFESSIONAL_MEMORIES = [
  'Attended Civic Data Day', 'Built alongside each other at AT Hack',
  'Joined the Spatial Sessions workshop', 'Compared prototypes at Build Together',
  'Attended an Open Models roundtable', 'Joined a climate-sensor workshop',
  'Shared feedback at an accessibility design review', 'Attended a creative-tools demo night',
  'Joined a responsible-AI discussion', 'Tested ideas at an XR prototyping lab',
  'Attended a sustainable hardware showcase', 'Joined an interaction-design critique',
  'Compared notes at a robotics research mixer', 'Attended a community technology forum',
  'Joined a public-interest technology salon', 'Shared a table at a founder studio day',
  'Attended an open hardware office hour', 'Joined a spatial-audio listening lab',
  'Tested prototypes at a wearable computing meetup', 'Attended a data storytelling workshop',
  'Joined a design-systems working session', 'Shared feedback at a climate-tech roundtable',
  'Attended a computer-vision research night', 'Joined an indie developer show-and-tell',
];
const ALEX_PINNED_EXPERIENCES = {
  jordan: [
    { kind: 'professional', label: 'Joined the same Spatial Sessions workshop' },
    { kind: 'music', label: 'Caught Japanese Breakfast at The Eastern' },
  ],
  nina: [
    { kind: 'music', label: 'Saw Khruangbin at Shaky Knees' },
    { kind: 'community', label: 'Joined the same open-source volunteer night' },
  ],
  leo: [
    { kind: 'professional', label: 'Compared prototypes at Build Together' },
    { kind: 'activity', label: 'Ran the BeltLine night 5K' },
  ],
};

const FIRST_NAMES = [
  'Aditi', 'Amelia', 'Aiden', 'Alicia', 'Amir', 'Ana', 'Andrei', 'Arjun', 'Asha', 'Ayesha',
  'Ben', 'Bianca', 'Bo', 'Cai', 'Caleb', 'Cara', 'Carmen', 'Cass', 'Chen', 'Chika',
  'Chloe', 'Cyrus', 'Dana', 'Darius', 'Devi', 'Diego', 'Dilan', 'Dinesh', 'Eli', 'Elias',
  'Emeka', 'Emi', 'Emma', 'Enzo', 'Esen', 'Eun', 'Eva', 'Faisal', 'Fatima', 'Felix',
  'Gabi', 'Ghalia', 'Grace', 'Hana', 'Harper', 'Hiro', 'Ida', 'Idris', 'Ines', 'Isha',
  'Ivan', 'Ivy', 'Jae', 'Jamal', 'Javi', 'Jia', 'Josie', 'June', 'Kai', 'Kaia',
  'Kamal', 'Kata', 'Kavya', 'Kenji', 'Kian', 'Kim', 'Kiran', 'Lars', 'Lea', 'Leah',
  'Lena', 'Leon', 'Lilia', 'Linh', 'Liu', 'Lulu', 'Mahdi', 'Mai', 'Marta', 'Mateus',
  'Maya', 'Mei', 'Mira', 'Naima', 'Nao', 'Nia', 'Nikhil', 'Nino', 'Noor', 'Nora',
  'Oli', 'Omar', 'Onni', 'Osei', 'Pablo', 'Petra', 'Pia', 'Priya', 'Qi', 'Rafa',
  'Rahim', 'Raj', 'Reem', 'Rin', 'Rio', 'Rita', 'Roshan', 'Rue', 'Saanvi', 'Sade',
  'Saif', 'Salma', 'Sami', 'Sana', 'Sanjay', 'Sara', 'Selin', 'Sena', 'Shu', 'Sofia',
  'Sunil', 'Suri', 'Tavo', 'Tenzin', 'Thi', 'Tobin', 'Uma', 'Vera', 'Vidya', 'Vik',
  'Wren', 'Xin', 'Yara', 'Yasmin', 'Yuki', 'Yusra', 'Zain', 'Zara', 'Zoe', 'Zuri',
];

const LAST_NAMES = [
  'Adeyemi', 'Alvarez', 'Amin', 'Anand', 'Arai', 'Asante', 'Bahri', 'Balan', 'Beltran',
  'Berg', 'Bhatt', 'Blanc', 'Boateng', 'Cabral', 'Cardoso', 'Carrillo', 'Chandra', 'Chang',
  'Chen', 'Cho', 'Choi', 'Costa', 'Da Silva', 'Dahl', 'Devi', 'Diallo', 'Dubois', 'Duran',
  'Eze', 'Farrow', 'Fatima', 'Fernandes', 'Forsberg', 'Gao', 'Ghosh', 'Gomes', 'Guerrero',
  'Gupta', 'Hakim', 'Hall', 'Han', 'Hansen', 'Hara', 'Hassan', 'Hidalgo', 'Ibrahim',
  'Imai', 'Ito', 'Iyer', 'Jain', 'Jang', 'Jimenez', 'Joshi', 'Kaboré', 'Kadam', 'Kaur',
  'Kelly', 'Khan', 'Kim', 'Kimura', 'Kirk', 'Kok', 'Kovac', 'Kumar', 'Kwon', 'Lam',
  'Larsen', 'Le', 'Lee', 'Leung', 'Li', 'Liang', 'Lima', 'Lin', 'Lopes', 'Lopez',
  'Lozano', 'Lundgren', 'Mahmud', 'Malik', 'Marchetti', 'Martins', 'Mata', 'Medina',
  'Mensah', 'Mera', 'Miller', 'Min', 'Mishra', 'Mitra', 'Mohan', 'Moreno', 'Morgan',
  'Mustafa', 'Nair', 'Nakamura', 'Ndiaye', 'Nguyen', 'Novak', 'Nunez', 'Obasi', 'Odoh',
  'Ohashi', 'Okonkwo', 'Olsen', 'Omar', 'Ortiz', 'Osei', 'Owens', 'Padilla', 'Pak',
  'Pandey', 'Park', 'Patel', 'Peralta', 'Petrov', 'Pham', 'Pineda', 'Prasad', 'Qureshi',
  'Rahman', 'Ramos', 'Rao', 'Reyes', 'Rios', 'Rivera', 'Rossi', 'Roy', 'Sahin', 'Saito',
  'Salazar', 'Salgado', 'Sanches', 'Sanchez', 'Sarkar', 'Sato', 'Sawyer', 'Schmid',
  'Schneider', 'Sen', 'Serrano', 'Shah', 'Shen', 'Shin', 'Silva', 'Singh', 'Sinha',
  'Smith', 'Sokolova', 'Song', 'Soto', 'Suarez', 'Sultana', 'Sun', 'Suzuki', 'Tanaka',
  'Tan', 'Tang', 'Teixeira', 'Torres', 'Tran', 'Trinh', 'Tsai', 'Tulasi', 'Ubaldo',
  'Vargas', 'Vega', 'Verma', 'Villanueva', 'Vo', 'Wang', 'Wong', 'Wu', 'Xu', 'Yamada',
  'Yamamoto', 'Yang', 'Ye', 'Yi', 'Yoo', 'Yoon', 'Yousef', 'Yu', 'Zaman', 'Zhang',
  'Zhou',
];

const BIO_TEMPLATES = [
  ({ role }) => `${role} exploring what's next. Enjoys deep-dive conversations about the details of the work.`,
  ({ community }) => `Working in ${community} circles. Looking to trade notes with people building nearby.`,
  ({ role }) => `${role} focused on making the tools I already use feel simpler and more considered.`,
  () => `Small teams, careful work, and long walks between meetings.`,
  ({ community }) => `Most of my week is spent in ${community}. The rest is spent trying to explain it.`,
  () => `Prefers early prototypes over slide decks. Always up for a coffee chat.`,
];

// --- Existing events (kept unchanged), plus generated past events. ---
async function loadDemoSeed() {
  const raw = await readFile(new URL('../shared/demo-data.json', import.meta.url), 'utf8');
  return JSON.parse(raw);
}

const PAST_EVENT_NAMES = [
  'Signals After Dark', 'Neighborhood Build Night', 'Field Notes',
  'Open Studio Exchange', 'Small Systems Salon', 'Prototype Picnic',
  'Ideas in Motion', 'Side Project Social', 'Tools for Tomorrow',
  'Local Futures Forum', 'Hands-on Commons', 'The Practice Room',
  'Community Demo Hour', 'Working Session', 'Curious Builders Club',
  'People and Prototypes', 'Friday Field Lab', 'Making Things Together',
];

function generatePastEvents(count) {
  const events = [];
  for (let i = 0; i < count; i += 1) {
    const month = 1 + Math.floor(rng() * 8);
    const day = 1 + Math.floor(rng() * 27);
    const community = COMMUNITIES[i % COMMUNITIES.length];
    const name = `${PAST_EVENT_NAMES[i % PAST_EVENT_NAMES.length]} · ${community.domains[0]}`;
    events.push({
      id: `past-${community.name}-${i}`,
      code: `PAST${i}`,
      name,
      description: `Past ${community.domains[0]} gathering.`,
      location: `${pick(CITIES)} · Studio ${1 + Math.floor(rng() * 9)}`,
      date: `2026-0${month}-${String(day).padStart(2, '0')}`,
      time: '6:00 PM – 9:00 PM',
      status: 'Past',
      participantIds: [],
      startsAt: `2026-0${month}-${String(day).padStart(2, '0')}T18:00:00-04:00`,
      endsAt: `2026-0${month}-${String(day).padStart(2, '0')}T21:00:00-04:00`,
      timeZone: 'America/New_York',
    });
  }
  return events;
}

function uniqueList(items, limit = 20) {
  const seen = new Map();
  for (const item of items) {
    const key = item.trim().toLocaleLowerCase('en-US');
    if (!key || seen.has(key)) continue;
    seen.set(key, item.trim());
    if (seen.size >= limit) break;
  }
  return [...seen.values()];
}

function synthesizeProfile(index, existingIds) {
  const community = COMMUNITIES[Math.floor(rng() * COMMUNITIES.length)];
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  let baseId = `${first}${last}`.toLowerCase().replace(/[^a-z0-9]+/gu, '');
  let id = baseId;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${baseId}${suffix}`;
    suffix += 1;
  }
  existingIds.add(id);

  const role = pick(community.roles);
  const bio = pick(BIO_TEMPLATES)({ role: role.toLowerCase(), community: community.domains[0].toLowerCase() });
  const avatar = `https://i.pravatar.cc/512?img=${(index % 70) + 1}`;

  // 60% of interests/skills from the primary community, 40% from a random one.
  const secondary = COMMUNITIES[(COMMUNITIES.indexOf(community) + 1 + Math.floor(rng() * (COMMUNITIES.length - 1))) % COMMUNITIES.length];
  const interests = uniqueList([
    ...pickN(community.interests, 2 + Math.floor(rng() * 2)),
    ...pickN(secondary.interests, 1 + Math.floor(rng() * 2)),
  ], 5);
  const skills = uniqueList([
    ...pickN(community.skills, 2 + Math.floor(rng() * 2)),
    ...pickN(secondary.skills, 1),
  ], 4);
  const lookingFor = uniqueList(pickN(community.lookingFor, 1 + Math.floor(rng() * 2)), 3);
  const domains = uniqueList(pickN(community.domains, 1 + Math.floor(rng() * 2)), 3);
  const goals = uniqueList(pickN(GOAL_POOL, 1 + Math.floor(rng() * 2)), 3);

  const experiences = [];
  if (rng() < 0.85) {
    experiences.push({
      category: 'professional',
      kind: 'hackathon',
      label: pick(community.proExperiences),
      year: 2023 + Math.floor(rng() * 3),
    });
  }
  if (rng() < 0.55) {
    const personal = pick(community.persExperiences);
    experiences.push({
      category: 'personal',
      kind: personal.kind,
      label: personal.label,
      year: 2022 + Math.floor(rng() * 4),
    });
  }

  // 4% of attendees have no shared hubs — they'll sit on the outer ring.
  const orphan = rng() < 0.04;
  if (orphan) {
    return {
      id,
      name: `${first} ${last}`,
      role,
      community: null,
      bio: 'Prefers to introduce themselves in person.',
      interests: [],
      skills: [],
      lookingFor: [],
      goals: [],
      domains: [],
      experiences: [],
      avatar,
      location: pick(CITIES),
      distance: Math.round(rng() * 10 * 10) / 10,
      synthetic: true,
    };
  }

  return {
    id,
    name: `${first} ${last}`,
    role,
    community: community.name,
    bio,
    interests,
    skills,
    lookingFor,
    goals,
    domains,
    experiences,
    avatar,
    location: pick(CITIES),
    distance: Math.round(rng() * 10 * 10) / 10,
    synthetic: true,
  };
}

// Build owned connections for the graph rings. Each demo user gets 25–40
// connections (mostly within their community), and generated people get 2–6
// each. Every connection borrows an eventId from an event both people
// attended, so the existing UI keeps rendering context for it.
function generateConnections(profiles, events) {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const eventsFor = new Map();
  for (const profile of profiles) eventsFor.set(profile.id, []);
  for (const event of events) {
    for (const pid of event.participantIds ?? []) {
      if (eventsFor.has(pid)) eventsFor.get(pid).push(event);
    }
  }

  const sharedEventId = (a, b) => {
    const listA = eventsFor.get(a) ?? [];
    const setB = new Set((eventsFor.get(b) ?? []).map((event) => event.id));
    const shared = listA.filter((event) => setB.has(event.id));
    if (shared.length > 0) return pick(shared).id;
    // Historical connection context can reference the other person's event
    // even when it is no longer in the current user's visible event list.
    return eventsFor.get(b)?.[0]?.id ?? listA[0]?.id ?? 'demo';
  };

  const now = new Date('2026-09-26T10:00:00Z').getTime();
  const bag = new Map();
  const usedExperienceLabels = new Map();
  const labelsFor = (ownerId) => {
    if (!usedExperienceLabels.has(ownerId)) usedExperienceLabels.set(ownerId, new Set());
    return usedExperienceLabels.get(ownerId);
  };
  const createSharedExperience = () => {
    const kind = pick(['music', 'activity', 'community', 'professional']);
    if (kind === 'music') {
      return { kind, label: `Saw ${pick(MUSIC_ARTISTS)} at ${pick(MUSIC_VENUES)}` };
    }
    const pool = kind === 'activity'
      ? ACTIVITY_MEMORIES
      : kind === 'community'
        ? COMMUNITY_MEMORIES
        : PROFESSIONAL_MEMORIES;
    return { kind, label: pick(pool) };
  };
  const variedExperiences = (ownerId, count) => {
    const used = labelsFor(ownerId);
    const experiences = [];
    let attempts = 0;
    while (experiences.length < count && attempts < 500) {
      attempts += 1;
      const experience = createSharedExperience();
      if (used.has(experience.label)) continue;
      used.add(experience.label);
      experiences.push(experience);
    }
    return experiences;
  };
  const add = (ownerId, participantId, sharedExperiences = null) => {
    if (ownerId === participantId) return;
    const key = `${ownerId}:${participantId}`;
    if (bag.has(key)) return;
    const [userA, userB] = [ownerId, participantId].sort();
    const experiences = sharedExperiences ?? variedExperiences(ownerId, 1 + Math.floor(rng() * 3));
    for (const experience of experiences) labelsFor(ownerId).add(experience.label);
    bag.set(key, {
      ownerId,
      participantId,
      userA,
      userB,
      eventId: sharedEventId(ownerId, participantId),
      createdAt: new Date(now - Math.floor(rng() * 30 * 86400000)).toISOString(),
      notes: '',
      followUp: 'needed',
      reminderDate: '',
      saved: true,
      sharedExperiences: experiences,
    });
  };

  // Group synthetic profiles by community for pairing.
  const byCommunity = new Map();
  for (const profile of profiles) {
    const community = profile.community ?? DEMO_COMMUNITY[profile.id] ?? null;
    if (!community) continue;
    if (!byCommunity.has(community)) byCommunity.set(community, []);
    byCommunity.get(community).push(profile.id);
  }

  // Big connection sets for the demo users.
  for (const [demoId, community] of Object.entries(DEMO_COMMUNITY)) {
    if (!byId.has(demoId)) continue;
    // Alex is the primary browser-demo identity; keep the visible Network
    // count stable instead of letting unrelated vocabulary changes move it.
    const target = demoId === 'alex' ? 39 : 25 + Math.floor(rng() * 16); // 25–40
    const pinned = demoId === 'alex' ? Object.keys(ALEX_PINNED_EXPERIENCES) : [];
    for (const participantId of pinned) add(demoId, participantId, ALEX_PINNED_EXPERIENCES[participantId]);
    const remaining = target - pinned.length;
    const same = (byCommunity.get(community) ?? []).filter((id) => id !== demoId && !pinned.includes(id));
    const other = profiles
      .filter((profile) => profile.id !== demoId && profile.community && profile.community !== community && !pinned.includes(profile.id))
      .map((profile) => profile.id);
    const primary = pickN(same, Math.min(same.length, Math.floor(remaining * 0.75)));
    const secondary = pickN(other, Math.max(0, remaining - primary.length));
    for (const pid of [...primary, ...secondary]) add(demoId, pid);
  }

  // Lighter connection webs among the generated people.
  for (const profile of profiles) {
    if (!profile.synthetic || !profile.community) continue;
    const target = 2 + Math.floor(rng() * 5); // 2–6
    const same = (byCommunity.get(profile.community) ?? []).filter((id) => id !== profile.id);
    const other = profiles
      .filter((candidate) => candidate.id !== profile.id && candidate.community && candidate.community !== profile.community)
      .map((candidate) => candidate.id);
    const primary = pickN(same, Math.min(same.length, Math.max(1, Math.floor(target * 0.7))));
    const secondary = pickN(other, Math.max(0, target - primary.length));
    for (const pid of [...primary, ...secondary]) add(profile.id, pid);
  }

  return [...bag.values()];
}

function assignEvents(profiles, events) {
  // Each attendee gets 1–3 events they've been to; existing 11 people keep
  // their existing rosters. Orphan profiles (no interests or skills) also
  // stay off every roster so they sit on the outer ring of the graph.
  const rosters = new Map(events.map((event) => [event.id, new Set(event.participantIds ?? [])]));
  for (const profile of profiles) {
    if (!profile.synthetic) continue;
    const isOrphan = (profile.interests?.length ?? 0) === 0 && (profile.skills?.length ?? 0) === 0;
    if (isOrphan) continue;
    const eventCount = 1 + Math.floor(rng() * 3);
    const targets = pickN(events, eventCount);
    for (const event of targets) rosters.get(event.id).add(profile.id);
  }
  return events.map((event) => ({ ...event, participantIds: [...rosters.get(event.id)] }));
}

function toMatchingProfile(profile) {
  return {
    userId: profile.id,
    name: profile.name,
    bio: profile.bio ?? '',
    interests: profile.interests ?? [],
    skills: profile.skills ?? [],
    lookingFor: profile.lookingFor ?? [],
    networkingGoal: (profile.goals ?? []).join('; ').slice(0, 240),
    domains: profile.domains ?? [],
    experiences: profile.experiences ?? [],
  };
}

function scorePair(a, b) {
  const routes = experienceRoutes(toMatchingProfile(a), toMatchingProfile(b));
  const result = chooseResult(toMatchingProfile(a), toMatchingProfile(b), routes);
  return result;
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection('profiles').createIndex({ id: 1 }, { unique: true }),
    db.collection('profiles').createIndex({ interests: 1 }),
    db.collection('profiles').createIndex({ skills: 1 }),
    db.collection('events').createIndex({ id: 1 }, { unique: true }),
    db.collection('events').createIndex({ participantIds: 1 }),
    db.collection('connections').createIndex({ ownerId: 1 }),
    db.collection('connections').createIndex(
      { ownerId: 1, participantId: 1 },
      { unique: true, partialFilterExpression: { ownerId: { $type: 'string' }, participantId: { $type: 'string' } } },
    ),
    db.collection('connections').createIndex({ userA: 1, userB: 1 }),
    db.collection('assessments').createIndex({ pairKey: 1 }, { unique: true }),
    db.collection('assessments').createIndex({ score: -1 }),
  ]);
}

async function upsertMany(collection, docs, keyField = 'id') {
  if (docs.length === 0) return;
  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { [keyField]: doc[keyField] },
      update: { $set: doc },
      upsert: true,
    },
  }));
  await collection.bulkWrite(ops, { ordered: false });
}

async function upsertConnections(collection, connections) {
  if (connections.length === 0) return;
  const ops = connections.map((connection) => ({
    updateOne: {
      filter: { ownerId: connection.ownerId, participantId: connection.participantId },
      update: { $set: { ...connection, seeded: true } },
      upsert: true,
    },
  }));
  await collection.bulkWrite(ops, { ordered: false });
}

async function main() {
  const startedAt = Date.now();
  const demoSeed = await loadDemoSeed();

  // Keep the 11 existing demo people unchanged, apart from tagging their
  // community so the graph can color them.
  const existingIds = new Set(demoSeed.profiles.map((profile) => profile.id));
  const profiles = demoSeed.profiles.map((profile) => ({
    ...profile,
    community: DEMO_COMMUNITY[profile.id] ?? null,
    synthetic: false,
  }));

  // Generate additional attendees up to the target.
  const additional = Math.max(0, TARGET_ATTENDEES - profiles.length);
  for (let i = 0; i < additional; i += 1) {
    profiles.push(synthesizeProfile(i, existingIds));
  }

  // Events: existing + several past events.
  let events = [...demoSeed.events, ...generatePastEvents(18)];
  events = assignEvents(profiles, events);

  // Rules-scored assessments for every pair at or above the threshold.
  const assessments = [];
  const now = new Date().toISOString();
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const a = profiles[i];
      const b = profiles[j];
      const result = scorePair(a, b);
      if (result.score >= MATCH_THRESHOLD) {
        const [userA, userB] = [a.id, b.id].sort();
        assessments.push({
          pairKey: `${userA}:${userB}`,
          userA,
          userB,
          score: result.score,
          route: result.route ?? null,
          reason: result.reason,
          source: 'rules',
          audience: 'network',
          eventId: null,
          fingerprint: null,
          version: `web-${RUBRIC_VERSION}-seed`,
          savedAt: now,
        });
      }
    }
    if (i > 0 && i % 100 === 0) {
      console.log(`  scored ${i}/${profiles.length} people (${assessments.length} matches so far)`);
    }
  }

  // Build the connection graph after events so we can attach event context.
  const connections = generateConnections(profiles, events);

  const db = await getDb();
  console.log(`Connected to ${db.databaseName}. Seeding ${profiles.length} people, ${events.length} events, ${connections.length} connections, ${assessments.length} rules-scored matches.`);

  await ensureIndexes(db);
  // Replace synthetic content but keep any real user-owned connections in
  // place if they aren't part of the seeded set below.
  await db.collection('profiles').deleteMany({ synthetic: true });
  await db.collection('events').deleteMany({ id: { $regex: '^past-' } });
  await db.collection('assessments').deleteMany({ source: 'rules' });
  await db.collection('connections').deleteMany({ seeded: true });
  // Remove records from the pre-owner schema. Keeping them would materialize
  // a second copy beside the owner-scoped connection seeded below.
  await db.collection('connections').deleteMany({
    $or: [{ ownerId: { $exists: false } }, { participantId: { $exists: false } }],
  });

  await upsertMany(db.collection('profiles'), profiles);
  await upsertMany(db.collection('events'), events);
  // Connections use ownerId + participantId as their identity, so re-seeding
  // is idempotent.
  await upsertConnections(db.collection('connections'), connections);
  await upsertMany(db.collection('assessments'), assessments, 'pairKey');

  const counts = {
    profiles: await db.collection('profiles').countDocuments(),
    events: await db.collection('events').countDocuments(),
    connections: await db.collection('connections').countDocuments(),
    assessments: await db.collection('assessments').countDocuments(),
  };
  console.log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s. Counts:`, counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromMongoDB();
  });
