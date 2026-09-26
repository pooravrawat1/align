import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../shared/demo-data.json' with { type: 'json' };
import { ProfileEditor, addTopic, profileSectionFromHash, sectionPatch, validateSection, visibilityOf } from '../src/profileEditor.ts';

const profile = () => structuredClone(seed.profiles[0]);
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values }; };
function api(initial) {
  let saved = structuredClone(initial);
  const requests = [];
  return { requests, get saved() { return saved; }, act: async (_path, patch) => {
    requests.push(patch);
    saved = { ...saved, ...patch, visibility: { ...visibilityOf(saved), ...patch.visibility } };
    for (const field of ['name', 'role', 'bio', 'location', 'email', 'website', 'linkedin']) if (typeof saved[field] === 'string') saved[field] = saved[field].trim();
    return { profiles: [saved] };
  } };
}

test('section saves exclude invalid edits and visibility from other sections', async () => {
  const source = profile(), editor = new ProfileEditor(source, 'session', memory()), service = api(source);
  editor.change('name', 'Alex Updated'); editor.change('email', 'invalid'); editor.share('email', true); editor.change('bio', 'New focus');
  assert.equal(await editor.save('about', service.act), true);
  assert.deepEqual(service.requests, [{ name: 'Alex Updated' }]);
  assert.equal(editor.dirty('about'), false); assert.equal(editor.dirty('focus'), true); assert.equal(editor.dirty('contact'), true);
  assert.equal(await editor.save('contact', service.act), false);
  assert.match(editor.getSnapshot().errors.email, /valid email/);
});

test('late saves acknowledge only submitted changes and retain newer keystrokes', async () => {
  const source = profile(), editor = new ProfileEditor(source, 'session', memory());
  let finish;
  editor.change('bio', 'Submitted focus');
  const saving = editor.save('focus', async () => new Promise(resolve => { finish = resolve; }));
  editor.change('bio', 'Newer focus'); editor.change('name', 'New name');
  finish({ profiles: [{ ...source, bio: 'Submitted focus' }] });
  await saving;
  assert.equal(editor.getSnapshot().draft.bio, 'Newer focus'); assert.equal(editor.getSnapshot().draft.name, 'New name');
  assert.equal(editor.dirty('focus'), true);
  assert.equal(editor.getSnapshot().baseline.bio, 'Submitted focus');
});

test('successful canonicalized save clears only acknowledged draft storage', async () => {
  const source = profile(), storage = memory(), editor = new ProfileEditor(source, 'session', storage), service = api(source);
  editor.change('name', '  Alex Updated  '); editor.change('email', 'later@example.com');
  await editor.save('about', service.act);
  assert.equal(editor.getSnapshot().draft.name, 'Alex Updated');
  const restored = new ProfileEditor(service.saved, 'session', storage);
  assert.equal(restored.getSnapshot().draft.email, 'later@example.com');
  assert.equal(restored.dirty('about'), false);
  restored.discard('contact'); assert.equal(storage.values.size, 0);
});

test('reverting a field or sharing switch during a save remains an unsaved edit', async () => {
  const source = profile(), editor = new ProfileEditor(source, 'session', memory());
  let finish;
  editor.change('bio', 'Submitted'); editor.share('bio', false);
  const saving = editor.save('focus', async () => new Promise(resolve => { finish = resolve; }));
  editor.change('bio', source.bio); editor.share('bio', true);
  const response = { ...source, bio: 'Submitted', visibility: { ...visibilityOf(source), bio: false } };
  // Exercise App rebasing before the save promise resolves as well as acknowledgement.
  editor.rebase(response); finish({ profiles: [response] }); await saving;
  assert.equal(editor.getSnapshot().draft.bio, source.bio);
  assert.equal(editor.getSnapshot().draft.visibility.bio, true);
  assert.equal(editor.dirty('focus'), true);
});

