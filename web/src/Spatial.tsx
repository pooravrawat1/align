import { type ReactNode, useEffect, useReducer, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronRight, Compass, Crosshair, Expand, Glasses, LoaderCircle, Minimize, MessageCircle, RefreshCw, RotateCcw, Settings2, Sparkles, Users, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { Avatar, Button, Tags, TextAction, Toggle } from "./ui";
import type { Action, Match, Profile, State } from "./types";
import { initialRoomState, roomReducer, createReplayableRequest, selectActiveRemoteProfiles, selectSpatialCards, type ReliabilityKind, type RoomState } from "./SpatialState";
import { networkPerson, ownedConnection } from "./networkModel";
import { go } from "./App";
import { activeEvent, homeEvent, eventPhoto } from "./eventModel";
import { SpatialScene } from "./SpatialScene";
import "./SpatialV2.css";
import "./SpatialSurface.css";

type Props = { state: State; user: Profile; act: Action; busy: boolean; connected: string[]; onConnect: (id: string) => Promise<void>; notify: (message: string) => void };

export function Spatial({ state, user, act, busy, connected, onConnect, notify }: Props) {
  const [entered, setEntered] = useState(false);
  const [room, dispatch] = useReducer(roomReducer, initialRoomState);
  const [code, setCode] = useState(activeEvent(state)?.code ?? "");
  const [monochrome, setMonochrome] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem("questmatch-sounds") === "true"; } catch { return false; } });
  const [matching, setMatching] = useState(false);
  const [displayedMatches, setDisplayedMatches] = useState<Match[]>([]);
  const [sampleMatches, setSampleMatches] = useState(false);
  const [matchError, setMatchError] = useState(false);
  const [distanceOverrides, setDistanceOverrides] = useState<Record<string, number>>({});
  const [distanceTargetId, setDistanceTargetId] = useState<string | null>(null);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const peopleButtonRef = useRef<HTMLButtonElement>(null);
  const finishConversationRef = useRef<HTMLButtonElement>(null);
  const roomRef = useRef<RoomState>(room);
  const activeRef = useRef(true);
  const matchRunRef = useRef(0);
  const requestRef = useRef(createReplayableRequest<State>());
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(sound);
  const actionPendingRef = useRef(false);
  const savePendingRef = useRef(false);
  roomRef.current = room;
  soundRef.current = sound;

  const event = state.events.find(item => item.code.toUpperCase() === state.session?.code?.toUpperCase());
  const previewEvent = event ?? homeEvent(state);
  const participants = selectActiveRemoteProfiles(state.profiles.filter(person => event?.participantIds?.includes(person.id)), user);
  const cards = selectSpatialCards(participants);
  const sampleDemo = state.demo && event?.code.toUpperCase() === "DEMO";
  const hasSampleMatches = sampleMatches && displayedMatches.some(match => match.compatible);
  const savedIds = new Set(connected.filter(id => ownedConnection(state, user.id, id)?.saved !== false));
  const focused = room.kind === "profile" ? participants.find(person => person.id === room.profileId) : undefined;
  const distanceTarget = participants.find(person => person.id === distanceTargetId) ?? participants[0];
  const distanceFor = (person: Profile) => distanceOverrides[person.id] ?? Math.max(0.8, person.distance || 3.2);
  const matchFor = (id: string) => displayedMatches.find(match => match.compatible && ((match.userA === user.id && match.userB === id) || (match.userB === user.id && match.userA === id)));
  function relationFor(profile: Profile) {
    const context = networkPerson(state, user, profile, undefined, "event");
    if (context.youOffer.length && context.theyOffer.length) return `Your ${context.youOffer[0].toLowerCase()} + ${profile.name.split(" ")[0]}’s ${context.theyOffer[0].toLowerCase()}.`;
    if (context.theyOffer.length) return `They offer the ${context.theyOffer[0].toLowerCase()} you need.`;
    if (context.youOffer.length) return `Your ${context.youOffer[0].toLowerCase()} could help them.`;
    if (context.sharedInterests.length) return `You both care about ${context.sharedInterests[0].toLowerCase()}.`;
    return null;
  }
  const recoveryOpen = (room.kind === "ambient" && room.panel === "recovery") || ((room.kind === "offline" || room.kind === "alignment-lost") && room.recoveryOpen);
  const panelOpen = room.kind === "profile" || (room.kind === "ambient" && room.panel !== null) || recoveryOpen;
  const socialVisible = room.kind === "ambient" || room.kind === "profile" || room.kind === "conversation";
  const selectedPersonAvailable = (room.kind !== "profile" && room.kind !== "conversation") || participants.some(person => person.id === room.profileId);

  useEffect(() => {
    if (!selectedPersonAvailable) dispatch({ type: "RETURN_AMBIENT" });
  }, [selectedPersonAvailable]);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; const audio = audioRef.current; audioRef.current = null; if (audio && audio.state !== "closed") void audio.close(); };
  }, []);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => {
    if (room.kind === "conversation") finishConversationRef.current?.focus();
  }, [room.kind]);

  function closePanel() {
    if (roomRef.current.kind === "conversation") {
      dispatch({ type: "FINISH_CONVERSATION" });
      return;
    }
    dispatch({ type: "CLOSE_LAYER" });
    requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      if (trigger?.isConnected && !trigger.closest("[inert]")) trigger.focus();
      else peopleButtonRef.current?.focus();
    });
  }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") closePanel(); };
    addEventListener("keydown", escape);
    return () => removeEventListener("keydown", escape);
  }, []);

  function openPerson(id: string) {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSaveError(null);
    setDistanceTargetId(id);
    dispatch({ type: "OPEN_PROFILE", profileId: id });
  }
  function openControls() {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (room.kind === "profile") dispatch({ type: "CLOSE_LAYER" });
    dispatch({ type: "OPEN_PANEL", panel: "recovery" });
  }
  function chime() {
    if (!soundRef.current || roomRef.current.kind !== "ambient") return;
    try {
      const context = audioRef.current ?? new AudioContext(); audioRef.current = context;
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.frequency.setValueAtTime(590, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(720, context.currentTime + 0.18);
      gain.gain.setValueAtTime(0.026, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.48);
      oscillator.start(); oscillator.stop(context.currentTime + 0.5);
    } catch { /* Sound is optional. */ }
  }
  function receiveMatches(result: State, demo: boolean) {
    if (roomRef.current.kind !== "ambient" && roomRef.current.kind !== "profile" && roomRef.current.kind !== "conversation") return;
    setDisplayedMatches(result.matches);
    setSampleMatches(demo);
    setMatchError(result.matches.length > 0 && result.matches.every(match => match.source === "unavailable"));
    if (result.matches.some(match => match.compatible && (match.userA === user.id || match.userB === user.id))) chime();
  }
  async function runMatches(demo = sampleDemo) {
    const run = ++matchRunRef.current;
    setMatching(true); setMatchError(false);
    try {
      const result = await act("matches", { force: true, demo });
      if (activeRef.current && run === matchRunRef.current) receiveMatches(result, demo);
    } catch { if (activeRef.current && run === matchRunRef.current) setMatchError(true); }
    finally { if (activeRef.current && run === matchRunRef.current) setMatching(false); }
  }
  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    const run = ++matchRunRef.current;
    setMatching(true); setMatchError(false);
    void requestRef.current.acquire(() => act("matches", { demo: sampleDemo })).then(result => {
      if (!cancelled && activeRef.current && run === matchRunRef.current) receiveMatches(result, sampleDemo);
    }).catch(() => { if (!cancelled && run === matchRunRef.current) setMatchError(true); }).finally(() => {
      if (!cancelled && activeRef.current && run === matchRunRef.current) setMatching(false);
    });
    return () => { cancelled = true; if (run === matchRunRef.current) matchRunRef.current += 1; };
  }, [entered]);

  async function enterPreview() {
    if (busy || actionPendingRef.current) return;
    actionPendingRef.current = true;
    try {
      if (!state.session?.code) await act("room", { code: code.trim().toUpperCase() });
      if (!activeRef.current) return;
      dispatch({ type: "RETURN_AMBIENT" }); setEntered(true);
    } catch { /* App displays the join error; keep the entered code. */ }
    finally { actionPendingRef.current = false; }
  }
  async function leavePreview() {
    if (busy || actionPendingRef.current || savePendingRef.current) return;
    actionPendingRef.current = true;
    try {
      await act("leave", {});
      matchRunRef.current += 1;
      if (activeRef.current) go("home");
    } catch { /* Keep the preview available for a retry. */ }
    finally { actionPendingRef.current = false; }
  }
  async function saveConnection(id: string) {
    if (savedIds.has(id) || busy || savePendingRef.current) return;
    savePendingRef.current = true; setSavingProfileId(id); setSaveError(null);
    try { await onConnect(id); }
    catch { if (activeRef.current) setSaveError(id); }
    finally { savePendingRef.current = false; if (activeRef.current) setSavingProfileId(null); }
  }
  function simulate(kind: ReliabilityKind | "outside-boundary") {
    matchRunRef.current += 1; setMatching(false);
    dispatch(kind === "outside-boundary" ? { type: "SIMULATE_BOUNDARY" } : { type: "SIMULATE_RELIABILITY", kind });
  }
  async function restorePreview() {
    if (busy || actionPendingRef.current) return;
    actionPendingRef.current = true;
    try {
      if (room.kind === "offline") await act("room", { code: state.session?.code || code });
      if (!activeRef.current) return;
      dispatch({ type: "RESTORE_PREVIEW" });
      notify("Preview restored.");
      requestAnimationFrame(() => { if (activeRef.current) void runMatches(); });
    } catch { /* Recovery stays visible until the request succeeds. */ }
    finally { actionPendingRef.current = false; }
  }
  async function resetPreview() {
    if (busy || actionPendingRef.current) return;
    actionPendingRef.current = true;
    try {
      const result = await act("reset", {});
      if (!activeRef.current) return;
      matchRunRef.current += 1; setEntered(false); setCode(activeEvent(result)?.code ?? "");
      setDisplayedMatches([]); setSampleMatches(false); setDistanceOverrides({}); setDistanceTargetId(null); setMatching(false); setMatchError(false);
      dispatch({ type: "RETURN_AMBIENT" }); notify("Demo reset.");
    } catch { /* App displays the failure. */ }
    finally { actionPendingRef.current = false; }
  }

  return <div ref={stageRef} className="qmv2 spatial-content">
    <header className="qmv2-page-heading">
      <div><TextAction icon={<ArrowLeft size={16} />} iconPosition="start" disabled={busy || savingProfileId !== null} onClick={() => entered ? void leavePreview() : go("home")}>Back to event</TextAction><h1>Spatial preview</h1><p>Discover the people around you. Find a reason to connect.</p></div>
      <div className="qmv2-page-actions">
        {entered && room.kind !== "conversation" && <button className="qmv2-icon-button" aria-label="Preview controls" aria-expanded={recoveryOpen} onClick={openControls}><Settings2 size={19} /></button>}
        <button className="qmv2-icon-button" aria-label={fullscreen ? "Exit fullscreen" : "Expand spatial preview"} onClick={() => { const request = fullscreen ? document.exitFullscreen() : stageRef.current?.requestFullscreen(); void request?.catch(() => notify("Fullscreen is unavailable in this browser.")); }}>{fullscreen ? <Minimize size={19} /> : <Expand size={19} />}</button>
      </div>
    </header>
    <div className={`qmv2-stage ${entered ? "is-room" : "is-setup"} ${monochrome ? "is-monochrome" : ""} ${panelOpen ? "has-panel" : ""}`}>
      {!entered && previewEvent && <img className="qmv2-scene" src={eventPhoto(previewEvent)} alt="" fetchPriority="high" />}
      {!entered && <div className="qmv2-atmosphere" />}
      {!entered ? <section className="qmv2-entry spatial-surface spatial-surface--frosted" aria-labelledby="spatial-entry-title">
        <Glasses size={32} aria-hidden="true" />
        <h2 id="spatial-entry-title">{state.session?.code ? "Meet beyond the screen" : "Join your event"}</h2>
        <p>{state.session?.code ? "Explore the people in your event. Find a reason to say hello, then save the people you want to keep in touch with." : "Enter your event code to explore the people in the room."}</p>
        <form onSubmit={event => { event.preventDefault(); void enterPreview(); }}>
          {!state.session?.code && <label className="qmv2-code-label">Event code<input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="DEMO" required pattern="[A-Z0-9]{3,8}" minLength={3} maxLength={8} autoComplete="off" spellCheck={false} /></label>}
          <Button busy={busy} type="submit">{state.session?.code ? "Enter preview" : "Join and enter"}<ArrowRight size={17} /></Button>
        </form>
        <p className="qmv2-entry-note">{state.session?.code ? "Browser preview · simulated people and distances" : "Try DEMO for a sample event. No headset needed."}</p>
      </section> : <>
        <div className="qmv2-room-guide"><span><Glasses size={16} />Illustrative room · browser preview</span><p>{room.kind === "conversation" ? "" : "Select a label, or explore everyone in People."}</p></div>
        {socialVisible && participants.length > 0 && <SpatialScene people={cards} hidden={panelOpen} conversationId={room.kind === "conversation" ? room.profileId : undefined} renderCard={profile => <ParticipantCard relation={relationFor(profile)} conversation={room.kind === "conversation" && room.profileId === profile.id} profile={profile} match={matchFor(profile.id)} distance={distanceFor(profile)} onOpen={() => openPerson(profile.id)} />} />}
        {socialVisible && participants.length === 0 && <div className="qmv2-empty"><Users size={28} /><h2>No one nearby yet</h2><p>People who share their profile at this event will appear here.</p></div>}
        {!socialVisible && !recoveryOpen && <section className="qmv2-reliability" aria-live="polite">
          {room.kind === "offline" ? <WifiOff size={28} /> : room.kind === "alignment-lost" ? <Crosshair size={28} /> : <Compass size={28} />}
          <h2>{room.kind === "offline" ? "Connection paused" : room.kind === "alignment-lost" ? "Alignment interrupted" : "Outside the preview area"}</h2>
          <p>This is a simulated interruption. People stay hidden until you restore the preview.</p>
          <Button busy={busy} onClick={() => void restorePreview()}>Restore preview<RefreshCw size={16} /></Button>
        </section>}
        {room.kind === "profile" && focused && <ProfileDrawer afterConversation={Boolean(room.afterConversation)} state={state} user={user} profile={focused} match={matchFor(focused.id)} sampleMatch={sampleMatches} saved={savedIds.has(focused.id)} saving={savingProfileId === focused.id} disabled={busy || savingProfileId !== null} error={saveError === focused.id} onClose={closePanel} onStart={cards.some(person => person.id === focused.id) ? () => dispatch({ type: "START_CONVERSATION" }) : undefined} onSave={() => void saveConnection(focused.id)} />}
        {room.kind === "ambient" && room.panel === "people" && <PreviewPanel title="People in this room" onClose={closePanel}>
          <p className="qmv2-panel-intro">Choose a person to see what you have in common.</p>
          <div className="qmv2-people-list">{participants.map(profile => <button key={profile.id} onClick={() => openPerson(profile.id)}><Avatar profile={profile} /><span><strong>{profile.name}</strong><small>{profile.role}</small></span>{savedIds.has(profile.id) ? <Check size={17} aria-label="Saved" /> : matchFor(profile.id) ? <Sparkles size={17} aria-label="Reason to meet" /> : <ChevronRight size={17} />}</button>)}</div>
          {participants.length === 0 && <p>No shared profiles are available in this event.</p>}
        </PreviewPanel>}
        {recoveryOpen && <PreviewPanel title="Preview controls" onClose={closePanel}>
          <p className="qmv2-panel-intro">Try different distances and states. These controls simulate the headset experience.</p>
          {distanceTarget && <section className="qmv2-control-section"><h3>Distance</h3><label>Person<select value={distanceTarget.id} onChange={event => setDistanceTargetId(event.target.value)}>{participants.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label><span>Distance <output>{distanceFor(distanceTarget).toFixed(1)} m</output></span><input type="range" min="0.8" max="7" step="0.1" value={distanceFor(distanceTarget)} onChange={event => setDistanceOverrides(current => ({ ...current, [distanceTarget.id]: Number(event.target.value) }))} /></label><p>Far: a name. Nearby: an introduction. Close: a reason to meet.</p></section>}
          <section className="qmv2-control-section"><h3>Matching</h3><Button variant="secondary" busy={matching} disabled={busy || !socialVisible} onClick={() => void runMatches()}>Refresh matches<RefreshCw size={16} /></Button><TextAction disabled={busy || matching || !socialVisible} onClick={() => void runMatches(true)}>Show sample match<Sparkles size={16} /></TextAction><p>The sample match uses a prepared demo pairing.</p></section>
          <section className="qmv2-control-section"><h3>Appearance</h3><div className="qmv2-toggle-row"><span>Monochrome room</span><Toggle checked={monochrome} onChange={() => setMonochrome(value => !value)} label="Monochrome room" /></div><div className="qmv2-toggle-row"><span>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}Match sound</span><Toggle checked={sound} onChange={() => { const next = !sound; setSound(next); try { localStorage.setItem("questmatch-sounds", String(next)); } catch { /* Keep in memory. */ } }} label="Match sound" /></div></section>
          <section className="qmv2-control-section"><h3>Simulate an interruption</h3><div className="qmv2-simulation-controls"><button disabled={busy} onClick={() => simulate("offline")}>Connection loss</button><button disabled={busy} onClick={() => simulate("alignment-lost")}>Alignment loss</button><button disabled={busy} onClick={() => simulate("outside-boundary")}>Outside area</button></div>{!socialVisible && <Button busy={busy} onClick={() => void restorePreview()}>Restore preview</Button>}</section>
          <TextAction disabled={busy} onClick={() => void resetPreview()}><RotateCcw size={16} />Reset demo</TextAction>
        </PreviewPanel>}
        <div className={`qmv2-room-footer${room.kind === "conversation" ? " is-conversation" : ""}`}>
          {room.kind === "conversation" ? <><button ref={finishConversationRef} className="qmv2-people-button spatial-surface" onClick={() => dispatch({ type: "FINISH_CONVERSATION" })}>Finish conversation<ArrowRight size={16} /></button></> : <>
          <button ref={peopleButtonRef} className="qmv2-people-button spatial-surface" aria-expanded={room.kind === "ambient" && room.panel === "people"} disabled={!socialVisible} onClick={() => { triggerRef.current = peopleButtonRef.current; if (room.kind === "profile") dispatch({ type: "CLOSE_LAYER" }); dispatch({ type: "OPEN_PANEL", panel: "people" }); }}><Users size={18} />People<span>{participants.length}</span></button>
          <div className="qmv2-room-status" role="status">{matching ? <><LoaderCircle size={15} className="spin" />Finding common ground…</> : matchError ? <><span>Matching unavailable. You can still explore people.</span><button disabled={busy} onClick={() => void runMatches()}>Retry</button></> : <><span className="qmv2-match-dot" />{hasSampleMatches && "Sample match · "}Green means a reason to meet</>}</div>
          </>}
        </div>
      </>}
    </div>
  </div>;
}

