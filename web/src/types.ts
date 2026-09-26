export interface Profile {
  id: string;
  name: string;
  role: string;
  bio: string;
  interests: string[];
  skills: string[];
  lookingFor: string[];
  goals?: string[];
  domains?: string[];
  experiences?: ProfileExperience[];
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
    goals?: boolean;
    domains?: boolean;
    experiences?: boolean;
    contact: boolean;
    linkedin?: boolean;
    website?: boolean;
    email?: boolean;
    previousConnections: boolean;
    activeInEvent: boolean;
  };
}
export interface ProfileExperience {
  category: "professional" | "personal";
  kind: string;
  label: string;
  year?: number;
}
export interface Match {
  userA: string;
  userB: string;
  compatible: boolean;
  score: number | null;
  reason: string;
  source: "gemini" | "fixture" | "rules" | "unavailable" | "precomputed" | "mock";
}
export interface PairAssessment {
  status: "ready" | "partial" | "unavailable";
  score: number | null;
  reason: string;
  commonGround: string[];
  contributions: { userId: string; items: string[] }[];
  starter: string;
  categories: { id: string; label: string; max: number; points: number | null; evidence: string }[];
  source: "gemini" | "fixture" | "rules" | "unavailable";
  route?: "networking" | "professional" | "personal";
  routes?: { networking: number | null; professional: number; personal: number };
  compatible?: boolean;
  error?: string;
  fingerprint?: string;
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
  requestId?: string;
  saved?: boolean;
}
export interface ConnectionRequest {
  id: string;
  senderId: string;
  recipientId: string;
  eventId: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: string;
  updatedAt: string;
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
  participantIds?: string[];
  startsAt?: string;
  endsAt?: string;
  timeZone?: string;
}
export interface Session {
  id: string;
  code: string | null;
  activeEventId?: string | null;
  userId: string;
  calibrated: boolean;
}
export interface State {
  profiles: Profile[];
  events: Event[];
  connections: Connection[];
  matches: Match[];
  connectionRequests?: ConnectionRequest[];
  session: Session | null;
  demo: boolean;
}
export type Action = (
  path: string,
  body?: unknown,
  method?: string,
) => Promise<State>;
