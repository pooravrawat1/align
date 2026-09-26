import { createHash } from 'node:crypto';

const PROFILE_FIELDS = new Set([
  'userId', 'name', 'bio', 'interests', 'skills', 'lookingFor',
  'networkingGoal', 'domains', 'experiences',
]);
const EXPERIENCE_FIELDS = new Set(['category', 'kind', 'label', 'year']);
const ARRAY_FIELDS = ['interests', 'skills', 'lookingFor', 'domains'];

export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'InputError';
    this.status = status;
  }
}

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalize(value) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}

function rejectUnknownKeys(value, allowed, context) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new InputError(`${context} has unknown field: ${key}`);
  }
}

function limitedString(value, context, limit, required = false) {
  if (typeof value !== 'string') throw new InputError(`${context} must be a string`);
  const result = value.trim();
  if (result.length > limit || /[\u0000-\u001f\u007f]/u.test(result)) {
    throw new InputError(`${context} is too long or contains control characters`);
  }
  if (required && !result) throw new InputError(`${context} is required`);
  return result;
}

function stringList(value, context) {
  if (!Array.isArray(value) || value.length > 20) {
    throw new InputError(`${context} must be an array with at most 20 items`);
  }
  return value.map((item, index) => limitedString(item, `${context}[${index}]`, 80, true));
}

function experience(value, index) {
  const context = `experiences[${index}]`;
  if (!isRecord(value)) throw new InputError(`${context} must be an object`);
  rejectUnknownKeys(value, EXPERIENCE_FIELDS, context);
  if (value.category !== 'professional' && value.category !== 'personal') {
    throw new InputError(`${context}.category must be professional or personal`);
  }
  const result = {
    category: value.category,
    kind: limitedString(value.kind, `${context}.kind`, 80, true),
    label: limitedString(value.label, `${context}.label`, 80, true),
  };
  if (value.year !== undefined) {
    const currentYear = new Date().getUTCFullYear();
    if (!Number.isInteger(value.year) || value.year < 1900 || value.year > currentYear) {
      throw new InputError(`${context}.year must be a past or current calendar year`);
    }
    result.year = value.year;
  }
  return result;
}

export function validateProfile(value) {
  if (!isRecord(value)) throw new InputError('profile must be an object');
  rejectUnknownKeys(value, PROFILE_FIELDS, 'profile');
  const userId = limitedString(value.userId, 'userId', 64, true);
  if (!/^[a-zA-Z0-9_-]+$/u.test(userId)) {
    throw new InputError('userId may contain only letters, digits, underscores, and hyphens');
  }
  const profile = {
    userId,
    name: limitedString(value.name, 'name', 80, true),
    bio: limitedString(value.bio, 'bio', 500),
  };
  for (const field of ARRAY_FIELDS) profile[field] = stringList(value[field], field);
  profile.networkingGoal = limitedString(value.networkingGoal, 'networkingGoal', 240);
  if (!Array.isArray(value.experiences) || value.experiences.length > 20) {
    throw new InputError('experiences must be an array with at most 20 items');
  }
  profile.experiences = value.experiences.map(experience);
  return profile;
}

export function validateMatchRequest(value) {
  if (!isRecord(value)) throw new InputError('request body must be an object');
  rejectUnknownKeys(value, new Set(['profileA', 'profileB']), 'request');
  const first = validateProfile(value.profileA);
  const second = validateProfile(value.profileB);
  if (first.userId === second.userId) throw new InputError('profiles must have distinct userIds');
  return first.userId < second.userId ? [first, second] : [second, first];
}

export function pairCacheKey(profileA, profileB, rubricVersion) {
  return createHash('sha256')
    .update(JSON.stringify([rubricVersion, profileA, profileB]))
    .digest('hex');
}
