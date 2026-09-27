import { useEffect } from "react";
import type { Action, Profile, State } from "./types";
import { PeopleDirectory } from "./PeopleDirectory";
import { PageHeader } from "./ui";
import "./NetworkPage.css";

type Props = { state: State; user: Profile; act: Action; busy: boolean; notify: (message: string) => void };

export function NetworkProduct({ state, user, act, busy, notify }: Props) {
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
      <PageHeader className="nx-heading" title="People you’ve met" description="Remember where you crossed paths, what you share, and what to pick up next time." />
      <PeopleDirectory state={state} user={user} act={act} busy={busy} notify={notify} mode="network" allowMap={false} />
      <p className="nx-footnote">Your notes and follow-up details stay private.</p>
    </div>
  );
}
