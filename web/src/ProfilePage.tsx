import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ContactRound, Database, Download, Eye, EyeOff, Focus, Glasses, LogOut, Pencil, Plus, SlidersHorizontal, UserRound, X } from "lucide-react";
import contract from "../shared/profile-contract.json";
import type { Action, Profile, ProfileExperience, State } from "./types";
import { Avatar, Button, Chip, PageHeader, PanelHeader, TextAction, Toggle } from "./ui";
import { NearbyProfile, ProfilePreview } from "./ProfilePreview";
import { prepareProfilePhoto } from "./profilePhoto";
import { profileSectionFromHash, profileSections, visibilityOf } from "./profileEditor";
import type { EditableField, EditorSnapshot, ProfileEditor, ProfileSection, TopicField, VisibilityField } from "./profileEditor";
import "./ProfilePage.css";

const labels = { about: "About", focus: "Focus", contact: "Contact", settings: "Settings" };
const skills = ["Computer vision", "Interaction design", "Frontend development", "Prototyping", "Embedded systems", "Python", "Unity"];
const domains = ["Assistive technology", "Climate tech", "Creative tools", "Education", "Healthcare", "Robotics"];
interface Props {
  state: State; user: Profile; act: Action; busy: boolean; notify: (message: string) => void;
  solid: boolean; setSolid: (value: boolean) => void; logout: () => void;
  editor: ProfileEditor; snapshot: EditorSnapshot;
}

