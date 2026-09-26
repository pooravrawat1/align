import { ArrowUpRight, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";
import type { Profile } from "./types";
import { Avatar, Button, Chip, Disclosure, PageHeader, PanelHeader, TextAction, Toggle } from "./ui";
import "./DesignSystemPage.css";

export function DesignSystemPage({ user }: { user: Profile }) {
  const [exampleVisible, setExampleVisible] = useState(true);

  return (
    <div className="ds-reference-page">
      <PageHeader title="Catalyst design system" description="The shared typography, surfaces, controls, and content hierarchy used across the product experience." />

      <section className="ds-reference-section" aria-labelledby="ds-type-title">
        <PanelHeader title="Typography" description="Geist carries identity and hierarchy. Inter carries reading and interaction." icon={<UserRound size={19} />} headingId="ds-type-title" />
        <div className="ds-type-specimens">
          <div><span>Page title</span><p className="ds-type-page">Your network</p></div>
          <div><span>Dialog title</span><p className="ds-type-dialog">Leo Park</p></div>
          <div><span>Card heading</span><p className="ds-type-card">Recent connections</p></div>
          <div><span>Section heading</span><p className="ds-type-section">Common ground</p></div>
          <div><span>Body</span><p className="ds-type-body">A little context makes the first conversation easier.</p></div>
          <div><span>Supporting</span><p className="ds-type-supporting">People with something in common</p></div>
          <div><span>Metadata</span><p className="ds-type-metadata">September 26 · The Builders Room</p></div>
          <div><span>Entry hint · inherits control size</span><input aria-label="Entry hint example" placeholder="Add interest…" /></div>
        </div>
      </section>

      <section className="ds-reference-section" aria-labelledby="ds-surface-title">
        <PanelHeader title="Surface hierarchy" description="Black recesses content; charcoal holds work; lighter charcoal signals interaction." icon={<Sparkles size={19} />} headingId="ds-surface-title" />
        <div className="ds-surface-grid">
          <div className="ds-surface-swatch ds-surface-swatch--canvas"><strong>Canvas</strong><span>#101113</span></div>
          <div className="ds-surface-swatch ds-surface-swatch--panel"><strong>Panel</strong><span>#191A1D</span></div>
          <div className="ds-surface-swatch ds-surface-swatch--subtle"><strong>Nested</strong><span>Raised charcoal · luminous edge · soft shadow</span></div>
          <div className="ds-surface-swatch ds-surface-swatch--raised"><strong>Raised control</strong><span>#222428</span></div>
          <div className="ds-surface-swatch ds-surface-swatch--selected"><strong>Selected</strong><span>#2B2D32</span></div>
        </div>
      </section>

      <section className="ds-reference-section" aria-labelledby="ds-accent-title">
        <PanelHeader title="Accent color" description="One jade, reserved for meaningful positive state." headingId="ds-accent-title" />
        <div className="ds-accent-role">
          <span className="ds-accent-swatch" aria-hidden="true" />
          <div>
            <strong>State Jade</strong>
            <code>--accent · #69E6A6</code>
            <p>Use for live presence, readiness, connection, compatibility, focus, and completion. Primary actions remain white.</p>
          </div>
          <div className="ds-accent-examples" aria-label="State Jade examples">
            <span><i aria-hidden="true" /> Live</span>
            <span className="ds-accent-badge">Connected</span>
          </div>
        </div>
      </section>

      <section className="ds-reference-section" aria-labelledby="ds-components-title">
        <PanelHeader title="Components" description="Shared elements include their interaction and focus behavior." headingId="ds-components-title" />
        <div className="ds-component-groups">
          <div className="ds-component-row">
            <Button>Primary action <ArrowUpRight size={15} /></Button>
            <Button variant="secondary">Secondary action</Button>
            <TextAction icon={<ArrowUpRight size={15} />}>Text action</TextAction>
          </div>
          <div className="ds-component-row">
            <Chip>Robotics</Chip><Chip>Open source</Chip><Chip>Spatial computing</Chip>
          </div>
          <div className="ds-identity-sample">
            <Avatar profile={user} size="large" />
            <span><strong>{user.name}</strong><small>{user.role || "Your role"}</small></span>
            <Toggle checked={exampleVisible} onChange={() => setExampleVisible((visible) => !visible)} label="Example visibility" />
          </div>
          <Disclosure title="More about this system" description="Usage, hierarchy, and component guidance">
            <p className="ds-reference-copy">Use the quietest surface that still communicates hierarchy. Reserve white for primary action and State Jade for meaningful positive state.</p>
          </Disclosure>
        </div>
      </section>
    </div>
  );
}