test('drafts and pending topic text restore only for the same session and person', () => {
  const source = profile(), storage = memory(), editor = new ProfileEditor(source, 'session-a', storage);
  editor.change('bio', 'Unsaved focus'); editor.typeTopic('skills', 'New expertise');
  const restored = new ProfileEditor(source, 'session-a', storage);
  assert.equal(restored.getSnapshot().draft.bio, 'Unsaved focus'); assert.equal(restored.getSnapshot().topicText.skills, 'New expertise');
  assert.equal(new ProfileEditor(source, 'session-b', storage).getSnapshot().draft.bio, source.bio);
  assert.equal(new ProfileEditor({ ...source, id: 'other' }, 'session-a', storage).getSnapshot().draft.bio, source.bio);
});

test('discarding one section preserves another and an in-flight disposed owner cannot recreate storage', async () => {
  const source = profile(), storage = memory(), editor = new ProfileEditor(source, 'session', storage);
  editor.change('bio', 'Draft'); editor.change('name', 'Other'); editor.discard('focus');
  assert.equal(editor.getSnapshot().draft.bio, source.bio); assert.equal(editor.getSnapshot().draft.name, 'Other');
  let finish; const saving = editor.save('about', async () => new Promise(resolve => { finish = resolve; }));
  editor.dispose(); finish({ profiles: [{ ...source, name: 'Other' }] }); await saving;
  assert.equal(storage.values.size, 0);
});

test('failed saves and unavailable storage retain edits in memory', async () => {
  const source = profile(), editor = new ProfileEditor(source, 'session', { getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } });
  editor.change('name', 'Retained'); await editor.save('about', async () => { throw new TypeError('offline'); });
  assert.equal(editor.getSnapshot().draft.name, 'Retained'); assert.equal(editor.getSnapshot().storageAvailable, false);
  assert.equal(editor.getSnapshot().saving, null); assert.match(editor.getSnapshot().failure.message, /edits are here/);
});

test('topics enforce shared bounds, explain duplicates, and commit before saving', async () => {
  assert.match(addTopic(['Design'], 'design').error, /already/);
  assert.match(addTopic([], 'a'.repeat(81)).error, /80/);
  assert.match(addTopic(Array.from({ length: 20 }, (_, i) => String(i)), 'new').error, /20/);
  const source = profile(), editor = new ProfileEditor(source, 'session', memory()), service = api(source);
  editor.typeTopic('skills', 'New expertise'); await editor.save('focus', service.act);
  assert.ok(service.requests[0].skills.includes('New expertise')); assert.equal(editor.getSnapshot().topicText.skills, '');
});

test('external saved state rebases untouched fields without destroying drafts', () => {
  const source = profile(), editor = new ProfileEditor(source, 'session', memory());
  editor.change('bio', 'Local draft'); editor.rebase({ ...source, name: 'External name', bio: 'External focus' });
  assert.equal(editor.getSnapshot().draft.name, 'External name'); assert.equal(editor.getSnapshot().draft.bio, 'Local draft');
  assert.deepEqual(sectionPatch(editor.getSnapshot().baseline, editor.getSnapshot().draft, 'focus'), { bio: 'Local draft' });
});

test('only name is required; optional fields may clear; routes preserve the settings alias', () => {
  const source = { ...profile(), role: '', bio: '', location: '' };
  assert.deepEqual(validateSection(source, 'about'), {});
  assert.match(validateSection({ ...source, name: '  ' }, 'about').name, /name/);
  assert.equal(profileSectionFromHash('#/settings'), 'settings'); assert.equal(profileSectionFromHash('#/profile?section=focus'), 'focus'); assert.equal(profileSectionFromHash('#/profile?section=invalid'), 'about');
});

test('event goals restore, save with sharing, and discard through the existing focus draft', async () => {
  const source = profile(), storage = memory(), service = api(source);
  const editor = new ProfileEditor(source, 'goals', storage);
  editor.change('goals', ['Collaboration', 'Feedback']);
  editor.share('goals', false);
  const restored = new ProfileEditor(source, 'goals', storage);
  assert.deepEqual(restored.getSnapshot().draft.goals, ['Collaboration', 'Feedback']);
  assert.equal(restored.getSnapshot().draft.visibility.goals, false);
  assert.equal(await restored.save('focus', service.act), true);
  assert.deepEqual(service.saved.goals, ['Collaboration', 'Feedback']);
  assert.equal(service.saved.visibility.goals, false);
  restored.change('goals', ['Learning']);
  restored.discard('focus');
  assert.deepEqual(restored.getSnapshot().draft.goals, ['Collaboration', 'Feedback']);
  restored.change('goals', ['One', 'Two', 'Three', 'Four']);
  assert.equal(await restored.save('focus', service.act), false);
  assert.match(restored.getSnapshot().errors.goals, /three/);
});