export function ProfileProduct({ state, user, act, busy, notify, solid, setSolid, logout, editor, snapshot }: Props) {
  const [section, setSection] = useState<ProfileSection>(() => profileSectionFromHash(location.hash));
  const [preview, setPreview] = useState(false);
  const [previewAudience, setPreviewAudience] = useState<"room" | "connection">("room");
  const [sounds, setSounds] = useState(() => { try { return localStorage.getItem("questmatch-sounds") === "true"; } catch { return false; } });
  const [preferenceError, setPreferenceError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const photoRevision = useRef(0);
  const focusRef = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<Partial<Record<ProfileSection, HTMLButtonElement | null>>>({});
  const internalTab = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const saveStatusRef = useRef<HTMLDivElement>(null);
  const { draft, errors, saving, saved, failure } = snapshot;
  const visible = visibilityOf(draft);
  const dirty = editor.dirty(section);
  const anyDirty = profileSections.some(tab => editor.dirty(tab));

  useEffect(() => () => { photoRevision.current += 1; }, [editor]);
  const choosePhoto = async (file: File) => {
    const revision = ++photoRevision.current;
    setPhotoBusy(true); setPhotoError("");
    try {
      const avatar = await prepareProfilePhoto(file);
      if (revision === photoRevision.current) editor.change("avatar", avatar);
    } catch (error) {
      if (revision === photoRevision.current) setPhotoError(error instanceof Error ? error.message : "Couldn’t read this photo. Try another image.");
    } finally { if (revision === photoRevision.current) setPhotoBusy(false); }
  };

  useEffect(() => {
    const change = () => setSection(profileSectionFromHash(location.hash));
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (section === "focus" && !internalTab.current) focusRef.current?.focus({ preventScroll: true });
    internalTab.current = false;
    tabRefs.current[section]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [section]);

  const focusTopicError = () => {
    const field = (["interests", "skills", "lookingFor"] as const).find(key => editor.getSnapshot().errors[key]);
    requestAnimationFrame(() => { if (field) document.getElementById(`pe-${field}`)?.focus(); });
  };
  const select = (next: ProfileSection) => {
    if (next === section) return true;
    if (section === "focus" && !editor.commitTopics()) { focusTopicError(); return false; }
    internalTab.current = true;
    location.hash = `/profile?section=${next}`;
    return true;
  };
  const openPreview = (audience: "room" | "connection" = "room") => {
    if (!editor.commitTopics()) {
      setSection("focus"); location.hash = "/profile?section=focus"; focusTopicError(); return;
    }
    setPreviewAudience(audience);
    setPreview(true);
  };
  const save = async () => {
    if (photoBusy) return;
    const focusedAction = document.activeElement instanceof HTMLElement && !!document.activeElement.closest(".pe-save-actions");
    if (!await editor.save(section, act)) {
      const field = Object.keys(editor.getSnapshot().errors).find(key => formRef.current?.querySelector(`#pe-${key}`));
      if (field) formRef.current?.querySelector<HTMLElement>(`#pe-${field}`)?.focus();
    } else if (focusedAction) {
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) saveStatusRef.current?.focus({ preventScroll: true });
      });
    }
  };
  const share = (field: VisibilityField, label: string) => <div className="pe-sharing">
    <label className="pe-check"><input type="checkbox" checked={visible[field]} onChange={event => editor.share(field, event.target.checked)} aria-label={label} /><span>Show on my profile</span></label>
  </div>;
  const field = (key: keyof typeof contract.stringLimits, label: string, placeholder?: string, type = "text", optional = true) => <div className="pe-field">
    <label htmlFor={`pe-${key}`}>{label}</label>
    <input id={`pe-${key}`} name={key} type={type} value={draft[key] || ""} maxLength={contract.stringLimits[key]} placeholder={placeholder} required={!optional} autoComplete={key === "name" ? "name" : key === "email" ? "email" : "off"} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `pe-${key}-error` : undefined} onChange={event => editor.change(key, event.target.value)} />
    <FieldError field={key} message={errors[key]} />
  </div>;
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ profile: user, connections: state.connections.filter(connection => (connection.ownerId ?? connection.userA) === user.id) }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "catalyst-my-information.json"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Your saved information was exported.");
  };

  return <div className="pe-page">
    <PageHeader className="pe-page-heading" title="Profile" description="Share what makes you, you. Give people a reason to say hello." action={<TextAction icon={<Eye size={16} />} iconPosition="start" onClick={() => openPreview(section === "contact" ? "connection" : "room")}>Preview full profile</TextAction>} />
    <div className="pe-tabs" role="tablist" aria-label="Profile sections">
      {profileSections.map(tab => <button key={tab} ref={element => { tabRefs.current[tab] = element; }} id={`pe-tab-${tab}`} type="button" role="tab" aria-selected={section === tab} aria-controls={`pe-panel-${tab}`} tabIndex={section === tab ? 0 : -1} onClick={() => select(tab)} onKeyDown={event => {
        const index = profileSections.indexOf(tab);
        const next = event.key === "ArrowRight" ? profileSections[(index + 1) % 4] : event.key === "ArrowLeft" ? profileSections[(index + 3) % 4] : event.key === "Home" ? "about" : event.key === "End" ? "settings" : null;
        if (next) { event.preventDefault(); if (select(next)) tabRefs.current[next]?.focus(); }
      }}>{labels[tab]}{editor.dirty(tab) && <span className="pe-dirty-dot"><span className="sr-only"> — Unsaved changes</span></span>}</button>)}
    </div>
    {!snapshot.storageAvailable && <p className="pe-storage-note" role="status">Your draft stays here while you navigate. Browser storage is unavailable, so save before refreshing.</p>}
    <div className={`pe-layout ${section === "about" || section === "focus" ? "pe-with-preview" : ""}`}>
      <div className="pe-editor-column" role="tabpanel" id={`pe-panel-${section}`} aria-labelledby={`pe-tab-${section}`}>
        <form className="pe-panel pe-editor" ref={formRef} noValidate onSubmit={event => { event.preventDefault(); void save(); }} onFocusCapture={event => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.closest(".pe-panel-body")) return;
          requestAnimationFrame(() => {
            const footer = formRef.current?.querySelector(".pe-save-footer");
            if (!target.isConnected || !footer) return;
            const control = target.getBoundingClientRect(), bar = footer.getBoundingClientRect();
            if (control.bottom > bar.top && control.top < bar.bottom) target.scrollIntoView({ block: "center" });
          });
        }}>
          <div className="pe-panel-body">
            {section === "about" && <>
              <PanelHeading title="About you" icon={<UserRound size={19} />} description="The first things people see when you meet." />
              <div className="pe-identity"><div className="pe-photo-wrap"><Avatar key={draft.avatar} profile={draft} size="large" /><button id="pe-avatar" type="button" className="pe-photo-edit" aria-label="Upload profile photo" title="Change photo" disabled={photoBusy} onClick={() => photoInput.current?.click()}><Pencil size={13} /></button></div><div><strong>{draft.name || "Your name"}</strong>{photoBusy && <span role="status">Preparing photo…</span>}</div><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Choose profile photo" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void choosePhoto(file); }} /></div>
              {photoError && <p className="pe-photo-error" role="alert">{photoError}</p>}
              <div className="pe-field-grid">{field("name", "Name", "Your name", "text", false)}{field("role", "Headline", "e.g. Hardware engineer")}</div>
              {field("location", "Location", "e.g. Atlanta, GA")}
              <p className="pe-help">Name, headline, and location appear on your saved-connection profile. Add your interests and what you’re working on in <button type="button" className="pe-inline-link" onClick={() => select("focus")}>Focus</button>.</p>
            </>}
            {section === "focus" && <>
              <PanelHeading title="Your focus" icon={<Focus size={19} />} description="Help the right people find a reason to connect." />
              <div className="pe-field"><label htmlFor="pe-bio">Current focus</label><textarea ref={focusRef} id="pe-bio" name="bio" rows={4} maxLength={contract.stringLimits.bio} value={draft.bio} placeholder="What are you working on or exploring?" aria-invalid={!!errors.bio} aria-describedby="pe-bio-help pe-bio-error" onChange={event => editor.change("bio", event.target.value)} /><div className="pe-field-meta"><span id="pe-bio-help">This also appears in Your focus on Home.</span><span>{draft.bio.length}/{contract.stringLimits.bio}</span></div><FieldError field="bio" message={errors.bio} />{share("bio", "Share current focus")}</div>
              {([ ["interests", "Interests", "Topics you’d enjoy talking about.", ["Robotics", "Design", "Open source", "Spatial computing"]], ["skills", "I can help with", "Skills or experience you can share.", skills], ["lookingFor", "I’m looking for help with", "Expertise you’d like to meet someone for.", skills] ] as const).map(([key, label, help, suggestions]) => <div className="pe-focus-group" key={key}><TopicInput field={key} label={label} help={help} suggestions={suggestions} editor={editor} snapshot={snapshot} />{share(key, `Share ${label}`)}</div>)}
              <fieldset className="pe-goals"><legend>What would make this event useful?</legend><p className="pe-help">Choose up to three goals.</p><div className="pe-goal-options">{[...new Set(["Collaboration", "Feedback", "Learning", "Exchanging expertise", "Finding a team", ...(draft.goals ?? [])])].map(goal => {
                const goals = draft.goals ?? [];
                const selected = goals.includes(goal);
                return <button key={goal} type="button" className="chip chip--interactive" aria-pressed={selected} disabled={!selected && goals.length >= 3} onClick={() => editor.change("goals", selected ? goals.filter(value => value !== goal) : [...goals, goal])}>{goal}</button>;
              })}</div><FieldError field="goals" message={errors.goals} />{share("goals", "Share event goals")}</fieldset>
              <div className="pe-focus-group"><TopicInput field="domains" label="Domains" help="Fields or industries where you have context." suggestions={domains} editor={editor} snapshot={snapshot} />{share("domains", "Share domains")}</div>
              <div className="pe-focus-group pe-experiences"><div className="pe-section-label"><div><h3>Past experiences</h3><p className="pe-help">Add professional or personal experiences that may create common ground.</p></div><button type="button" className="pe-add-experience" disabled={(draft.experiences?.length ?? 0) >= contract.experienceLimit} onClick={() => editor.change("experiences", [...(draft.experiences ?? []), { category: "professional", kind: "", label: "" }])}><Plus size={16} />Add experience</button></div>
                {(draft.experiences ?? []).map((experience, index) => <ExperienceRow key={index} experience={experience} index={index} onChange={next => editor.change("experiences", (draft.experiences ?? []).map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => editor.change("experiences", (draft.experiences ?? []).filter((_, itemIndex) => itemIndex !== index))} invalid={!!errors.experiences} />)}
                <FieldError field="experiences" message={errors.experiences} />{share("experiences", "Share past experiences")}
              </div>
              <p className="pe-help">Shared profile information is used to explain common ground and compatibility with Gemini. Contact details and private notes are excluded.</p>
            </>}
            {section === "contact" && <>
              <PanelHeading title="Contact details" icon={<ContactRound size={19} />} description="Keep your contact information up to date." />
              {([ ["linkedin", "LinkedIn", "https://www.linkedin.com/in/you", "url"], ["website", "Website", "https://your-website.com", "url"], ["email", "Email", "you@example.com", "email"] ] as const).map(([key, label, placeholder, type]) => <div className="pe-contact-group" key={key}>{field(key, label, placeholder, type)}</div>)}
              <div className="pe-contact-group">{field("contact", "Other contact", "Another way to reach you")}</div>
              <p className="pe-help">{visible.previousConnections ? "People you remember from an event can see the contact details you add here." : "Your contact details are hidden from people you met."} <button type="button" className="pe-inline-link" onClick={() => select("settings")}>Manage access</button>. Other event attendees can’t see these details. They aren’t used for matching.</p>
            </>}
            {section === "settings" && <>
              <PanelHeading title="Visibility" icon={<Eye size={19} />} description="Choose where your profile can be discovered." />
              <Setting title="Show me in rooms" description="Make your shared introduction available to people in your room."><Toggle label="Show me in rooms" checked={visible.activeInEvent} onChange={() => editor.share("activeInEvent", !visible.activeInEvent)} /></Setting>
              <Setting title="Access for people you’ve met" description="Let people you remember from an event see your shared profile and contact details."><Toggle label="Access for people you’ve met" checked={visible.previousConnections} onChange={() => editor.share("previousConnections", !visible.previousConnections)} /></Setting>
              <p className="pe-help">Individual profile sharing choices live beside your fields in Focus. Hidden fields stay in your profile.</p>
            </>}
          </div>
          <footer className={`pe-save-footer${!dirty && saving !== section && failure?.section !== section ? " pe-save-footer--quiet" : ""}`}>
            <div ref={saveStatusRef} className="pe-save-status" role="status" tabIndex={-1}>{saving === section ? "Saving…" : dirty ? "Unsaved changes" : saved === section ? <><Check size={15} />Saved</> : null}</div>
            {(dirty || saving === section || failure?.section === section) && <div className="pe-save-actions"><TextAction disabled={!dirty || !!saving || photoBusy} onClick={() => { editor.discard(section); setPhotoError(""); tabRefs.current[section]?.focus({ preventScroll: true }); }}>Discard changes</TextAction><Button type="submit" busy={saving === section} disabled={!dirty || !!saving || photoBusy}>Save changes</Button></div>}
            {failure?.section === section && <p className="pe-save-error" role="alert">{failure.message}</p>}
          </footer>
        </form>
        {section === "settings" && <>
          <section className="pe-panel pe-settings-panel"><PanelHeading title="Preferences" icon={<SlidersHorizontal size={19} />} description="Applies immediately on this browser." />
            <Setting title="Reduce transparency" description="Use more opaque spatial surfaces for easier reading."><Toggle label="Reduce transparency" checked={solid} onChange={() => setSolid(!solid)} /></Setting>
            <Setting title="Match sounds" description="Play a soft sound when a match appears in spatial preview."><Toggle label="Match sounds" checked={sounds} onChange={() => { const next = !sounds; setSounds(next); try { localStorage.setItem("questmatch-sounds", String(next)); setPreferenceError(""); } catch { setPreferenceError("This preference could not be stored on this browser."); } }} /></Setting>
            {preferenceError && <p className="pe-help" role="status">{preferenceError}</p>}
          </section>
          <section className="pe-panel pe-settings-panel"><PanelHeading title="Data and session" icon={<Database size={19} />} />
            <Setting title="Export your information" description="Download your saved profile and connections as JSON."><Button variant="secondary" onClick={exportData}><Download size={16} />Export</Button></Setting>
            <Setting title="Clear event data" description="Remove this event’s saved connections and matches, and leave the room. Keep your profile."><Button variant="secondary" disabled={!state.session?.activeEventId && !state.session?.code} busy={busy} onClick={async () => { try { await act("event-data/clear"); notify("Event data cleared. Your profile is still here."); } catch { /* App reports the action error. */ } }}>Clear event data</Button></Setting>
            <Setting title="Sign out" description="Leave your temporary demo session."><Button variant="secondary" busy={busy} onClick={logout}><LogOut size={16} />Sign out</Button></Setting>
          </section>
          <p className="pe-demo-note">Profiles and sharing choices belong to this local demo. They aren’t a permanent account.</p>
        </>}
      </div>
      {(section === "about" || section === "focus") && <aside className="pe-preview-rail pe-panel" aria-label="Nearby profile preview"><PanelHeading title="In the room" icon={<Glasses size={19} />} description={visible.activeInEvent ? "Your name, headline, and shared interests at a glance." : "You can change room visibility in Settings."} /><NearbyProfile profile={draft} /><TextAction icon={visible.activeInEvent ? <Eye size={16} /> : <EyeOff size={16} />} iconPosition="start" onClick={() => openPreview("room")}>Preview room view</TextAction></aside>}
    </div>
    {preview && <ProfilePreview initialAudience={previewAudience} profile={draft} profiles={state.profiles} dirty={anyDirty} onClose={() => setPreview(false)} />}
  </div>;
}

