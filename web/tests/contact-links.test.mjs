import test from 'node:test';
import assert from 'node:assert/strict';
import { contactHref, sharedContactLinks } from '../src/contactDestinations.ts';

const profile = {
  name: 'Test person', linkedin: 'https://www.linkedin.com/in/test-person',
  website: 'https://example.com', email: 'test@example.com',
  visibility: { previousConnections: true, linkedin: true, website: true, email: true },
};

test('only explicitly shared, valid contact destinations are rendered', () => {
  assert.equal(sharedContactLinks(profile).length, 3);
  assert.deepEqual(sharedContactLinks({ ...profile, visibility: undefined }), []);
  assert.deepEqual(sharedContactLinks({ ...profile, visibility: { ...profile.visibility, previousConnections: false } }), []);
  assert.deepEqual(sharedContactLinks({ ...profile, visibility: { email: true } }).map(link => link.kind), ['email']);
});

test('contact links reject executable URLs, credentials, lookalike domains, and email headers', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com', 'not a URL']) {
    assert.equal(contactHref('website', value), null);
  }
  assert.equal(contactHref('linkedin', 'https://linkedin.com.example.com/test'), null);
  assert.equal(contactHref('linkedin', 'https://example.com'), null);
  for (const value of ['test@example.com\r\nBcc:other@example.com', 'one@example.com,two@example.com', 'Test <test@example.com>']) {
    assert.equal(contactHref('email', value), null);
  }
  assert.equal(contactHref('email', ' test@example.com '), 'mailto:test%40example.com');
});
