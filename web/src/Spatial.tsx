import { type ReactNode, useEffect, useReducer, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronRight,
  Compass,
  Crosshair,
  Expand,
  Glasses,
  Info,
  LoaderCircle,
  LogOut,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Settings2,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from "lucide-react";
import { Avatar, Button, Mark, Tags, TextAction, Toggle } from "./ui";
import type { Action, Match, Profile, State } from "./types";
import {
  initialRoomState,
  roomReducer,
  connectionIdsForEvent,
  createReplayableRequest,
  selectActiveRemoteProfiles,
  type AmbientPanel,
  type ReliabilityKind,
  type RoomState,
  type SaveStatus,
} from "./SpatialState";
import { go } from "./App";
import "./SpatialV2.css";

type Step = "join" | "profile" | "calibrate" | "ready" | "room";

type Props = {
  state: State;
  user: Profile;
  act: Action;
  busy: boolean;
  connected: string[];
  onConnect: (id: string) => Promise<void>;
  notify: (message: string) => void;
};

type DistanceBand = "far" | "medium" | "near";
type CardTone = "neutral" | "matched" | "saved";

function distanceBand(distance: number): DistanceBand {
  if (distance <= 2.25) return "near";
  if (distance <= 4.75) return "medium";
  return "far";
}

function canShow(
  profile: Profile,
  field: "bio" | "interests" | "skills" | "lookingFor",
) {
  return profile.visibility?.[field] !== false;
}

function firstName(profile: Profile) {
  return profile.name.split(" ")[0];
}

export function Spatial({
  state,
  user,
  act,
  busy,
  connected,
  onConnect,
  notify,
}: Props) {
  const [step, setStep] = useState<Step>(
    state.session?.calibrated
      ? "room"
      : state.session?.code
        ? "profile"
        : "join",
  );
  const [room, dispatch] = useReducer(roomReducer, initialRoomState);
  const [code, setCode] = useState(state.session?.code || "DEMO");
  const [monochrome, setMonochrome] = useState(false);
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem("questmatch-sounds") === "true";
    } catch {
      return false;
    }
  });
  const [matching, setMatching] = useState(false);
  const [displayedMatches, setDisplayedMatches] = useState<Match[]>(
    state.matches,
  );
  const [distanceOverrides, setDistanceOverrides] = useState<
    Record<string, number>
  >({});
  const [distanceTargetId, setDistanceTargetId] = useState<string | null>(null);
  const [mutedReasons, setMutedReasons] = useState<Set<string>>(new Set());
  const [completedConversationIds, setCompletedConversationIds] = useState<
    Set<string>
  >(new Set());
  const [savedDuringSession, setSavedDuringSession] = useState<Set<string>>(
    new Set(),
  );
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [returnAfterCalibration, setReturnAfterCalibration] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<RoomState>(room);
  const stepRef = useRef<Step>(step);
  const soundRef = useRef(sound);
  const activeRef = useRef(true);
  const matchRunRef = useRef(0);
  const automaticMatchRequestRef = useRef(createReplayableRequest<State>());
  const matchNoticeTimerRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  roomRef.current = room;
  stepRef.current = step;
  soundRef.current = sound;

  const participants = selectActiveRemoteProfiles(state.profiles, user);
  const cardParticipants = participants.slice(0, 3);
  const distanceTarget =
    participants.find((profile) => profile.id === distanceTargetId) ||
    participants[0];
  const distanceFor = (profile: Profile) =>
    distanceOverrides[profile.id] ?? Math.max(0.8, profile.distance || 3.2);
  const ownedMatches = displayedMatches.filter(
    (match) =>
      match.compatible && (match.userA === user.id || match.userB === user.id),
  );
  const matchFor = (id: string) => {
    if (mutedReasons.has(id)) return undefined;
    return ownedMatches.find(
      (match) => match.userA === id || match.userB === id,
    );
  };
  const focusedId =
    room.kind === "profile" || room.kind === "conversation"
      ? room.profileId
      : null;
  const focused = participants.find((profile) => profile.id === focusedId);
  const event = state.events.find((candidate) =>
    state.session?.code
      ? candidate.code.toUpperCase() === state.session.code.toUpperCase()
      : false,
  );
  const eventName =
    event?.name ||
    (state.session?.code ? `Room ${state.session.code}` : "The Builders Room");
  const savedIds = new Set([...connected, ...savedDuringSession]);
  const currentEventId = event?.id || state.session?.code || null;
  const currentEventConnectionIds = connectionIdsForEvent(
    state.connections,
    user.id,
    currentEventId,
  );
  const recapSavedIds = new Set([
    ...currentEventConnectionIds,
    ...savedDuringSession,
  ]);
  const savedProfiles = participants.filter((profile) =>
    recapSavedIds.has(profile.id),
  );

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      if (matchNoticeTimerRef.current !== null) {
        window.clearTimeout(matchNoticeTimerRef.current);
        matchNoticeTimerRef.current = null;
      }
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio && audio.state !== "closed") void audio.close();
    };
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (roomRef.current.kind === "conversation") {
        dispatch({ type: "DISMISS_PROMPT" });
      } else {
        dispatch({ type: "CLOSE_LAYER" });
      }
    };
    addEventListener("keydown", onEscape);
    return () => removeEventListener("keydown", onEscape);
  }, []);

  function chime() {
    if (!soundRef.current || roomRef.current.kind !== "ambient") return;
    try {
      const context = audioRef.current || new AudioContext();
      audioRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.frequency.setValueAtTime(590, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        720,
        context.currentTime + 0.18,
      );
      gain.gain.setValueAtTime(0.026, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.48);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.5);
    } catch {
      // The visual reveal remains available when browser audio is blocked.
    }
  }

  const showTransientMatchCount = (count: number) => {
    if (matchNoticeTimerRef.current !== null) {
      window.clearTimeout(matchNoticeTimerRef.current);
    }
    dispatch({ type: "SHOW_MATCH_NOTICE", count });
    matchNoticeTimerRef.current = window.setTimeout(() => {
      dispatch({ type: "CLEAR_MATCH_NOTICE" });
      matchNoticeTimerRef.current = null;
    }, 3400);
  };

  const revealMatchResult = (result: State) => {
    if (stepRef.current !== "room" || roomRef.current.kind !== "ambient") {
      return;
    }
    const visibleParticipantIds = new Set(
      cardParticipants.map((profile) => profile.id),
    );
    const visibleMatches = result.matches.filter(
      (match) =>
        match.compatible &&
        (match.userA === user.id || match.userB === user.id) &&
        visibleParticipantIds.has(
          match.userA === user.id ? match.userB : match.userA,
        ),
    );
    setDisplayedMatches(result.matches);
    if (visibleMatches.length > 0) {
      showTransientMatchCount(visibleMatches.length);
      chime();
    }
  };

  const runMatches = async (demo: boolean) => {
    const runId = ++matchRunRef.current;
    setMatching(true);
    setMutedReasons(new Set());
    setDisplayedMatches([]);
    try {
      const result = await act("matches", { force: true, demo });
      if (!activeRef.current || runId !== matchRunRef.current) return;
      revealMatchResult(result);
    } catch {
      // App owns the recoverable API error banner.
    } finally {
      if (activeRef.current && runId === matchRunRef.current) {
        setMatching(false);
      }
    }
  };

  useEffect(() => {
    if (step !== "room") return;

    let cancelled = false;
    const runId = ++matchRunRef.current;
    setMatching(true);
    setMutedReasons(new Set());
    setDisplayedMatches([]);
    const request = automaticMatchRequestRef.current.acquire(() =>
      act("matches", { force: true, demo: true }),
    );

    void request
      .then((result) => {
        if (cancelled || !activeRef.current || runId !== matchRunRef.current) {
          return;
        }
        revealMatchResult(result);
      })
      .catch(() => {
        // App owns the recoverable API error banner.
      })
      .finally(() => {
        if (!cancelled && activeRef.current && runId === matchRunRef.current) {
          setMatching(false);
        }
      });

    return () => {
      cancelled = true;
      if (matchRunRef.current === runId) {
        matchRunRef.current += 1;
        setMatching(false);
      }
    };
  }, [step]);

  const join = async () => {
    try {
      await act("room", { code });
      dispatch({ type: "RETURN_AMBIENT" });
      setStep("profile");
    } catch {
      // App owns the recoverable API error banner.
    }
  };

  const calibrate = async () => {
    try {
      await act("calibrate", {});
      if (returnAfterCalibration) {
        dispatch({ type: "CALIBRATION_SUCCEEDED" });
        setStep("room");
        setReturnAfterCalibration(false);
        notify("Demo alignment restored.");
      } else {
        setStep("ready");
      }
    } catch {
      // App owns the recoverable API error banner.
    }
  };

  const startRecalibration = () => {
    matchRunRef.current += 1;
    setMatching(false);
    setReturnAfterCalibration(true);
    setStep("calibrate");
  };

  const reconnect = async () => {
    try {
      matchRunRef.current += 1;
      await act("room", { code: state.session?.code || code });
      setDisplayedMatches([]);
      setMatching(false);
      setReturnAfterCalibration(true);
      dispatch({ type: "SIMULATE_RELIABILITY", kind: "alignment-lost" });
      setStep("calibrate");
      notify("Demo connection restored. Recalibrate the shared origin.");
    } catch {
      // App owns the recoverable API error banner.
    }
  };

  const reset = async () => {
    try {
      matchRunRef.current += 1;
      await act("reset", {});
      setStep("join");
      setCode("DEMO");
      setDisplayedMatches([]);
      setMutedReasons(new Set());
      setCompletedConversationIds(new Set());
      setSavedDuringSession(new Set());
      setDistanceOverrides({});
      setDistanceTargetId(null);
      setReturnAfterCalibration(false);
      setMatching(false);
      dispatch({ type: "RETURN_AMBIENT" });
      notify("Demo session reset to its starting profiles.");
    } catch {
      // App owns the recoverable API error banner.
    }
  };

  const openPerson = (profileId: string) => {
    setDistanceTargetId(profileId);
    dispatch({ type: "OPEN_PROFILE", profileId });
  };

  const saveConnection = async (profileId: string, inConversation = false) => {
    if (savedIds.has(profileId)) {
      if (inConversation) dispatch({ type: "SAVE_SUCCESS" });
      return;
    }
    if (inConversation) dispatch({ type: "SAVE_PENDING" });
    setSavingProfileId(profileId);
    try {
      await onConnect(profileId);
      if (!activeRef.current) return;
      setSavedDuringSession((current) => new Set(current).add(profileId));
      if (inConversation) dispatch({ type: "SAVE_SUCCESS" });
    } catch {
      if (inConversation) {
        dispatch({ type: "SAVE_FAILED" });
      }
      // App owns the error banner and the callback is expected to reject.
    } finally {
      if (activeRef.current) setSavingProfileId(null);
    }
  };

  const finishConversation = () => {
    if (room.kind !== "conversation") return;
    const profileId = room.profileId;
    setCompletedConversationIds((current) => new Set(current).add(profileId));
    setMutedReasons((current) => new Set(current).add(profileId));
    dispatch({ type: "FINISH_CONVERSATION" });
  };

  const completeLeave = async (destination: "home" | "network") => {
    try {
      await act("leave", {});
      go(destination);
    } catch {
      // Keep the truthful local recap visible while App shows the API error.
    }
  };

  const simulateReliability = (kind: ReliabilityKind) => {
    matchRunRef.current += 1;
    setMatching(false);
    dispatch({ type: "SIMULATE_RELIABILITY", kind });
  };

  const simulateBoundary = () => {
    matchRunRef.current += 1;
    setMatching(false);
    dispatch({ type: "SIMULATE_BOUNDARY" });
  };

  const openRecoveryForProfile = (profileId: string) => {
    setDistanceTargetId(profileId);
    dispatch({ type: "CLOSE_LAYER" });
    requestAnimationFrame(() =>
      dispatch({ type: "OPEN_PANEL", panel: "recovery" }),
    );
  };

  const inRoom = step === "room";
  const showSocialCards =
    inRoom &&
    (room.kind === "ambient" || room.kind === "profile") &&
    participants.length > 0;
  const roomClass = `qmv2-room--${room.kind}`;

  return (
    <div className="qmv2 spatial-content">
      <header className="qmv2-page-heading">
        <div>
          <h1>Be here. Find your people.</h1>
          <p>A browser preview of the interface designed for the headset.</p>
        </div>
        <div className="qmv2-page-actions">
          <button
            type="button"
            className="qmv2-quiet-button"
            aria-pressed={monochrome}
            onClick={() => setMonochrome((current) => !current)}
          >
            <Glasses size={18} />
            {monochrome ? "Color room" : "Monochrome"}
          </button>
          <button
            type="button"
            className="qmv2-icon-button"
            aria-label="Expand Spatial Salon preview"
            onClick={() => {
              void stageRef.current
                ?.requestFullscreen()
                .catch(() =>
                  notify("Fullscreen is unavailable in this browser."),
                );
            }}
          >
            <Expand size={19} />
          </button>
        </div>
      </header>

      <div
        ref={stageRef}
        className={`qmv2-stage ${roomClass} ${monochrome ? "is-monochrome" : ""} ${step !== "room" ? "is-setup" : ""}`}
      >
        <div className="scene-photo qmv2-scene" />
        <div className="qmv2-atmosphere" />

        <div className="qmv2-topline">
          <button
            type="button"
            className="qmv2-event-button"
            aria-label="Open event information"
            aria-expanded={room.kind === "ambient" && room.panel === "event"}
            disabled={step !== "room" || room.kind !== "ambient"}
            onClick={() => dispatch({ type: "OPEN_PANEL", panel: "event" })}
          >
            <span className="qmv2-status-dot" />
            <span>{eventName}</span>
            <strong>{state.session?.code || code}</strong>
            <Info size={16} />
          </button>
          <span className="qmv2-simulation-label">
            Browser simulation · no headset tracking
          </span>
        </div>

        {step !== "room" && (
          <SetupFlow
            step={step}
            code={code}
            setCode={setCode}
            user={user}
            participants={participants}
            busy={busy}
            returning={returnAfterCalibration}
            onJoin={() => void join()}
            onCalibrate={() => void calibrate()}
            onContinue={() => setStep("calibrate")}
            onEnter={() => setStep("room")}
            onBack={() => {
              if (returnAfterCalibration) {
                setReturnAfterCalibration(false);
                setStep("room");
                dispatch({ type: "CALIBRATION_CANCELLED" });
                return;
              }
              setStep(
                step === "ready"
                  ? "calibrate"
                  : step === "calibrate"
                    ? "profile"
                    : "join",
              );
            }}
          />
        )}

        {showSocialCards && (
          <div className="qmv2-card-field" aria-label="Nearby demo profiles">
            {cardParticipants.map((profile, index) => {
              const match = matchFor(profile.id);
              const tone: CardTone = savedIds.has(profile.id)
                ? "saved"
                : match
                  ? "matched"
                  : "neutral";
              return (
                <ParticipantCard
                  key={profile.id}
                  profile={profile}
                  match={match}
                  tone={tone}
                  distance={distanceFor(profile)}
                  position={index}
                  selected={
                    room.kind === "profile" && room.profileId === profile.id
                  }
                  onOpen={() => openPerson(profile.id)}
                />
              );
            })}
          </div>
        )}

        {inRoom && room.kind === "ambient" && room.matchNotice !== null && (
          <div className="qmv2-match-notice" role="status">
            <Sparkles size={17} />
            <span>
              {room.matchNotice === 1
                ? "1 nearby reason to meet"
                : `${room.matchNotice} nearby reasons to meet`}
            </span>
          </div>
        )}

        {inRoom && room.kind === "profile" && focused && (
          <ProfileDrawer
            profile={focused}
            match={matchFor(focused.id)}
            saved={savedIds.has(focused.id)}
            saving={savingProfileId === focused.id}
            onClose={() => dispatch({ type: "CLOSE_LAYER" })}
            onConversation={() =>
              dispatch({
                type: "START_CONVERSATION",
                profileId: focused.id,
                saved: savedIds.has(focused.id),
              })
            }
            onSave={() => void saveConnection(focused.id)}
            onTestDistance={() => openRecoveryForProfile(focused.id)}
          />
        )}

        {inRoom && room.kind === "conversation" && focused && (
          <ConversationView
            profile={focused}
            promptOpen={room.promptOpen}
            saveStatus={savedIds.has(focused.id) ? "saved" : room.saveStatus}
            onDismissPrompt={() => dispatch({ type: "DISMISS_PROMPT" })}
          />
        )}

        {inRoom && room.kind === "offline" && (
          <ReliabilityState
            icon={<WifiOff size={30} />}
            title="Demo connection paused"
            description="Remote sample cards are hidden until this browser simulation reconnects."
            action="Open recovery"
            onAction={() => dispatch({ type: "OPEN_PANEL", panel: "recovery" })}
          />
        )}

        {inRoom && room.kind === "alignment-lost" && (
          <ReliabilityState
            icon={<Crosshair size={30} />}
            title="Demo alignment lost"
            description="Spatial cards stay hidden until the shared simulated origin is calibrated again."
            action="Recalibrate"
            onAction={startRecalibration}
          />
        )}

        {inRoom && room.kind === "outside-boundary" && (
          <section className="qmv2-boundary-simulation" aria-live="polite">
            <span>Developer simulation</span>
            <Compass size={34} />
            <h2>Outside the demo area</h2>
            <p>
              Social cards and match audio are paused in this test state. This
              is not a real boundary system.
            </p>
            <Button onClick={() => dispatch({ type: "RETURN_AMBIENT" })}>
              Return inside demo area
              <ArrowRight size={17} />
            </Button>
          </section>
        )}

        {inRoom && room.kind === "recap" && (
          <Recap
            savedProfiles={savedProfiles}
            conversationCount={completedConversationIds.size}
            busy={busy}
            onBack={() => dispatch({ type: "RETURN_AMBIENT" })}
            onLeaveHome={() => void completeLeave("home")}
            onLeaveNetwork={() => void completeLeave("network")}
          />
        )}

        {inRoom && room.kind === "ambient" && room.panel === "event" && (
          <EventDrawer
            eventName={eventName}
            code={state.session?.code || code}
            joined={Boolean(state.session?.code)}
            calibrated={Boolean(state.session?.calibrated)}
            profileName={user.name}
            participantCount={participants.length}
            onClose={() => dispatch({ type: "CLOSE_LAYER" })}
          />
        )}

        {inRoom && room.kind === "ambient" && room.panel === "people" && (
          <PeopleDrawer
            participants={participants}
            matchFor={matchFor}
            savedIds={savedIds}
            onOpen={openPerson}
            onClose={() => dispatch({ type: "CLOSE_LAYER" })}
          />
        )}

        {inRoom &&
          ((room.kind === "ambient" && room.panel === "recovery") ||
            ((room.kind === "offline" || room.kind === "alignment-lost") &&
              room.recoveryOpen)) && (
            <RecoveryDrawer
              participants={participants}
              distanceTarget={distanceTarget}
              distance={distanceTarget ? distanceFor(distanceTarget) : 0}
              monochrome={monochrome}
              sound={sound}
              busy={busy || matching}
              reliability={
                room.kind === "offline" || room.kind === "alignment-lost"
                  ? room.kind
                  : "online"
              }
              onClose={() => dispatch({ type: "CLOSE_LAYER" })}
              onDistanceTarget={setDistanceTargetId}
              onDistance={(value) => {
                if (!distanceTarget) return;
                setDistanceOverrides((current) => ({
                  ...current,
                  [distanceTarget.id]: value,
                }));
              }}
              onReconnect={() => void reconnect()}
              onRecalibrate={startRecalibration}
              onRun={() => {
                dispatch({ type: "CLOSE_LAYER" });
                void runMatches(false);
              }}
              onKnownDemo={() => {
                dispatch({ type: "CLOSE_LAYER" });
                void runMatches(true);
              }}
              onMonochrome={() => setMonochrome((current) => !current)}
              onSound={() => {
                const nextSound = !soundRef.current;
                setSound(nextSound);
                try {
                  localStorage.setItem("questmatch-sounds", String(nextSound));
                } catch {
                  // Preference remains available for this mounted preview.
                }
                if (nextSound) {
                  try {
                    audioRef.current = new AudioContext();
                  } catch {
                    // Sound stays optional in the browser preview.
                  }
                }
              }}
              onSimulateConnection={() => simulateReliability("offline")}
              onSimulateAlignment={() => simulateReliability("alignment-lost")}
              onSimulateBoundary={simulateBoundary}
              onChangeProfile={() => go("profile")}
              onReset={() => void reset()}
              onLeave={() => {
                dispatch({ type: "CLOSE_LAYER" });
                requestAnimationFrame(() => dispatch({ type: "SHOW_RECAP" }));
              }}
            />
          )}

        {inRoom && (room.kind === "ambient" || room.kind === "profile") && (
          <AmbientDock
            activePanel={room.kind === "ambient" ? room.panel : null}
            matching={matching}
            onPanel={(panel) => {
              if (room.kind === "profile") dispatch({ type: "CLOSE_LAYER" });
              dispatch({ type: "OPEN_PANEL", panel });
            }}
            onMatch={() => {
              if (room.kind === "profile") dispatch({ type: "CLOSE_LAYER" });
              void runMatches(false);
            }}
          />
        )}

        {inRoom && room.kind === "conversation" && focused && (
          <ConversationDock
            name={firstName(focused)}
            saveStatus={savedIds.has(focused.id) ? "saved" : room.saveStatus}
            onSave={() => void saveConnection(focused.id, true)}
            onFinish={finishConversation}
          />
        )}

        <div className="qmv2-stage-caption">
          <span>
            <Glasses size={15} />
            Simulated spatial interface
          </span>
          <span>
            {step === "room"
              ? "Distances and reliability states are developer controls."
              : "Setup is illustrative; no tracking is collected."}
          </span>
        </div>
      </div>

      <footer className="qmv2-underbar">
        <span>
          <span className="qmv2-status-dot" />
          {step === "room"
            ? `${participants.length} sample participants · viewing as ${user.name}`
            : "Guided browser setup"}
        </span>
        <TextAction icon={<ArrowUpRight size={16} />} onClick={() => go("network")}>
          View saved connections
        </TextAction>
      </footer>
    </div>
  );
}

