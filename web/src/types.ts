export interface Profile {
  id: string;
  name: string;
  role: string;
  bio: string;
  interests: string[];
  skills: string[];
  lookingFor: string[];
  avatar: string;
  location: string;
  distance: number;
  contact?: string;
  linkedin?: string;
  website?: string;
  email?: string;
  visibility?: {
    bio: boolean;
    interests: boolean;
    skills: boolean;
    lookingFor: boolean;
    contact: boolean;
    linkedin?: boolean;
    website?: boolean;
    email?: boolean;
    previousConnections: boolean;
    activeInEvent: boolean;
  };
}
export interface Match {
  userA: string;
  userB: string;
  compatible: boolean;
  score: number;
  reason: string;
  source: "mock" | "precomputed";
}
export interface Connection {
  ownerId?: string;
  participantId?: string;
  userA: string;
  userB: string;
  eventId: string;
  createdAt: string;
  reason?: string;
  sharedInterests?: string[];
  notes?: string;
  followUp?: "none" | "needed" | "contacted";
  reminderDate?: string;
}
export interface Event {
  id: string;
  code: string;
  name: string;
  description: string;
  location: string;
  date: string;
  time: string;
  status: string;
}
export interface Session {
  id: string;
  code: string | null;
  userId: string;
  calibrated: boolean;
}
export interface State {
  profiles: Profile[];
  events: Event[];
  connections: Connection[];
  matches: Match[];
  session: Session | null;
  demo: boolean;
}
export type Action = (
  path: string,
  body?: unknown,
  method?: string,
) => Promise<State>;
