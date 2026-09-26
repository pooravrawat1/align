import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Download, Eye, EyeOff, Glasses, LogOut, Plus, X } from "lucide-react";
import contract from "../shared/profile-contract.json";
import type { Action, Profile, State } from "./types";
import { Avatar, Button, Toggle } from "./ui";
import { NearbyProfile, ProfilePreview } from "./ProfilePreview";
import { profileSectionFromHash, profileSections, visibilityOf } from "./profileEditor";
import type { EditableField, EditorSnapshot, ProfileEditor, ProfileSection, TopicField, VisibilityField } from "./profileEditor";
import "./ProfilePage.css";

const labels = { about: "About", focus: "Focus", contact: "Contact", settings: "Settings" };
const skills = ["Computer vision", "Interaction design", "Frontend development", "Prototyping", "Embedded systems", "Python", "Unity"];
interface Props {
  state: State; user: Profile; act: Action; busy: boolean; notify: (message: string) => void;
  solid: boolean; setSolid: (value: boolean) => void; logout: () => void;
  editor: ProfileEditor; snapshot: EditorSnapshot;
}

export function ProfileProduct({ state, user, act, busy, notify, solid, setSolid, logout, editor, snapshot }: Props) {
  const [section, setSection] = useState<ProfileSection>(() => profileSectionFromHash(location.hash));
  const [preview, setPreview] = useState(false);
  const [sounds, setSounds] = useState(() => { try { return localStorage.getItem("questmatch-sounds") === "true"; } catch { return false; } });
  const [preferenceError, setPreferenceError] = useState("");
  const focusRef = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<Partial<Record<ProfileSection, HTMLButtonElement | null>>>({});
  const internalTab = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { draft, errors, saving, saved, failure } = snapshot;
  const visible = visibilityOf(draft);
  const dirty = editor.dirty(section);
  const anyDirty = profileSections.some(tab => editor.dirty(tab));

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

  const select = (next: ProfileSection) => {
    if (section === "focus") editor.commitTopics();
    internalTab.current = true;
    location.hash = `/profile?section=${next}`;
  };
  const save = async () => {
    if (!await editor.save(section, act)) {
      const field = Object.keys(editor.getSnapshot().errors).find(key => formRef.current?.querySelector(`#pe-${key}`));
      if (field) formRef.current?.querySelector<HTMLElement>(`#pe-${field}`)?.focus();
    }
  };
  const share = (field: VisibilityField, label: string, contact = false) => <div className="pe-sharing">
    <label className="pe-check"><input type="checkbox" checked={visible[field]} onChange={event => editor.share(field, event.target.checked)} aria-label={label} /><span>{contact ? "Share with saved connections" : "Show on my profile"}</span></label>
    {contact && !visible.previousConnections && visible[field] && <span className="pe-help">Hidden while access for saved connections is off.</span>}
  </div>;
  const field = (key: keyof typeof contract.stringLimits, label: string, placeholder?: string, type = "text", optional = true) => <div className="pe-field">
    <label htmlFor={`pe-${key}`}>{label}{optional && <span className="pe-optional">Optional</span>}</label>
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
    <header className="pe-page-heading"><h1>Profile</h1><button className="pe-text-action" type="button" onClick={() => setPreview(true)}><Eye size={17} />Preview profile</button></header>
    <div className="pe-tabs" role="tablist" aria-label="Profile sections">
      {profileSections.map(tab => <button key={tab} ref={element => { tabRefs.current[tab] = element; }} id={`pe-tab-${tab}`} type="button" role="tab" aria-selected={section === tab} aria-controls={`pe-panel-${tab}`} tabIndex={section === tab ? 0 : -1} onClick={() => select(tab)} onKeyDown={event => {
        const index = profileSections.indexOf(tab);
        const next = event.key === "ArrowRight" ? profileSections[(index + 1) % 4] : event.key === "ArrowLeft" ? profileSections[(index + 3) % 4] : event.key === "Home" ? "about" : event.key === "End" ? "settings" : null;
        if (next) { event.preventDefault(); select(next); tabRefs.current[next]?.focus(); }
      }}>{labels[tab]}{editor.dirty(tab) && <span className="pe-dirty-dot"><span className="sr-only"> — Unsaved changes</span></span>}</button>)}
    </div>
    {!snapshot.storageAvailable && <p className="pe-storage-note" role="status">Your draft stays here while you navigate. Browser storage is unavailable, so save before refreshing.</p>}
    <div className={`pe-layout ${section === "about" || section === "focus" ? "pe-with-preview" : ""}`}>
      <div className="pe-editor-column" role="tabpanel" id={`pe-panel-${section}`} aria-labelledby={`pe-tab-${section}`}>
        <form className="pe-panel pe-editor" ref={formRef} noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
          <div className="pe-panel-body">
            {section === "about" && <>
              <PanelHeading title="About you" description="The first things people see when you meet." />
              <div className="pe-identity"><Avatar profile={draft} size="large" /><div><strong>{draft.name || "Your name"}</strong><span>Sample photo for this demo</span></div></div>
              <div className="pe-field-grid">{field("name", "Name", "Your name", "text", false)}{field("role", "Headline", "e.g. Hardware engineer")}</div>
              {field("location", "Location", "e.g. Atlanta, GA")}
              <p className="pe-help">Your name and headline introduce you. Add your interests and what you’re working on in <button type="button" className="pe-inline-link" onClick={() => select("focus")}>Focus</button>.</p>
            </>}
            {section === "focus" && <>
              <PanelHeading title="Your focus" description="Help the right people find a reason to connect." />
              <div className="pe-field"><label htmlFor="pe-bio">Current focus<span className="pe-optional">Optional</span></label><textarea ref={focusRef} id="pe-bio" name="bio" rows={4} maxLength={contract.stringLimits.bio} value={draft.bio} placeholder="What are you working on or exploring?" aria-invalid={!!errors.bio} aria-describedby="pe-bio-help pe-bio-error" onChange={event => editor.change("bio", event.target.value)} /><div className="pe-field-meta"><span id="pe-bio-help">This also appears in Your focus on Home.</span><span>{draft.bio.length}/{contract.stringLimits.bio}</span></div><FieldError field="bio" message={errors.bio} />{share("bio", "Share current focus")}</div>
              {([ ["interests", "Interests", "Topics you’d enjoy talking about.", ["Robotics", "Design", "Open source", "Spatial computing"]], ["skills", "I can help with", "Skills or experience you can share.", skills], ["lookingFor", "I’m looking for help with", "Expertise you’d like to meet someone for.", skills] ] as const).map(([key, label, help, suggestions]) => <div className="pe-focus-group" key={key}><TopicInput field={key} label={label} help={help} suggestions={suggestions} editor={editor} snapshot={snapshot} />{share(key, `Share ${label}`)}</div>)}
              <p className="pe-help">Only shared interests and skills are used for demo matching.</p>
            </>}
            {section === "contact" && <>
              <PanelHeading title="Contact details" description="Choose how saved connections can reach you." />
              {([ ["linkedin", "LinkedIn", "https://www.linkedin.com/in/you", "url"], ["website", "Website", "https://your-website.com", "url"], ["email", "Email", "you@example.com", "email"] ] as const).map(([key, label, placeholder, type]) => <div className="pe-contact-group" key={key}>{field(key, label, placeholder, type)}{share(key, `Share ${label} with saved connections`, true)}</div>)}
              <details className="pe-other-contact" open={draft.contact ? true : undefined}><summary>Other contact</summary>{field("contact", "Other contact", "Another way to reach you")}{share("contact", "Share other contact with saved connections", true)}</details>
              <p className="pe-help">Contact details are private until you choose to share them. They aren’t used for matching.</p>
            </>}
            {section === "settings" && <>
              <PanelHeading title="Visibility" description="Choose where your profile can be discovered." />
              <Setting title="Show me in rooms" description="Make your shared introduction available to people in your room."><Toggle label="Show me in rooms" checked={visible.activeInEvent} onChange={() => editor.share("activeInEvent", !visible.activeInEvent)} /></Setting>
              <Setting title="Access for saved connections" description="Let saved connections see your shared profile details and contact links."><Toggle label="Access for saved connections" checked={visible.previousConnections} onChange={() => editor.share("previousConnections", !visible.previousConnections)} /></Setting>
              <p className="pe-help">Individual sharing choices live beside your fields in Focus and Contact. Hidden fields stay in your profile.</p>
            </>}
          </div>
          <footer className="pe-save-footer">
            <div className="pe-save-status" role="status">{saving === section ? "Saving…" : dirty ? "Unsaved changes" : saved === section ? <><Check size={15} />Saved</> : "No unsaved changes"}</div>
            <div className="pe-save-actions"><button className="pe-text-action" type="button" disabled={!dirty || !!saving} onClick={() => editor.discard(section)}>Discard changes</button><Button type="submit" busy={saving === section} disabled={!dirty || !!saving}>Save changes</Button></div>
            {failure?.section === section && <p className="pe-save-error" role="alert">{failure.message}</p>}
          </footer>
        </form>
        {section === "settings" && <>
          <section className="pe-panel pe-settings-panel"><PanelHeading title="Preferences" description="Applies immediately on this browser." />
            <Setting title="Reduce transparency" description="Use more opaque spatial surfaces for easier reading."><Toggle label="Reduce transparency" checked={solid} onChange={() => setSolid(!solid)} /></Setting>
            <Setting title="Match sounds" description="Play a soft sound when a match appears in spatial preview."><Toggle label="Match sounds" checked={sounds} onChange={() => { const next = !sounds; setSounds(next); try { localStorage.setItem("questmatch-sounds", String(next)); setPreferenceError(""); } catch { setPreferenceError("This preference could not be stored on this browser."); } }} /></Setting>
            {preferenceError && <p className="pe-help" role="status">{preferenceError}</p>}
          </section>
          <section className="pe-panel pe-settings-panel"><PanelHeading title="Data and session" />
            <Setting title="Export your information" description="Download your saved profile and connections as JSON."><Button variant="secondary" onClick={exportData}><Download size={16} />Export</Button></Setting>
            <Setting title="Clear event data" description="Remove saved demo connections and matches, and leave the room. Keep your profile."><Button variant="secondary" disabled={!state.session?.code} busy={busy} onClick={async () => { try { await act("event-data/clear"); notify("Event data cleared. Your profile is still here."); } catch { /* App reports the action error. */ } }}>Clear event data</Button></Setting>
            <Setting title="Sign out" description="Leave your temporary demo session."><Button variant="secondary" busy={busy} onClick={logout}><LogOut size={16} />Sign out</Button></Setting>
          </section>
          <p className="pe-demo-note">Profiles and sharing choices belong to this local demo. They aren’t a permanent account.</p>
        </>}
      </div>
      {(section === "about" || section === "focus") && <aside className="pe-preview-rail" aria-label="Nearby profile preview"><div className="pe-rail-heading"><h2>In the room</h2><Glasses size={19} /></div><NearbyProfile profile={draft} /><p className="pe-help">{visible.activeInEvent ? "Your name, headline, and shared interests at a glance." : "You can change room visibility in Settings."}</p><button type="button" className="pe-text-action" onClick={() => setPreview(true)}>{visible.activeInEvent ? <Eye size={16} /> : <EyeOff size={16} />}Preview full profile</button></aside>}
    </div>
    {preview && <ProfilePreview profile={draft} profiles={state.profiles} dirty={anyDirty} onClose={() => setPreview(false)} />}
  </div>;
}

