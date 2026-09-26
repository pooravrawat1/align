import contract from "../shared/profile-contract.json" with { type: "json" };
import { contactHref } from "./contactDestinations.ts";
import type { Action, Profile } from "./types";

export const profileSections = ["about", "focus", "contact", "settings"] as const;
export type ProfileSection = typeof profileSections[number];
export type TopicField = "interests" | "skills" | "lookingFor";
export type VisibilityField = keyof typeof contract.defaultVisibility;
export type EditableField = keyof typeof contract.stringLimits | TopicField;
export type ProfilePatch = Partial<Pick<Profile, EditableField>> & { visibility?: Partial<Record<VisibilityField, boolean>> };
export type FieldErrors = Partial<Record<EditableField, string>>;
export const sectionFields: Record<ProfileSection, EditableField[]> = {
  about: ["name", "role", "location"],
  focus: ["bio", "interests", "skills", "lookingFor"],
  contact: ["linkedin", "website", "email", "contact"],
  settings: [],
};
const sectionVisibility: Record<ProfileSection, VisibilityField[]> = {
  about: [], focus: ["bio", "interests", "skills", "lookingFor"],
  contact: ["linkedin", "website", "email", "contact"],
  settings: ["activeInEvent", "previousConnections"],
};
export const topicFields: TopicField[] = ["interests", "skills", "lookingFor"];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const visibilityOf = (profile: Profile) => ({ ...contract.defaultVisibility, ...profile.visibility });
const normalize = (profile: Profile): Profile => ({ ...profile, linkedin: profile.linkedin ?? "", website: profile.website ?? "", email: profile.email ?? "", contact: profile.contact ?? "", visibility: visibilityOf(profile) });

export function profileSectionFromHash(hash: string): ProfileSection {
  if (hash.split("?")[0] === "#/settings") return "settings";
  const requested = new URLSearchParams(hash.split("?")[1]).get("section");
  return profileSections.includes(requested as ProfileSection) ? requested as ProfileSection : "about";
}

export function sectionPatch(baseline: Profile, draft: Profile, section: ProfileSection): ProfilePatch {
  const patch: ProfilePatch = {};
  for (const field of sectionFields[section]) {
    if (!same(baseline[field], draft[field])) Object.assign(patch, { [field]: draft[field] });
  }
  const before = visibilityOf(baseline), after = visibilityOf(draft);
  for (const field of sectionVisibility[section]) {
    if (before[field] !== after[field]) patch.visibility = { ...patch.visibility, [field]: after[field] };
  }
  return patch;
}

function mergePatch(profile: Profile, patch: ProfilePatch): Profile {
  return normalize({ ...profile, ...patch, visibility: { ...visibilityOf(profile), ...patch.visibility } });
}

export function validateSection(profile: Profile, section: ProfileSection): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of sectionFields[section]) {
    if (topicFields.includes(field as TopicField)) {
      const values = profile[field as TopicField];
      if (values.length > contract.topicLimit) errors[field] = `Use up to ${contract.topicLimit} topics.`;
      else if (values.some(value => !value.trim() || value.length > contract.topicItemLimit)) errors[field] = `Each topic needs 1–${contract.topicItemLimit} characters.`;
    } else {
      const value = (profile[field] as string | undefined) ?? "";
      const limit = contract.stringLimits[field as keyof typeof contract.stringLimits];
      if (value.length > limit) errors[field] = `Use ${limit} characters or fewer.`;
      else if (field === "name" && !value.trim()) errors.name = "Enter your name.";
      else if ((field === "linkedin" || field === "website" || field === "email") && value.trim() && !contactHref(field, value)) {
        errors[field] = field === "email" ? "Enter one valid email address." : field === "linkedin" ? "Enter a full linkedin.com profile URL." : "Enter a full http:// or https:// URL.";
      }
    }
  }
  return errors;
}