function SetupFlow({
  step,
  code,
  setCode,
  user,
  participants,
  busy,
  returning,
  onJoin,
  onCalibrate,
  onContinue,
  onEnter,
  onBack,
}: {
  step: Exclude<Step, "room">;
  code: string;
  setCode: (value: string) => void;
  user: Profile;
  participants: Profile[];
  busy: boolean;
  returning: boolean;
  onJoin: () => void;
  onCalibrate: () => void;
  onContinue: () => void;
  onEnter: () => void;
  onBack: () => void;
}) {
  const steps: Array<Exclude<Step, "room">> = [
    "join",
    "profile",
    "calibrate",
    "ready",
  ];
  return (
    <div className="qmv2-setup-wrap">
      <section className="qmv2-setup-panel" aria-label="Spatial Salon setup">
        <div className="qmv2-progress" aria-label={`Setup: ${step}`}>
          {steps.map((item, index) => (
            <span
              key={item}
              className={steps.indexOf(step) >= index ? "is-complete" : ""}
            />
          ))}
        </div>

        {step === "join" && (
          <>
            <div className="qmv2-setup-symbol">
              <Mark />
            </div>
            <h2>Enter the Salon</h2>
            <p>
              Join a sample event room before the simulated headset setup
              begins.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onJoin();
              }}
            >
              <label className="qmv2-code-label">
                Event code
                <input
                  required
                  pattern="[A-Z0-9]{3,8}"
                  minLength={3}
                  maxLength={8}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <Button className="qmv2-full" busy={busy} type="submit">
                Join with {code || "code"}
                <ArrowRight size={18} />
              </Button>
            </form>
            <span className="qmv2-helper">
              Use DEMO for the known browser simulation.
            </span>
          </>
        )}

        {step === "profile" && (
          <>
            <div className="qmv2-setup-symbol">
              <Users size={28} />
            </div>
            <h2>Go as yourself.</h2>
            <p>Here’s the introduction people in your room will see.</p>
            <div className="setup-profile">
              <Avatar profile={user} size="large" />
              <h3>{user.name}</h3>
              <p>{user.role}</p>
              {canShow(user, "interests") && (
                <Tags items={user.interests} limit={3} />
              )}
            </div>
            <div className="profile-visibility">
              <Info size={14} />
              <span>
                Only the profile fields you allow are shared in this room.
              </span>
            </div>
            <Button className="qmv2-full" onClick={onContinue}>
              That’s me. Continue
              <ArrowRight size={18} />
            </Button>
            <TextAction
              className="qmv2-text-button"
              icon={<ArrowUpRight size={16} />}
              onClick={() => go("profile")}
            >
              Edit my introduction
            </TextAction>
          </>
        )}

        {step === "calibrate" && (
          <>
            <div className="qmv2-calibration-visual" aria-hidden="true">
              <div className="qmv2-calibration-ring qmv2-calibration-ring--outer" />
              <div className="qmv2-calibration-ring qmv2-calibration-ring--inner" />
              <ArrowUp size={44} />
              <span />
            </div>
            <h2>{returning ? "Restore alignment" : "Share a point of view"}</h2>
            <p>
              In this browser demo, calibration only advances the simulated
              shared origin.
            </p>
            <ol className="qmv2-calibration-list">
              <li>
                <Check size={17} /> Stand on the event’s demo marker.
              </li>
              <li>
                <Check size={17} /> Face the printed directional arrow.
              </li>
              <li>
                <Check size={17} /> Select calibrate to continue.
              </li>
            </ol>
            <Button className="qmv2-full" busy={busy} onClick={onCalibrate}>
              <Crosshair size={18} />
              Calibrate simulation
            </Button>
            <span className="qmv2-helper">
              No camera, room map, or headset tracking is used.
            </span>
          </>
        )}

        {step === "ready" && (
          <>
            <div className="qmv2-ready-symbol">
              <Check size={34} />
            </div>
            <h2>Ready for the room</h2>
            <p>One last check before sample participant cards appear.</p>
            <ul className="qmv2-ready-list">
              <li>
                <Check size={17} /> Event code joined
              </li>
              <li>
                <Check size={17} /> Profile confirmed
              </li>
              <li>
                <Check size={17} /> Demo origin calibrated
              </li>
            </ul>
            <div className="qmv2-demo-area-reminder">
              <Compass size={19} />
              <span>
                Stay inside the marked demo area while exploring the simulated
                room.
              </span>
            </div>
            <div className="qmv2-ready-attendance">
              <div className="qmv2-ready-people" aria-hidden="true">
                {participants.slice(0, 4).map((profile) => (
                  <Avatar profile={profile} key={profile.id} />
                ))}
              </div>
              <span className="qmv2-helper">
                {participants.length} sample participants available
              </span>
            </div>
            <Button className="qmv2-full" onClick={onEnter}>
              Enter Spatial Salon
              <ArrowRight size={18} />
            </Button>
          </>
        )}

        {step !== "join" && (
          <TextAction className="qmv2-back" icon={<ArrowLeft size={16} />} iconPosition="start" onClick={onBack}>
            Back
          </TextAction>
        )}
      </section>
    </div>
  );
}

