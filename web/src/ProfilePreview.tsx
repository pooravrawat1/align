import "./SpatialSurface.css";
import { useEffect, useRef, useState } from "react";
import { ContactRound, EyeOff, Glasses, UserRound, X } from "lucide-react";
import type { Profile } from "./types";
import { Avatar, PanelHeader, Tags } from "./ui";
import { ContactLinks } from "./ProfileContactLinks";
import { sharedContactLinks } from "./contactDestinations";
import { homeCollaborators, isProfileFieldVisible } from "./collaboratorSuggestions";
import { visibilityOf } from "./profileEditor";

export function NearbyProfile({ profile }: { profile: Profile }) {
  const visible = visibilityOf(profile);
  return <div className="pe-room-scene">
    {visible.activeInEvent ? <div className="spatial-surface pe-room-card">
      <div className="pe-person"><Avatar profile={profile} /><div><strong>{profile.name.trim().split(/\s/)[0] || "Your name"}</strong><span>{profile.role || "Your headline"}</span></div></div>
      {visible.interests && profile.interests.length > 0 && <Tags items={profile.interests} limit={3} />}
    </div> : <div className="spatial-surface pe-room-card pe-paused"><EyeOff size={22} /><p>Your profile is hidden in rooms.</p></div>}
  </div>;
}

export function ProfilePreview({ profile, profiles, dirty, initialAudience = "room", onClose }: { profile: Profile; profiles: Profile[]; dirty: boolean; initialAudience?: "room" | "connection"; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [audience, setAudience] = useState<"room" | "connection">(initialAudience);
  const [distance, setDistance] = useState<"distant" | "nearby" | "matched">("nearby");
  const visible = visibilityOf(profile);
  const example = homeCollaborators(profiles, profile).find(person => person.reason);
  const hasSharedDetails = (visible.goals && !!profile.goals?.length) || (visible.domains && !!profile.domains?.length) || (visible.experiences && !!profile.experiences?.length) || (isProfileFieldVisible(profile, "bio") && !!profile.bio.trim()) || (["interests", "skills", "lookingFor"] as const).some(field => isProfileFieldVisible(profile, field) && profile[field].length > 0);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => { document.body.style.overflow = overflow; dialog.close(); trigger?.focus(); };
  }, []);
  const introduction = <div className="pe-preview-details">
    {isProfileFieldVisible(profile, "bio") && profile.bio.trim() && <section><h3>Current focus</h3><p>{profile.bio}</p></section>}
    {([ ["interests", "Interests"], ["skills", "I can help with"], ["lookingFor", "Looking for help with"] ] as const).map(([field, label]) => isProfileFieldVisible(profile, field) && profile[field].length > 0 && <section key={field}><h3>{label}</h3><Tags items={profile[field]} /></section>)}
    {visible.goals && !!profile.goals?.length && <section><h3>Here to</h3><Tags items={profile.goals} /></section>}
    {visible.domains && !!profile.domains?.length && <section><h3>Domains</h3><Tags items={profile.domains} /></section>}
    {visible.experiences && !!profile.experiences?.length && <section><h3>Past experiences</h3><div className="pe-preview-experiences">{profile.experiences.map((experience, index) => <p key={`${experience.category}-${experience.kind}-${experience.label}-${index}`}><strong>{experience.label}</strong><span>{experience.kind} · {experience.category}{experience.year ? ` · ${experience.year}` : ""}</span></p>)}</div></section>}
  </div>;
  return <dialog ref={dialogRef} className="pe-dialog" aria-labelledby="pe-preview-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="pe-drawer">
      <PanelHeader className="pe-drawer-header" headingId="pe-preview-title" title="Profile preview" description={dirty ? "Showing your draft. Save changes to update your shared profile." : "Showing your saved profile."} action={<button ref={closeRef} className="pe-icon-button" type="button" aria-label="Close profile preview" onClick={onClose}><X size={20} /></button>} />
      <div className="pe-segmented" role="group" aria-label="Preview audience">
        <button type="button" aria-pressed={audience === "room"} onClick={() => setAudience("room")}>In a room</button>
        <button type="button" aria-pressed={audience === "connection"} onClick={() => setAudience("connection")}>People you’ve met</button>
      </div>
      {audience === "room" ? <>
        <section className="pe-panel pe-preview-section">
          <PanelHeader title="In the room" description="See how your introduction changes as people get closer." icon={<Glasses size={19} />} />
          <div className="pe-segmented" role="group" aria-label="Spatial distance">{(["distant", "nearby", "matched"] as const).map(item => <button key={item} type="button" aria-pressed={distance === item} onClick={() => setDistance(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
          {!visible.activeInEvent || distance === "nearby" ? <NearbyProfile profile={profile} /> : <div className="pe-room-scene">{distance === "distant" ? <div className="spatial-surface pe-room-card pe-distance-name">{profile.name.trim().split(/\s/)[0] || "Your name"}<span>A name marker at a distance.</span></div> : <div className="spatial-surface pe-room-card pe-match-example"><h3>{example ? `Example with ${example.profile.name}` : "No shared match yet"}</h3><p>{example?.reason || "A reason to meet appears when shared interests or complementary skills overlap."}</p></div>}</div>}
          <p className="pe-help pe-scene-caption">{!visible.activeInEvent ? "Your profile is hidden at every distance." : distance === "nearby" ? "Nearby people see your name, headline, and up to three shared interests." : distance === "distant" ? "Only your first name is shown from farther away." : "This view uses shared interests, complementary skills, and your sharing choices."}</p>
        </section>
        {visible.activeInEvent && hasSharedDetails && <section className="pe-panel pe-preview-section"><PanelHeader title="Shared details" description="The information you’ve chosen to show on your profile." icon={<UserRound size={19} />} />{introduction}</section>}
      </> : <div className="pe-panel pe-preview-section pe-connection-preview">
        <PanelHeader title="People you’ve met" description="What people you remember from an event can see." icon={<ContactRound size={19} />} />
        <div className="pe-person"><Avatar profile={profile} size="large" /><div><strong>{profile.name || "Your name"}</strong><span>{profile.role || "Your headline"}</span>{profile.location && <span>{profile.location}</span>}</div></div>
        {!visible.previousConnections ? <p className="pe-help">Your focus, interests, skills, and contact links are hidden from people you met.</p> : <>{introduction}<section className="pe-preview-contact"><h3>Contact</h3><ContactLinks profile={profile} showLabels />{profile.contact && <p>{profile.contact}</p>}{!sharedContactLinks(profile).length && !profile.contact && <p className="pe-help">No contact information is shared.</p>}</section></>}
      </div>}
      <p className="pe-demo-note">Your sharing choices control which details appear in each view.</p>
    </div>
  </dialog>;
}
