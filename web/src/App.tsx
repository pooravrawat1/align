import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Compass,
  ExternalLink,
  Glasses,
  Home,
  LayoutGrid,
  Menu,
  Network,
  Plus,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import seed from "../shared/demo-data.json";
import { Avatar, Brand, Button, Empty, Mark } from "./ui";
import { Spatial } from "./Spatial";
import { Landing } from "./Landing";
import { HomeProduct, EventProduct } from "./ProductPages";
import { NetworkProduct, ProfileProduct } from "./PersonalPages";
import { clearSessionProfileDrafts, useProfileEditor } from "./useProfileEditor";
import type { Action, State } from "./types";
import { Onboarding, entryDraftKey, type OnboardingDetails } from "./Onboarding";

const initial: State = { ...seed, matches: [], session: null, demo: true };
const route = () => {
  const p = location.hash.replace("#/", "").split("?")[0] || "landing";
  return p === "events" ? "event" : p === "settings" ? "profile" : p;
};
export const go = (path: string) => {
  location.hash = path === "landing" ? "/" : `/${path}`;
};
function readSession() {
  try {
    return sessionStorage.getItem("questmatch-session");
  } catch {
    return null;
  }
}

export default function App() {
  const [page, setPage] = useState(route);
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [bootstrapError, setBootstrapError] = useState("");
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [pending, setPending] = useState(0);
  const busy = pending > 0;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const stateRef = useRef(state);
  const revision = useRef(0);
  const putState = (data: State) => {
    stateRef.current = data;
    setState(data);
  };
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [entryActive, setEntryActive] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const entrySubmission = useRef(false);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  const [solid, setSolid] = useState(() => {
    try {
      return localStorage.getItem("questmatch-solid") === "true";
    } catch {
      return false;
    }
  });
  const sessionId = useRef<string | null>(readSession());
  const request = async (
    path: string,
    body?: unknown,
    method = "POST",
  ): Promise<State | { ok: true }> => {
    const response = await fetch(`/api/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(sessionId.current ? { "x-session-id": sessionId.current } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(data.error || "Something went wrong. Please try again."),
        { status: response.status },
      );
    return data;
  };
  const act: Action = (path, body, method) => {
    revision.current += 1;
    setPending((n) => n + 1);
    const task = queue.current
      .catch(() => undefined)
      .then(async () => {
        setError("");
        try {
          const data = await request(path, body, method);
          if ("profiles" in data) {
            putState(data);
            if (path === "login" && data.session) {
              sessionId.current = data.session.id;
              try {
                sessionStorage.setItem("questmatch-session", data.session.id);
              } catch {
                /* Memory state remains usable. */
              }
            }
            return data;
          }
          return stateRef.current;
        } catch (e) {
          if (e instanceof Error && "status" in e && e.status === 401) {
            clearSessionProfileDrafts(sessionId.current);
            sessionId.current = null;
            putState({ ...stateRef.current, session: null });
            try { sessionStorage.removeItem("questmatch-session"); } catch { /* Session is cleared in memory. */ }
          }
          setError(
            e instanceof TypeError
              ? "The local demo service is unavailable. Start npm run dev, then try again."
              : e instanceof Error
                ? e.message
                : "Could not reach the demo service.",
          );
          throw e;
        } finally {
          setPending((n) => n - 1);
        }
      });
    queue.current = task;
    return task;
  };
  useEffect(() => {
    let currentPage = route();
    const change = () => {
      const nextPage = route();
      setPage(nextPage);
      setEntryActive(false);
      setMenu(false);
      setError("");
      if (nextPage !== currentPage) window.scrollTo(0, 0);
      currentPage = nextPage;
    };
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    let active = true;
    const startRevision = revision.current;
    request("bootstrap", undefined, "GET")
      .then((data) => {
        if (active && revision.current === startRevision && "profiles" in data)
          putState(data);
      })
      .catch((failure: unknown) => {
        if (active && revision.current === startRevision) {
          if (
            failure instanceof Error &&
            "status" in failure &&
            failure.status === 401
          ) {
            clearSessionProfileDrafts(sessionId.current);
            sessionId.current = null;
            try {
              sessionStorage.removeItem("questmatch-session");
            } catch {
              /* No storage available. */
            }
          } else {
            setBootstrapError(
              "The local demo service couldn’t be reached. Your session reference has been kept. Try reconnecting.",
            );
          }
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [bootstrapAttempt]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.documentElement.classList.toggle("solid-surfaces", solid);
    try {
      localStorage.setItem("questmatch-solid", String(solid));
    } catch {
      /* In-memory preference remains usable. */
    }
  }, [solid]);
  const user =
    state.profiles.find((p) => p.id === state.session?.userId) ||
    state.profiles[0];
  const { editor: profileEditor, snapshot: profileSnapshot } = useProfileEditor(user, state.session?.id ?? null);
  const connected = state.connections
    .filter((c) => (c.ownerId ? c.ownerId === user.id : c.userA === user.id))
    .map((c) => c.participantId || (c.userA === user.id ? c.userB : c.userA));
  const login = async (id: string, details: OnboardingDetails): Promise<boolean> => {
    if (entrySubmission.current) return false;
    entrySubmission.current = true;
    setEntrySaving(true);
    setEntryActive(true);
    const entryRoute = location.hash;
    try {
      if (stateRef.current.session?.userId !== id) {
        await act("login", { profileId: id });
      }
      await act("profile", details, "PATCH");
      if (stateRef.current.session?.code !== "DEMO") {
        await act("room", { code: "DEMO" });
      }
      if (location.hash === entryRoute) {
        setEntryActive(false);
        go("home");
      }
      return true;
    } catch (failure) {
      if (failure instanceof Error && "status" in failure && failure.status === 401) {
        sessionId.current = null;
        putState({ ...stateRef.current, session: null });
        try { sessionStorage.removeItem("questmatch-session"); } catch { /* Memory reference is cleared. */ }
        setError("Your demo session expired. Your draft is safe—try again.");
      }
      return false;
    } finally {
      entrySubmission.current = false;
      setEntrySaving(false);
    }
  };
  const logout = async () => {
    try {
      await act("logout");
      clearSessionProfileDrafts(sessionId.current);
      sessionId.current = null;
      try {
        sessionStorage.removeItem("questmatch-session");
        sessionStorage.removeItem(entryDraftKey);
      } catch {
        /* Memory cleared below. */
      }
      putState(initial);
      setEntryActive(false);
      setPage("landing");
      go("landing");
    } catch {
      /* Inline error. */
    }
  };
  const addConnection = async (id: string) => {
    await act("connections", { participantId: id });
    setToast("Connection saved. Find them in your network.");
  };
  const sharedProps = { state, user, connected, act, busy, notify: setToast };
  const event = state.events.find((e) => e.code === state.session?.code);
  const isPublic = ["landing", "login"].includes(page);
  useEffect(() => {
    // Keep an unfinished entry refreshable even after a partial session creation.
    if (ready && !bootstrapError && !state.session && !isPublic) go("login");
  }, [ready, bootstrapError, state.session, isPublic]);
  const activePage = entryActive || (!isPublic && !state.session && ready) ? "login" : page;
  const nav = [
    { id: "home", name: "Home", icon: Home },
    { id: "event", name: "Event", icon: CalendarDays },
    { id: "network", name: "Network", icon: Network },
    { id: "profile", name: "Profile", icon: UserRound },
  ];
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      {!ready ? (
        <main className="loading-screen" id="main-content" tabIndex={-1}>
          <Mark />
          <p role="status">Opening your space…</p>
        </main>
      ) : bootstrapError ? (
        <main className="loading-screen" id="main-content" tabIndex={-1}>
          <Mark />
          <p role="alert">{bootstrapError}</p>
          <Button
            onClick={() => {
              setBootstrapError("");
              setReady(false);
              setBootstrapAttempt((attempt) => attempt + 1);
            }}
          >
            Reconnect
          </Button>
        </main>
      ) : activePage === "landing" ? (
        <Landing
          profiles={state.profiles}
          onEnter={() => go("login")}
        />
      ) : activePage === "login" ? (
        <Onboarding
          profiles={state.profiles}
          initialProfileId={state.session?.userId ?? "alex"}
          busy={busy || entrySaving || !ready}
          onComplete={login}
          error={error}
        />
      ) : (
        <div
          className={`app-layout ${page === "spatial" ? "spatial-layout" : ""}`}
        >
          <aside className={`sidebar ${menu ? "open" : ""}`}>
            <Brand compact showLogo />
            <div className="workspace-label">
              <span className="workspace-monogram">B</span>
              <span>
                {event?.name || "The Builders Room"}
                <small>Your shared space</small>
              </span>
            </div>
            <nav aria-label="Main navigation">
              {nav.map(({ id, name, icon: Icon }) => (
                <a
                  key={id}
                  href={`#/${id}`}
                  className={page === id ? "active" : ""}
                  aria-current={page === id ? "page" : undefined}
                >
                  <Icon size={18} />
                  <span>{name}</span>
                  {id === "network" && (
                    <span className="nav-count">{connected.length}</span>
                  )}
                </a>
              ))}
            </nav>
            <div className="sidebar-divider" />
            <nav aria-label="Experience navigation">
              <a
                href="#/spatial"
                className={page === "spatial" ? "active" : ""}
              >
                <Glasses size={18} />
                <span>Spatial preview</span>
              </a>
              <a href="#/map" className={page === "map" ? "active" : ""}>
                <LayoutGrid size={18} />
                <span>Experience map</span>
              </a>
            </nav>
            <div className="sidebar-bottom">
              <div className="demo-note">
                <span className="status-dot" />
                <span>
                  A little common ground.
                  <small>Spatial Salon · interactive preview</small>
                </span>
              </div>
              <button className="account" onClick={() => go("profile")}>
                <Avatar profile={user} />
                <span>
                  {user.name}
                  <small>Personal space</small>
                </span>
                <ChevronDown size={14} />
              </button>
            </div>
          </aside>
          {menu && (
            <button
              className="sidebar-scrim"
              aria-label="Close navigation"
              onClick={() => setMenu(false)}
            />
          )}
          <main className="app-main" id="main-content" tabIndex={-1}>
            <header className="app-header">
              <div>
                <button
                  className="icon-button mobile-menu"
                  aria-label="Open navigation"
                  onClick={() => setMenu(true)}
                >
                  <Menu size={20} />
                </button>
                <span>Your space</span>
                <span className="breadcrumb-slash">/</span>
                <strong>
                  {nav.find((n) => n.id === page)?.name ||
                    (page === "spatial"
                      ? "Spatial experience"
                      : page === "map"
                        ? "Experience map"
                        : "Settings")}
                </strong>
              </div>
              <div>
                {page !== "home" && (
                  <>
                <span className="header-live">
                  <span className="status-dot" />
                  {event
                    ? event.name + " · demo live"
                    : "The Builders Room · demo available"}
                </span>
                <Button className="header-enter" onClick={() => go("spatial")}>
                  Enter <ArrowUpRight size={12} />
                </Button>
                  </>
                )}
                <button
                  className="icon-button"
                  aria-label="Open your profile"
                  onClick={() => go("profile")}
                >
                  <Avatar profile={user} size="small" />
                </button>
              </div>
            </header>
            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {page === "home" && <HomeProduct {...sharedProps} />}
            {page === "event" && <EventProduct {...sharedProps} />}
            {page === "network" && <NetworkProduct {...sharedProps} />}
            {page === "profile" && (
              <ProfileProduct
                key={user.id}
                {...sharedProps}
                editor={profileEditor}
                snapshot={profileSnapshot}
                solid={solid}
                setSolid={setSolid}
                logout={logout}
              />
            )}
            {page === "spatial" && (
              <Spatial
                state={state}
                user={user}
                act={act}
                busy={busy}
                connected={connected}
                onConnect={addConnection}
                notify={setToast}
              />
            )}
            {page === "map" && <ExperienceMap />}
            {![
              "home",
              "event",
              "network",
              "profile",
              "spatial",
              "map",
              "settings",
            ].includes(page) && (
              <Empty title="This space is still taking shape.">
                <a href="#/home">Back to your overview</a>
              </Empty>
            )}
          </main>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-check">
            <Check size={15} />
          </span>
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}