function ParticipantCard({
  profile,
  match,
  tone,
  distance,
  position,
  selected,
  onOpen,
}: {
  profile: Profile;
  match?: Match;
  tone: CardTone;
  distance: number;
  position: number;
  selected: boolean;
  onOpen: () => void;
}) {
  const band = distanceBand(distance);
  const label =
    tone === "saved" ? "Saved" : tone === "matched" ? "Reason to meet" : null;
  return (
    <button
      type="button"
      className={`qmv2-card qmv2-card--${band} qmv2-card--${tone} qmv2-card--position-${position} ${selected ? "is-selected" : ""}`}
      aria-label={`Open ${profile.name}. ${distance.toFixed(1)} simulated meters away.${label ? ` ${label}.` : ""}`}
      onClick={onOpen}
    >
      {label && (
        <span className="qmv2-card-label">
          {tone === "saved" ? <Check size={15} /> : <Sparkles size={15} />}
          {label}
        </span>
      )}
      {band === "far" ? (
        <div className="qmv2-card-far-name">
          <strong>{firstName(profile)}</strong>
          <span>{distance.toFixed(1)} m · simulated</span>
        </div>
      ) : (
        <>
          <div className="qmv2-card-person">
            <Avatar profile={profile} />
            <div>
              <strong>{firstName(profile)}</strong>
              <span>{profile.role}</span>
            </div>
            <ArrowUpRight size={18} />
          </div>
          {band === "near" && (
            <div className="qmv2-card-detail">
              {match ? (
                <p>{match.reason}</p>
              ) : canShow(profile, "interests") ? (
                <Tags items={profile.interests} limit={2} />
              ) : (
                <p>Open this profile to learn more.</p>
              )}
            </div>
          )}
          <span className="qmv2-distance">
            {distance.toFixed(1)} m · simulated
          </span>
        </>
      )}
      <span className="qmv2-card-tether" aria-hidden="true" />
    </button>
  );
}

