import { readFileSync } from 'node:fs';
import { validateFollowUpInput } from './follow-up.mjs';
const seed = JSON.parse(readFileSync(new URL('../shared/demo-data.json', import.meta.url), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('../shared/recap-demo.json', import.meta.url), 'utf8'));

function fail(status, message) { throw Object.assign(new Error(message), { status }); }

export function followUpContext(body, snapshot = null) {
  const isDemo = snapshot === null;
  const allowed = isDemo ? ['participantId', 'notes', 'style'] : ['participantId', 'eventId', 'notes', 'style'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(field => !allowed.includes(field))) fail(400, 'Invalid follow-up fields');
  if (typeof body.participantId !== 'string') fail(400, 'A person is required');
  let sender, recipient, event, relationship;
  if (isDemo) {
    const person = demo.people.find(item => item.id === body.participantId);
    if (!person) fail(404, 'Example person unavailable');
    sender = seed.profiles.find(profile => profile.id === demo.ownerId);
    recipient = seed.profiles.find(profile => profile.id === person.id);
    event = seed.events.find(item => item.id === demo.eventId);
    relationship = person.relationship;
  } else {
    const ownerId = snapshot.session.userId;
    const connection = snapshot.connections.find(item => item.ownerId === ownerId && item.participantId === body.participantId && item.eventId === body.eventId);
    if (!connection) fail(403, 'Save or connect with this person at this event first');
    sender = snapshot.profiles.find(item => item.id === ownerId);
    recipient = snapshot.profiles.find(item => item.id === body.participantId);
    event = snapshot.events.find(item => item.id === body.eventId);
    relationship = snapshot.connectionRequests.some(item => item.status === 'accepted' && ((item.senderId === ownerId && item.recipientId === body.participantId) || (item.recipientId === ownerId && item.senderId === body.participantId))) ? 'connected' : 'saved';
    if (recipient?.visibility?.previousConnections === false) fail(403, 'This profile is no longer shared');
  }
  if (!sender || !recipient || !event) fail(404, 'Connection unavailable');
  const senderTopics = sender.visibility?.interests === false ? [] : sender.interests;
  const recipientTopics = new Set((recipient.visibility?.interests === false ? [] : recipient.interests).map(topic => topic.trim().toLocaleLowerCase('en-US')));
  return validateFollowUpInput({ eventName: event.name, senderName: sender.name, recipientName: recipient.name,
    sharedInterests: senderTopics.filter(topic => recipientTopics.has(topic.trim().toLocaleLowerCase('en-US'))).slice(0, 10),
    notes: body.notes, relationship, style: body.style });
}