export function addTopic(values: string[], input: string): { values: string[]; error?: string } {
  const value = input.trim().replace(/,$/, "").trim();
  if (!value) return { values };
  if (value.length > contract.topicItemLimit) return { values, error: `Use ${contract.topicItemLimit} characters or fewer for a topic.` };
  if (values.some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) return { values, error: "This topic is already added." };
  if (values.length >= contract.topicLimit) return { values, error: `You can add up to ${contract.topicLimit} topics. Remove one first.` };
  return { values: [...values, value] };
}

export interface EditorSnapshot {
  baseline: Profile;
  draft: Profile;
  topicText: Record<TopicField, string>;
  errors: FieldErrors;
  saving: ProfileSection | null;
  saved: ProfileSection | null;
  failure: { section: ProfileSection; message: string } | null;
  storageAvailable: boolean;
}

interface DraftStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

// One instance belongs to App's current session/profile, including while Profile is unmounted.
export class ProfileEditor {
  private snapshot: EditorSnapshot;
  private listeners = new Set<() => void>();
  private active = true;
  private key: string | null;
  private storage?: DraftStorage;
  constructor(profile: Profile, sessionId: string | null, storage?: DraftStorage) {
    this.storage = storage;
    const baseline = normalize(profile);
    this.key = sessionId ? `align-profile-draft:v1:${sessionId}:${profile.id}` : null;
    this.snapshot = { baseline, draft: baseline, topicText: { interests: "", skills: "", lookingFor: "" }, errors: {}, saving: null, saved: null, failure: null, storageAvailable: !!storage };
    try {
      const raw = this.key && storage?.getItem(this.key);
      if (raw) {
        const stored = JSON.parse(raw);
        const patch: ProfilePatch = {};
        for (const field of Object.values(sectionFields).flat()) {
          const value = stored.patch?.[field];
          if (topicFields.includes(field as TopicField) ? Array.isArray(value) && value.every(v => typeof v === "string") : typeof value === "string") Object.assign(patch, { [field]: value });
        }
        for (const field of Object.keys(contract.defaultVisibility) as VisibilityField[]) {
          if (typeof stored.patch?.visibility?.[field] === "boolean") patch.visibility = { ...patch.visibility, [field]: stored.patch.visibility[field] };
        }
        this.snapshot.draft = mergePatch(baseline, patch);
        for (const field of topicFields) if (typeof stored.topicText?.[field] === "string") this.snapshot.topicText[field] = stored.topicText[field];
      }
    } catch { this.snapshot.storageAvailable = false; }
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(next: Partial<EditorSnapshot>) {
    if (!this.active) return;
    this.snapshot = { ...this.snapshot, ...next };
    this.persist();
    this.listeners.forEach(listener => listener());
  }
  private persist() {
    if (!this.key || !this.storage) return;
    try {
      let patch: ProfilePatch = {};
      for (const section of profileSections) {
        const part = sectionPatch(this.snapshot.baseline, this.snapshot.draft, section);
        patch = { ...patch, ...part, visibility: { ...patch.visibility, ...part.visibility } };
      }
      if (!Object.keys(patch.visibility ?? {}).length) delete patch.visibility;
      if (!Object.keys(patch).length && !Object.values(this.snapshot.topicText).some(Boolean)) this.storage.removeItem(this.key);
      else this.storage.setItem(this.key, JSON.stringify({ patch, topicText: this.snapshot.topicText }));
    } catch { this.snapshot = { ...this.snapshot, storageAvailable: false }; }
  }
  dirty(section: ProfileSection) {
    return Object.keys(sectionPatch(this.snapshot.baseline, this.snapshot.draft, section)).length > 0 || (section === "focus" && Object.values(this.snapshot.topicText).some(Boolean));
  }
  change<K extends EditableField>(field: K, value: Profile[K]) {
    this.emit({ draft: { ...this.snapshot.draft, [field]: value }, errors: { ...this.snapshot.errors, [field]: undefined }, saved: null, failure: null });
  }
  share(field: VisibilityField, value: boolean) {
    this.emit({ draft: { ...this.snapshot.draft, visibility: { ...visibilityOf(this.snapshot.draft), [field]: value } }, saved: null, failure: null });
  }
  typeTopic(field: TopicField, value: string) {
    this.emit({ topicText: { ...this.snapshot.topicText, [field]: value }, errors: { ...this.snapshot.errors, [field]: undefined }, saved: null, failure: null });
  }
  commitTopic(field: TopicField, value = this.snapshot.topicText[field]) {
    const result = addTopic(this.snapshot.draft[field], value);
    this.emit({ draft: { ...this.snapshot.draft, [field]: result.values }, topicText: { ...this.snapshot.topicText, [field]: result.error ? value : "" }, errors: { ...this.snapshot.errors, [field]: result.error }, saved: null });
    return !result.error;
  }
  commitTopics() { return topicFields.map(field => this.commitTopic(field)).every(Boolean); }
  discard(section: ProfileSection) {
    const patch: ProfilePatch = {};
    for (const field of sectionFields[section]) Object.assign(patch, { [field]: this.snapshot.baseline[field] });
    for (const field of sectionVisibility[section]) patch.visibility = { ...patch.visibility, [field]: visibilityOf(this.snapshot.baseline)[field] };
    const errors = { ...this.snapshot.errors };
    sectionFields[section].forEach(field => delete errors[field]);
    this.emit({ draft: mergePatch(this.snapshot.draft, patch), errors, topicText: section === "focus" ? { interests: "", skills: "", lookingFor: "" } : this.snapshot.topicText, saved: null, failure: null });
  }
  rebase(profile: Profile) {
    if (same(normalize(profile), this.snapshot.baseline)) return;
    let draft = normalize(profile);
    for (const section of profileSections) draft = mergePatch(draft, sectionPatch(this.snapshot.baseline, this.snapshot.draft, section));
    this.emit({ baseline: normalize(profile), draft });
  }
  async save(section: ProfileSection, act: Action): Promise<boolean> {
    if (!this.active || this.snapshot.saving) return false;
    if (section === "focus" && !this.commitTopics()) return false;
    const errors = validateSection(this.snapshot.draft, section);
    this.emit({ errors: { ...this.snapshot.errors, ...errors }, failure: null });
    if (Object.keys(errors).length) return false;
    const submitted = this.snapshot.draft;
    const patch = sectionPatch(this.snapshot.baseline, submitted, section);
    if (!Object.keys(patch).length) return true;
    this.emit({ saving: section, saved: null });
    try {
      const response = await act("profile", patch, "PATCH");
      if (!this.active) return false;
      const profile = response.profiles.find(person => person.id === submitted.id);
      if (!profile) throw new Error("Your profile could not be saved. Try again.");
      this.rebase(profile);
      let draft = this.snapshot.draft;
      for (const field of sectionFields[section]) {
        if (field in patch && same(draft[field], submitted[field])) draft = { ...draft, [field]: normalize(profile)[field] };
      }
      for (const field of sectionVisibility[section]) {
        if (field in (patch.visibility ?? {}) && visibilityOf(draft)[field] === visibilityOf(submitted)[field]) draft = { ...draft, visibility: { ...visibilityOf(draft), [field]: visibilityOf(profile)[field] } };
      }
      this.emit({ draft, saving: null, saved: section });
      return true;
    } catch (error) {
      this.emit({ saving: null, failure: { section, message: error instanceof TypeError ? "Couldn’t reach the service. Your edits are here—try saving again." : error instanceof Error ? error.message : "Couldn’t save. Your edits are here—try again." } });
      return false;
    }
  }
  dispose() {
    this.active = false;
    try { if (this.key) this.storage?.removeItem(this.key); } catch { /* In-memory draft is abandoned with this owner. */ }
  }
}