function DrawerHeader({
  title,
  label,
  onClose,
}: {
  title: string;
  label?: string;
  onClose: () => void;
}) {
  return (
    <div className="qmv2-drawer-header">
      <div>
        {label && <span>{label}</span>}
        <h2>{title}</h2>
      </div>
      <button
        type="button"
        className="qmv2-icon-button"
        aria-label={`Close ${title}`}
        onClick={onClose}
      >
        <X size={19} />
      </button>
    </div>
  );
}

function ProfileDrawer({
  profile,
  match,
  saved,
  saving,
  onClose,
  onConversation,
  onSave,
  onTestDistance,
}: {
  profile: Profile;
  match?: Match;
  saved: boolean;
  saving: boolean;
  onClose: () => void;
  onConversation: () => void;
  onSave: () => void;
  onTestDistance: () => void;
}) {
  return (
    <aside
      className="qmv2-drawer qmv2-profile-drawer"
      aria-label={`${profile.name} profile`}
    >
      <div className="qmv2-drawer-header">
        <span>
          <Sparkles size={16} />
          {match
            ? "A reason to meet"
            : saved
              ? "Saved profile"
              : "Nearby profile"}
        </span>
        <button
          type="button"
          className="qmv2-icon-button"
          aria-label={`Close ${profile.name}`}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <div className="qmv2-profile-lead">
        <Avatar profile={profile} size="large" />
        <div>
          <h2>{profile.name}</h2>
          <p>{profile.role}</p>
        </div>
      </div>
      {canShow(profile, "bio") && profile.bio && (
        <p className="qmv2-profile-bio">{profile.bio}</p>
      )}
      {match && (
        <div className="qmv2-reason">
          <Sparkles size={19} />
          <div>
            <p>{match.reason}</p>
          </div>
        </div>
      )}
      {canShow(profile, "interests") && profile.interests.length > 0 && (
        <section className="qmv2-profile-section">
          <h3>Curious about</h3>
          <Tags items={profile.interests} />
        </section>
      )}
      {canShow(profile, "skills") && profile.skills.length > 0 && (
        <section className="qmv2-profile-section">
          <h3>Can help with</h3>
          <Tags items={profile.skills} />
        </section>
      )}
      {canShow(profile, "lookingFor") && profile.lookingFor.length > 0 && (
        <section className="qmv2-profile-section">
          <h3>Would like to meet</h3>
          <p>{profile.lookingFor.join(" · ")}</p>
        </section>
      )}
      <div className="qmv2-profile-actions">
        <Button variant="green" onClick={onConversation}>
          <MessageCircle size={18} />
          Start conversation
        </Button>
        <Button
          variant="secondary"
          busy={saving}
          disabled={saved}
          onClick={onSave}
        >
          {saved ? <Check size={18} /> : <ArrowUpRight size={18} />}
          {saved ? "Saved" : "Save connection"}
        </Button>
      </div>
      {saved && (
        <span className="qmv2-saved-note">
          <Check size={15} /> Saved to your website network
        </span>
      )}
      <small className="qmv2-source-note">
        Sample profile · browser-simulated distance and matching
      </small>
      <button
        type="button"
        className="qmv2-profile-distance"
        onClick={onTestDistance}
      >
        <Settings2 size={15} /> Test simulated distance
      </button>
    </aside>
  );
}

