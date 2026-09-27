import { useEffect } from "react";
import type { Action, Profile, State } from "./types";
import { ConnectionInbox } from "./ConnectionInbox";
import { PeopleDirectory } from "./PeopleDirectory";
import { PageHeader } from "./ui";
import "./NetworkPage.css";

type Props = { state: State; user: Profile; connected: string[]; act: Action; busy: boolean; notify: (message: string) => void };

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
      <PageHeader className="nx-heading" title="Your network" description="People you've saved or connected with. Pick up where you left off." />
      <ConnectionInbox state={state} user={user} act={act} busy={busy} notify={notify} />
      <PeopleDirectory state={state} user={user} act={act} busy={busy} notify={notify} mode="network" allowMap={false} />
      <p className="nx-footnote">Saved profiles are private. Connection requests let the other person choose whether to connect.</p>
    </div>
  );
}