function PanelHeading({ title, description }: { title: string; description?: string }) {
  return <header className="pe-panel-heading"><h2>{title}</h2>{description && <p>{description}</p>}</header>;
}
function Setting({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="pe-setting"><div><h3>{title}</h3><p>{description}</p></div>{children}</div>;
}
function FieldError({ field, message }: { field: EditableField; message?: string }) {
  return <span id={`pe-${field}-error`} className="pe-field-error" role={message ? "alert" : undefined}>{message}</span>;
}
function TopicInput({ field, label, help, suggestions, editor, snapshot }: { field: TopicField; label: string; help: string; suggestions: readonly string[]; editor: ProfileEditor; snapshot: EditorSnapshot }) {
  const values = snapshot.draft[field];
  const text = snapshot.topicText[field];
  return <div className="pe-field pe-topic-field"><label htmlFor={`pe-${field}`}>{label}</label><p className="pe-help" id={`pe-${field}-help`}>{help}</p>
    <div className="pe-topic-control"><div className="pe-topic-tags">{values.map((value, index) => <span key={`${value}-${index}`} className="pe-topic-tag">{value}<button type="button" aria-label={`Remove ${value} from ${label}`} onClick={() => editor.change(field, values.filter((_, i) => i !== index))}><X size={14} /></button></span>)}</div>
      <div className="pe-topic-entry"><input id={`pe-${field}`} value={text} placeholder="Add a topic…" aria-invalid={!!snapshot.errors[field]} aria-describedby={`pe-${field}-help pe-${field}-error`} onChange={event => editor.typeTopic(field, event.target.value)} onBlur={() => { if (text.trim()) editor.commitTopic(field); }} onKeyDown={event => {
        if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent.isComposing) { event.preventDefault(); editor.commitTopic(field); }
        if (event.key === "Backspace" && !text && values.length) { event.preventDefault(); editor.change(field, values.slice(0, -1)); editor.typeTopic(field, values[values.length - 1]); }
      }} /><button type="button" className="pe-add-topic" aria-label={`Add topic to ${label}`} disabled={!text.trim()} onMouseDown={event => event.preventDefault()} onClick={() => editor.commitTopic(field)}><Plus size={16} />Add</button></div>
    </div><FieldError field={field} message={snapshot.errors[field]} />
    <div className="pe-suggestions"><span>Try</span>{suggestions.filter(item => !values.some(value => value.toLowerCase() === item.toLowerCase())).slice(0, 3).map(item => <button key={item} type="button" disabled={values.length >= contract.topicLimit} onClick={() => { const pending = editor.getSnapshot().topicText[field]; if (!pending.trim() || editor.commitTopic(field)) editor.commitTopic(field, item); }}>{item}<Plus size={12} /></button>)}</div>
  </div>;
}