function ConversationView({
  profile,
  promptOpen,
  saveStatus,
  onDismissPrompt,
}: {
  profile: Profile;
  promptOpen: boolean;
  saveStatus: SaveStatus;
  onDismissPrompt: () => void;
}) {
  return (
    <section
      className="qmv2-conversation"
      aria-label={`Conversation with ${profile.name}`}
    >
      <div className="qmv2-conversation-person">
        <Avatar profile={profile} size="large" />
        <div>
          <h2>Talking with {firstName(profile)}</h2>
          <p>The rest of the simulated room is quiet.</p>
        </div>
        {saveStatus === "saved" && (
          <span className="qmv2-mini-saved">
            <Check size={15} /> Saved
          </span>
        )}
      </div>
      {promptOpen && (
        <div className="qmv2-conversation-prompt">
          <button
            type="button"
            className="qmv2-icon-button"
            aria-label="Dismiss conversation prompt"
            onClick={onDismissPrompt}
          >
            <X size={18} />
          </button>
          <span>Optional opening</span>
          <p>“What inspired what you’re building?”</p>
        </div>
      )}
    </section>
  );
}

function ConversationDock({
  name,
  saveStatus,
  onSave,
  onFinish,
}: {
  name: string;
  saveStatus: SaveStatus;
  onSave: () => void;
  onFinish: () => void;
}) {
  return (
    <nav
      className="qmv2-dock qmv2-conversation-dock"
      aria-label="Conversation actions"
    >
      <button
        type="button"
        disabled={saveStatus === "saved" || saveStatus === "saving"}
        onClick={onSave}
      >
        {saveStatus === "saving" ? (
          <LoaderCircle className="spin" size={19} />
        ) : saveStatus === "saved" ? (
          <Check size={19} />
        ) : (
          <ArrowUpRight size={19} />
        )}
        <span>{saveStatus === "saved" ? "Saved" : `Save ${name}`}</span>
      </button>
      <button type="button" className="is-primary" onClick={onFinish}>
        <Check size={19} />
        <span>Finish</span>
      </button>
    </nav>
  );
}