test('domains and experiences recover, validate, save visibility, rebase, and discard with focus', async () => {
  const source = profile(), storage = memory(), service = api(source);
  const editor = new ProfileEditor(source, 'matching-fields', storage);
  editor.typeTopic('domains', 'Accessibility');
  editor.change('experiences', [{ category: 'professional', kind: 'conference', label: 'Inclusive Design Summit', year: 2024 }]);
  editor.share('domains', false); editor.share('experiences', false);
  const restored = new ProfileEditor(source, 'matching-fields', storage);
  assert.equal(restored.getSnapshot().topicText.domains, 'Accessibility');
  assert.deepEqual(restored.getSnapshot().draft.experiences, [{ category: 'professional', kind: 'conference', label: 'Inclusive Design Summit', year: 2024 }]);
  assert.equal(await restored.save('focus', service.act), true);
  assert.deepEqual(service.saved.domains, [...source.domains, 'Accessibility']);
  assert.equal(service.saved.visibility.domains, false);
  assert.equal(service.saved.visibility.experiences, false);
  restored.change('experiences', [{ category: 'personal', kind: 'hiking', label: 'Local trails' }]);
  restored.rebase({ ...service.saved, role: 'External headline' });
  assert.equal(restored.getSnapshot().draft.role, 'External headline');
  assert.equal(restored.getSnapshot().draft.experiences[0].label, 'Local trails');
  restored.discard('focus');
  assert.deepEqual(restored.getSnapshot().draft.experiences, service.saved.experiences);
});

test('experience validation enforces count, required text, lengths, categories, and year bounds', () => {
  const source = profile(), currentYear = new Date().getFullYear();
  assert.match(validateSection({ ...source, experiences: Array.from({ length: 21 }, () => ({ category: 'personal', kind: 'trip', label: 'Trip' })) }, 'focus').experiences, /20/);
  for (const invalid of [
    { category: 'work', kind: 'conference', label: 'Event' },
    { category: 'professional', kind: '', label: 'Event' },
    { category: 'personal', kind: 'trip', label: '' },
    { category: 'personal', kind: 'x'.repeat(81), label: 'Trip' },
    { category: 'personal', kind: 'trip', label: 'Trip', year: 1899 },
    { category: 'personal', kind: 'trip', label: 'Trip', year: currentYear + 1 },
  ]) assert.ok(validateSection({ ...source, experiences: [invalid] }, 'focus').experiences);
  assert.deepEqual(validateSection({ ...source, experiences: [{ category: 'personal', kind: 'trip', label: 'Trip' }, { category: 'professional', kind: 'conference', label: 'Event', year: currentYear }] }, 'focus'), {});
});

test('malformed stored experiences are ignored safely while incomplete typed rows recover', () => {
  const source = profile();
  const malformedStorage = memory();
  malformedStorage.setItem('align-profile-draft:v1:malformed:alex', JSON.stringify({ patch: { experiences: [{ category: 'professional', kind: null, label: 'Event' }] } }));
  const malformed = new ProfileEditor(source, 'malformed', malformedStorage);
  assert.deepEqual(malformed.getSnapshot().draft.experiences, source.experiences);
  assert.doesNotThrow(() => validateSection({ ...source, experiences: [{ category: 'professional', kind: null, label: 'Event' }] }, 'focus'));
  assert.ok(validateSection({ ...source, experiences: [{ category: 'professional', kind: null, label: 'Event' }] }, 'focus').experiences);

  const partialStorage = memory();
  partialStorage.setItem('align-profile-draft:v1:partial:alex', JSON.stringify({ patch: { experiences: [{ category: 'personal', kind: '', label: '', year: 2024 }] } }));
  const partial = new ProfileEditor(source, 'partial', partialStorage);
  assert.deepEqual(partial.getSnapshot().draft.experiences.at(-1), { category: 'personal', kind: '', label: '', year: 2024 });
  assert.ok(validateSection(partial.getSnapshot().draft, 'focus').experiences);
});