function ParticipantCard({ profile, match, distance, conversation, relation, onOpen }: { profile: Profile; match?: Match; distance: number; conversation: boolean; relation: string | null; onOpen: () => void }) {
  const expanded = Boolean(match && relation) && distance <= 4.75 && !conversation;
  const Card = conversation ? "div" : "button";
  return <Card className={`qmv2-card spatial-surface ${expanded ? "qmv2-card--expanded is-matched spatial-surface--matched" : "qmv2-card--compact"}${conversation ? " is-conversation" : ""}`} role={conversation ? "status" : undefined} aria-label={conversation ? `In conversation with ${profile.name}` : `Open ${profile.name}`} onClick={conversation ? undefined : onOpen}>
    <div className="qmv2-card-person"><strong>{profile.name}</strong>{expanded && <><span aria-hidden="true">·</span><small>{profile.role}</small></>}</div>
    {expanded && <p className="qmv2-card-reason" title={relation ?? undefined}>{relation}</p>}
    <span className="qmv2-card-tether" aria-hidden="true" />
  </Card>;
}

function PreviewPanel({ title, onClose, children, footer, className = "" }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; className?: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  return <aside className={`qmv2-panel ${className}`} aria-label={title}>
    <header><h2>{title}</h2><button ref={closeRef} className="qmv2-icon-button" aria-label={`Close ${title}`} onClick={onClose}><X size={18} /></button></header>
    <div className="qmv2-panel-body">{children}</div>
    {footer}
  </aside>;
}

