import { useEffect, useState } from "react";
import { GitGraph, List } from "lucide-react";
import type { Action, Profile, State } from "./types";
import { ConnectionInbox } from "./ConnectionInbox";
import { PeopleDirectory } from "./PeopleDirectory";
import { NetworkGraph } from "./NetworkGraph";
import { openPersonProfile } from "./PeopleDirectory";
import "./NetworkPage.css";

type Props = { state: State; user: Profile; connected: string[]; act: Action; busy: boolean; notify: (message: string) => void };

export function NetworkProduct({ state, user, act, busy, notify }: Props) {
  const [view, setView] = useState<"graph" | "people">("graph");

  useEffect(() => {
    const [path, raw = ""] = location.hash.split("?");
    const query = new URLSearchParams(raw);
    if (path !== "#/network" || query.get("tab") !== "discover") return;
    query.delete("tab");
    query.set("tab", "people");
    history.replaceState(history.state, "", `#/home?${query}`);
    dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  return (
    <div className="nx-page">
      <div className="nx-network-view-toggle" role="group" aria-label="Network view">
        <button aria-pressed={view === "graph"} onClick={() => setView("graph")}>
          <GitGraph size={15} aria-hidden="true" /> Graph
        </button>
        <button aria-pressed={view === "people"} onClick={() => setView("people")}>
          <List size={15} aria-hidden="true" /> List
        </button>
      </div>
      {view === "graph" ? (
        <NetworkGraph
          viewerId={user.id}
          eventId={state.session?.activeEventId ?? null}
          onSelectPerson={(id) => openPersonProfile(id, undefined, "network")}
        />
      ) : (
        <PeopleDirectory state={state} user={user} act={act} busy={busy} notify={notify} mode="network" pageHeading plain headerContent={<ConnectionInbox state={state} user={user} act={act} busy={busy} notify={notify} />} />
      )}
      <p className="nx-footnote">Saved profiles are private. Connection requests let the other person choose whether to connect.</p>
    </div>
  );
}