function AmbientDock({
  activePanel,
  matching,
  onPanel,
  onMatch,
}: {
  activePanel: AmbientPanel;
  matching: boolean;
  onPanel: (panel: Exclude<AmbientPanel, null>) => void;
  onMatch: () => void;
}) {
  return (
    <nav className="qmv2-dock" aria-label="Spatial Salon controls">
      <button
        type="button"
        className={activePanel === "event" ? "is-active" : ""}
        aria-pressed={activePanel === "event"}
        onClick={() => onPanel("event")}
      >
        <Info size={19} />
        <span>Event</span>
      </button>
      <button
        type="button"
        className={activePanel === "people" ? "is-active" : ""}
        aria-pressed={activePanel === "people"}
        onClick={() => onPanel("people")}
      >
        <Users size={19} />
        <span>People</span>
      </button>
      <button
        type="button"
        className="is-primary"
        disabled={matching}
        onClick={onMatch}
      >
        {matching ? (
          <LoaderCircle className="spin" size={19} />
        ) : (
          <Sparkles size={19} />
        )}
        <span>{matching ? "Matching" : "Find matches"}</span>
      </button>
      <button
        type="button"
        className={activePanel === "recovery" ? "is-active" : ""}
        aria-pressed={activePanel === "recovery"}
        onClick={() => onPanel("recovery")}
      >
        <Settings2 size={19} />
        <span>Demo</span>
      </button>
    </nav>
  );
}