function ProfileDrawer({ afterConversation, state, user, profile, match, sampleMatch, saved, saving, disabled, error, onClose, onStart, onSave }: { afterConversation: boolean; state: State; user: Profile; profile: Profile; match?: Match; sampleMatch: boolean; saved: boolean; saving: boolean; disabled: boolean; error: boolean; onClose: () => void; onStart?: () => void; onSave: () => void }) {
  const confirmationRef = useRef<HTMLDivElement>(null);
  const previouslySaved = useRef(saved);
  useEffect(() => {
    if (saved && !previouslySaved.current && (document.activeElement === document.body || confirmationRef.current?.contains(document.activeElement))) {
      confirmationRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    previouslySaved.current = saved;
  }, [saved]);
  const person = networkPerson(state, user, profile, undefined, "event");
  const showFollowUp = afterConversation || !onStart;
  const shared = person.sharedInterests;
  const hasCommonGround = shared.length > 0 || person.theyOffer.length > 0 || person.youOffer.length > 0;
  return <PreviewPanel title="Meet someone new" onClose={onClose} className="qmv2-person-panel spatial-surface" footer={
    <div ref={confirmationRef} className={`qmv2-connect${saved ? " is-saved" : ""}`}>
      {onStart && !afterConversation && <Button disabled={disabled || saving} onClick={onStart}><MessageCircle size={16} />Start conversation</Button>}
      {showFollowUp && (saved ? <><div className="qmv2-save-confirmation" role="status"><Check size={20} /><div><strong>Saved to your network</strong><p>Keep notes and follow up from Network.</p></div></div><Button onClick={onClose}>Back to the room<ArrowRight size={17} /></Button></> : <><h3>Keep the conversation going</h3><p>Save {profile.name.split(" ")[0]} to your Network so you can find them after the event.</p><Button busy={saving} disabled={disabled} onClick={onSave}><Bookmark size={17} />{error ? "Try saving again" : "Save connection"}</Button><small>Only saved to your network. No request is sent.</small></>)}
      {showFollowUp && error && !saved && <p className="qmv2-save-error" role="alert">Couldn’t save this connection. Try again.</p>}
    </div>
    }>
    <div className="qmv2-person-identity"><Avatar profile={profile} size="large" /><div><h3>{profile.name}</h3><p>{profile.role}</p></div></div>
    {person.profile.bio && <p className="qmv2-person-bio">{person.profile.bio}</p>}
    {(match || hasCommonGround) && <section className="qmv2-common-ground"><h3><Sparkles size={16} />A reason to say hello</h3><p>{match?.reason ?? person.reason}</p>{match && sampleMatch && <small>Sample match · prepared demo</small>}{shared.length > 0 && <Tags items={shared} />}</section>}
    {(person.theyOffer.length > 0 || person.youOffer.length > 0) && <div className="qmv2-exchange">{person.theyOffer.length > 0 && <section><h3>They can help you with</h3><Tags items={person.theyOffer} /></section>}{person.youOffer.length > 0 && <section><h3>You can help them with</h3><Tags items={person.youOffer} /></section>}</div>}
    <details className="qmv2-more"><summary>More about {profile.name.split(" ")[0]}</summary>{([["Interests", person.profile.interests], ["Skills", person.profile.skills], ["Looking for", person.profile.lookingFor]] as const).map(([label, items]) => items.length > 0 && <section key={label}><h3>{label}</h3><Tags items={items} /></section>)}</details>

  </PreviewPanel>;
}
