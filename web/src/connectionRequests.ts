import type { ConnectionRequest, State } from './types';

export function requestFor(state: State, userId: string, personId: string): ConnectionRequest | undefined {
  const priority = { accepted: 0, pending: 1, declined: 2, cancelled: 2 };
  return (state.connectionRequests ?? [])
    .filter(request => (request.senderId === userId && request.recipientId === personId) || (request.recipientId === userId && request.senderId === personId))
    .sort((a, b) => priority[a.status] - priority[b.status] || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
}

export function pendingRequests(state: State, userId: string, eventId?: string) {
  return (state.connectionRequests ?? []).filter(request => request.status === 'pending' &&
    (request.senderId === userId || request.recipientId === userId) && (!eventId || request.eventId === eventId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