function EventDrawer({
  eventName,
  code,
  joined,
  calibrated,
  profileName,
  participantCount,
  onClose,
}: {
  eventName: string;
  code: string;
  joined: boolean;
  calibrated: boolean;
  profileName: string;
  participantCount: number;
  onClose: () => void;
}) {
  const rows = [
    ["Session", joined ? `${eventName} · ${code}` : "Not joined"],
    ["Joined", joined ? "Yes" : "No"],
    ["Calibrated", calibrated ? "Yes" : "No"],
    ["Profile", profileName],
    ["Participants", `${participantCount} sample profiles`],
  ];
  return (
    <aside
      className="qmv2-drawer qmv2-event-drawer"
      aria-label="Event information"
    >
      <DrawerHeader
        title="Event status"
        label="Actual mock session"
        onClose={onClose}
      />
      <dl>
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <small className="qmv2-source-note">
        This panel reflects only the current local mock session.
      </small>
    </aside>
  );
}

function PeopleDrawer({
  participants,
  matchFor,
  savedIds,
  onOpen,
  onClose,
}: {
  participants: Profile[];
  matchFor: (id: string) => Match | undefined;
  savedIds: Set<string>;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <aside
      className="qmv2-drawer qmv2-people-drawer"
      aria-label="People in this room"
    >
      <DrawerHeader
        title="People in this room"
        label="Sample participants"
        onClose={onClose}
      />
      <p>Only three profiles appear in the photo composition at once.</p>
      <div className="qmv2-people-list">
        {participants.map((profile) => (
          <button
            type="button"
            key={profile.id}
            onClick={() => onOpen(profile.id)}
          >
            <Avatar profile={profile} />
            <span>
              <strong>{profile.name}</strong>
              <small>{profile.role}</small>
            </span>
            {savedIds.has(profile.id) ? (
              <Check size={18} />
            ) : matchFor(profile.id) ? (
              <Sparkles size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
          </button>
        ))}
      </div>
      <small className="qmv2-source-note">
        Fictional demo profiles · not live headset participants
      </small>
    </aside>
  );
}

function RecoveryDrawer({
  participants,
  distanceTarget,
  distance,
  monochrome,
  sound,
  busy,
  reliability,
  onClose,
  onDistanceTarget,
  onDistance,
  onReconnect,
  onRecalibrate,
  onRun,
  onKnownDemo,
  onMonochrome,
  onSound,
  onSimulateConnection,
  onSimulateAlignment,
  onSimulateBoundary,
  onChangeProfile,
  onReset,
  onLeave,
}: {
  participants: Profile[];
  distanceTarget?: Profile;
  distance: number;
  monochrome: boolean;
  sound: boolean;
  busy: boolean;
  reliability: "online" | ReliabilityKind;
  onClose: () => void;
  onDistanceTarget: (id: string) => void;
  onDistance: (value: number) => void;
  onReconnect: () => void;
  onRecalibrate: () => void;
  onRun: () => void;
  onKnownDemo: () => void;
  onMonochrome: () => void;
  onSound: () => void;
  onSimulateConnection: () => void;
  onSimulateAlignment: () => void;
  onSimulateBoundary: () => void;
  onChangeProfile: () => void;
  onReset: () => void;
  onLeave: () => void;
}) {
  return (
    <aside
      className="qmv2-drawer qmv2-recovery-drawer"
      aria-label="Demo and recovery controls"
    >
      <DrawerHeader
        title="Demo & recovery"
        label="Browser test harness"
        onClose={onClose}
      />
      <p className="qmv2-drawer-intro">
        Replay setup, matching, distance, and interruption states without
        implying real headset sensing.
      </p>

      <section className="qmv2-distance-lab">
        <h3>Simulated distance</h3>
        {distanceTarget ? (
          <>
            <label>
              Participant
              <select
                value={distanceTarget.id}
                onChange={(event) => onDistanceTarget(event.target.value)}
              >
                {participants.map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                Card distance
                <output>{distance.toFixed(1)} m</output>
              </span>
              <input
                type="range"
                min="0.8"
                max="7"
                step="0.1"
                value={distance}
                onChange={(event) => onDistance(Number(event.target.value))}
              />
            </label>
            <small>
              Near shows context, medium shows identity, and far shows a name.
            </small>
          </>
        ) : (
          <p>No remote sample profiles are available.</p>
        )}
      </section>

      <div className="qmv2-control-list">
        <ControlRow
          icon={<RefreshCw size={19} />}
          title="Reconnect"
          detail={
            reliability === "offline"
              ? "Restore the mock connection"
              : "Replay connection recovery"
          }
          disabled={busy}
          onClick={onReconnect}
        />
        <ControlRow
          icon={<Crosshair size={19} />}
          title="Recalibrate"
          detail="Reset the simulated shared origin"
          disabled={busy || reliability === "offline"}
          onClick={onRecalibrate}
        />
        <ControlRow
          icon={<RefreshCw size={19} />}
          title="Re-run matching"
          detail="Use the current visible profile fields"
          disabled={busy || reliability !== "online"}
          onClick={onRun}
        />
        <ControlRow
          icon={<Sparkles size={19} />}
          title="Known demo match"
          detail="Use the deterministic demo pairing"
          disabled={busy || reliability !== "online"}
          onClick={onKnownDemo}
        />
        <ControlRow
          icon={<Users size={19} />}
          title="Change profile"
          detail="Open the website profile editor"
          onClick={onChangeProfile}
        />
      </div>

      <div className="qmv2-toggle-row">
        <span>
          <strong>Match sound</strong>
          <small>Optional browser cue</small>
        </span>
        <span className="qmv2-toggle-control">
          {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
          <Toggle checked={sound} onChange={onSound} label="Match sound" />
        </span>
      </div>
      <div className="qmv2-toggle-row">
        <span>
          <strong>Monochrome room</strong>
          <small>Contrast preview only</small>
        </span>
        <Toggle
          checked={monochrome}
          onChange={onMonochrome}
          label="Monochrome room"
        />
      </div>

      <section className="qmv2-simulation-controls">
        <h3>Developer simulations</h3>
        <p>These controls test UI behavior, not physical safety systems.</p>
        <div>
          <button type="button" onClick={onSimulateConnection}>
            Connection loss
          </button>
          <button type="button" onClick={onSimulateAlignment}>
            Alignment loss
          </button>
          <button type="button" onClick={onSimulateBoundary}>
            Leave demo area
          </button>
        </div>
      </section>

      <div className="qmv2-control-list qmv2-control-list--closing">
        <ControlRow
          icon={<RotateCcw size={19} />}
          title="Reset demo"
          detail="Restore the seeded local session"
          disabled={busy}
          onClick={onReset}
        />
        <ControlRow
          icon={<LogOut size={19} />}
          title="Leave Spatial Salon"
          detail="Review this local session first"
          disabled={busy}
          onClick={onLeave}
        />
      </div>
    </aside>
  );
}

function ControlRow({
  icon,
  title,
  detail,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}>
      {icon}
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <ChevronRight size={17} />
    </button>
  );
}

function ReliabilityState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <section className="qmv2-reliability" aria-live="polite">
      {icon}
      <h2>{title}</h2>
      <p>{description}</p>
      <Button onClick={onAction}>
        {action}
        <ArrowRight size={17} />
      </Button>
      <small>Browser simulation</small>
    </section>
  );
}

function Recap({
  savedProfiles,
  conversationCount,
  busy,
  onBack,
  onLeaveHome,
  onLeaveNetwork,
}: {
  savedProfiles: Profile[];
  conversationCount: number;
  busy: boolean;
  onBack: () => void;
  onLeaveHome: () => void;
  onLeaveNetwork: () => void;
}) {
  return (
    <section className="qmv2-recap" aria-label="Session recap">
      <TextAction className="qmv2-back" icon={<ArrowLeft size={16} />} iconPosition="start" onClick={onBack}>
        Return to room
      </TextAction>
      <div className="qmv2-ready-symbol">
        <Check size={34} />
      </div>
      <h2>Your Salon recap</h2>
      <p>
        {conversationCount === 1
          ? "1 conversation completed in this browser session."
          : `${conversationCount} conversations completed in this browser session.`}
      </p>
      <div className="qmv2-recap-saved">
        <h3>Saved connections</h3>
        {savedProfiles.length > 0 ? (
          savedProfiles.map((profile) => (
            <div key={profile.id}>
              <Avatar profile={profile} />
              <span>
                <strong>{profile.name}</strong>
                <small>{profile.role}</small>
              </span>
              <Check size={17} />
            </div>
          ))
        ) : (
          <p>No connections were saved in your current website network.</p>
        )}
      </div>
      <div className="qmv2-recap-actions">
        <Button busy={busy} onClick={onLeaveNetwork}>
          View website network
          <ArrowUpRight size={17} />
        </Button>
        <Button variant="secondary" busy={busy} onClick={onLeaveHome}>
          Leave to overview
        </Button>
      </div>
      <small className="qmv2-source-note">
        Leaving ends the room session while preserving your profile and saved
        connections.
      </small>
    </section>
  );
}