function ExperienceRow({ experience, index, onChange, onRemove, invalid }: { experience: ProfileExperience; index: number; onChange: (experience: ProfileExperience) => void; onRemove: () => void; invalid: boolean }) {
  return <div className="pe-experience-row">
    <div className="pe-experience-heading"><strong>Experience {index + 1}</strong><button type="button" aria-label={`Remove experience ${index + 1}`} onClick={onRemove}><X size={16} />Remove</button></div>
    <div className="pe-experience-grid">
      <label>Category<select aria-label={`Experience ${index + 1} category`} value={experience.category} onChange={event => onChange({ ...experience, category: event.target.value as ProfileExperience["category"] })}><option value="professional">Professional</option><option value="personal">Personal</option></select></label>
      <label>Kind<input aria-label={`Experience ${index + 1} kind`} value={experience.kind} maxLength={contract.topicItemLimit} placeholder="e.g. Hackathon" aria-invalid={invalid} onChange={event => onChange({ ...experience, kind: event.target.value })} /></label>
      <label className="pe-experience-label">Label<input aria-label={`Experience ${index + 1} label`} value={experience.label} maxLength={contract.topicItemLimit} placeholder="Name or short description" aria-invalid={invalid} onChange={event => onChange({ ...experience, label: event.target.value })} /></label>
      <label>Year<input type="number" inputMode="numeric" aria-label={`Experience ${index + 1} year`} value={experience.year ?? ""} min={contract.experienceYearMin} max={new Date().getFullYear()} aria-invalid={invalid} onChange={event => onChange({ ...experience, year: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
    </div>
  </div>;
}
function PanelHeading({ title, description, icon }: { title: string; description?: string; icon: ReactNode }) {
  return <PanelHeader className="pe-panel-heading" title={title} description={description} icon={icon} />;
}
function Setting({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="pe-setting"><div><h3>{title}</h3><p>{description}</p></div><div className="pe-setting-control">{children}</div></div>;
}
function FieldError({ field, message }: { field: EditableField; message?: string }) {
  return <span id={`pe-${field}-error`} className="pe-field-error" role={message ? "alert" : undefined}>{message}</span>;
}
function TopicInput({ field, label, help, suggestions, editor, snapshot }: { field: TopicField; label: string; help: string; suggestions: readonly string[]; editor: ProfileEditor; snapshot: EditorSnapshot }) {
  const values = snapshot.draft[field] ?? [];
  const text = snapshot.topicText[field];
  return <div className="pe-field pe-topic-field"><label htmlFor={`pe-${field}`}>{label}</label><p className="pe-help" id={`pe-${field}-help`}>{help}</p>
    <div className="pe-topic-control"><div className="pe-topic-tags">{values.map((value, index) => <Chip key={`${value}-${index}`} className="chip--editable pe-topic-tag">{value}<button type="button" aria-label={`Remove ${value} from ${label}`} onClick={() => editor.change(field, values.filter((_, i) => i !== index))}><X size={14} /></button></Chip>)}</div>
      <div className="pe-topic-entry"><input id={`pe-${field}`} value={text} placeholder="Add a topic…" aria-invalid={!!snapshot.errors[field]} aria-describedby={`pe-${field}-help pe-${field}-error`} onChange={event => editor.typeTopic(field, event.target.value)} onBlur={() => { if (text.trim()) editor.commitTopic(field); }} onKeyDown={event => {
        if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent.isComposing) { event.preventDefault(); editor.commitTopic(field); }
        if (event.key === "Backspace" && !text && values.length) { event.preventDefault(); editor.change(field, values.slice(0, -1)); editor.typeTopic(field, values[values.length - 1]); }
      }} /><button type="button" className="pe-add-topic" aria-label={`Add topic to ${label}`} disabled={!text.trim()} onMouseDown={event => event.preventDefault()} onClick={() => editor.commitTopic(field)}><Plus size={16} />Add</button></div>
    </div><FieldError field={field} message={snapshot.errors[field]} />
    <div className="pe-suggestions"><span>Try</span>{suggestions.filter(item => !values.some(value => value.toLowerCase() === item.toLowerCase())).slice(0, 3).map(item => <button className="chip chip--interactive" key={item} type="button" disabled={values.length >= contract.topicLimit} onClick={() => { const pending = editor.getSnapshot().topicText[field]; if (!pending.trim() || editor.commitTopic(field)) editor.commitTopic(field, item); }}>{item}<Plus size={12} /></button>)}</div>
  </div>;
}
