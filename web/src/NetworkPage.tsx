import { useEffect, useState } from "react";
import { GitGraph, List } from "lucide-react";
import { NetworkGraph } from "./NetworkGraph";
import type { Action, Profile, State } from "./types";
import { ConnectionInbox } from "./ConnectionInbox";
import { PeopleDirectory } from "./PeopleDirectory";
import { PageHeader } from "./ui";
import "./NetworkPage.css";

type Props = { state: State; user: Profile; connected: string[]; act: Action; busy: boolean; notify: (message: string) => void };

export function NetworkProduct({ state, user, act, busy, notify }: Props) {
  const [view, setView] = useState<'graph' | 'list'>('list');
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
      <PageHeader className="nx-heading" title="Your network" description="Explore the people you know—and the people you have a reason to meet." />
      <ConnectionInbox state={state} user={user} act={act} busy={busy} notify={notify} />
      <div className="nx-graph-view-switch" role="group" aria-label="Network view"><button aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={15} />List</button><button aria-pressed={view === 'graph'} onClick={() => setView('graph')}><GitGraph size={15} />Graph</button></div>
      {view === 'graph' ? <NetworkGraph state={state} user={user} /> : <PeopleDirectory state={state} user={user} act={act} busy={busy} notify={notify} mode="network" allowMap={false} />}
      <p className="nx-footnote">Saved profiles are private. Connection requests let the other person choose whether to connect.</p>
    </div>
  );
}