function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

function ExperienceMap() {
  const lanes = [
    {
      name: "Before the room",
      detail: "Make the first introduction easy.",
      steps: [
        {
          name: "Discover",
          body: "Understand the experience.",
          route: "landing",
          icon: Compass,
        },
        {
          name: "Introduce yourself",
          body: "Share your work, interests, and asks.",
          route: "profile",
          icon: UserRound,
        },
        {
          name: "Find your event",
          body: "Join a shared room by code.",
          route: "event",
          icon: CalendarDays,
        },
      ],
    },
    {
      name: "In the moment",
      detail: "Let the room—and the people—lead.",
      steps: [
        {
          name: "Get aligned",
          body: "A guided spatial calibration.",
          route: "spatial",
          icon: Glasses,
        },
        {
          name: "Find a reason to meet",
          body: "Neutral cards reveal useful matches.",
          route: "spatial",
          icon: Sparkles,
        },
        {
          name: "Start a conversation",
          body: "Quiet the room. Focus on a person.",
          route: "spatial",
          icon: Users,
        },
      ],
    },
    {
      name: "After hello",
      detail: "Let a conversation become a connection.",
      steps: [
        {
          name: "Keep the connection",
          body: "Save someone deliberately.",
          route: "network",
          icon: Plus,
        },
        {
          name: "See your network",
          body: "Revisit people and shared context.",
          route: "network",
          icon: Network,
        },
        {
          name: "Make room for more",
          body: "Refine your profile. Explore again.",
          route: "home",
          icon: Home,
        },
      ],
    },
  ];
  return (
    <div className="page-content">
      <PageHeading
        title="One experience. Three human moments."
        description="The website prepares the introduction. The headset makes room for the conversation."
      />
      <div className="experience-lanes">
        {lanes.map((lane, i) => (
          <section key={lane.name}>
            <div className="lane-heading">
              <span>0{i + 1}</span>
              <div>
                <h2>{lane.name}</h2>
                <p>{lane.detail}</p>
              </div>
            </div>
            <div className="lane-steps">
              {lane.steps.map(({ name, body, route: target, icon: Icon }) => (
                <button
                  className="map-step surface"
                  key={name}
                  onClick={() => go(target)}
                >
                  <Icon size={22} />
                  <h3>{name}</h3>
                  <p>{body}</p>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="map-principles">
        <h2>Designed around people.</h2>
        <div>
          <p>
            <Check size={17} />
            Reasons to connect, never public rankings.
          </p>
          <p>
            <Check size={17} />A quiet mode while you’re talking.
          </p>
          <p>
            <Check size={17} />A deliberate choice to save a connection.
          </p>
          <p>
            <Check size={17} />
            Only the information people choose to share.
          </p>
        </div>
      </div>
      <div className="map-boundary">
        <Glasses size={22} />
        <p>
          <strong>What this prototype demonstrates</strong>Website flows,
          profile editing, sample matching, spatial interface states,
          conversation mode, and a personal connection map. Headset tracking,
          passthrough, and real multiplayer need the Unity implementation.
        </p>
        <a href="/docs/PRODUCT.md" target="_blank" rel="noreferrer">
          Read the expanded PRD
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
