import { type ReactNode, type CSSProperties, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Profile } from './types';
import { spatialSceneHeads } from './SpatialState';

// Coordinates belong to the photographed heads, in the image's own 1659 × 948 plane.
// The image and labels share this plane, including when the viewport pans.
const heads = Object.values(spatialSceneHeads);

export function SpatialScene({ people, hidden, conversationId, renderCard }: {
  people: Profile[];
  hidden: boolean;
  conversationId?: string;
  renderCard: (profile: Profile) => ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [canPan, setCanPan] = useState(false);
  const [lookIndex, setLookIndex] = useState(2);
  const lookRef = useRef(2);

  function lookToward(index: number, smooth = true) {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return;
    lookRef.current = index;
    setLookIndex(index);
    viewport.scrollTo({
      left: world.clientWidth * heads[index].x / 100 - viewport.clientWidth / 2,
      behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant',
    });
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return;
    const resize = new ResizeObserver(() => {
      setCanPan(world.clientWidth - viewport.clientWidth > 120);
      lookToward(lookRef.current, false);
    });
    resize.observe(viewport);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    const index = Object.keys(spatialSceneHeads).indexOf(conversationId ?? '');
    if (index >= 0) lookToward(index, false);
  }, [conversationId]);

  return <>
    <div ref={viewportRef} className="qmv2-room-viewport" inert={hidden} onScroll={() => {
      const viewport = viewportRef.current;
      const world = worldRef.current;
      if (!viewport || !world || world.clientWidth - viewport.clientWidth <= 120) return;
      const targetLeft = (x: number) => Math.max(0, Math.min(world.clientWidth - viewport.clientWidth, world.clientWidth * x / 100 - viewport.clientWidth / 2));
      const closest = heads.reduce((best, head, index) => Math.abs(targetLeft(head.x) - viewport.scrollLeft) < Math.abs(targetLeft(heads[best].x) - viewport.scrollLeft) ? index : best, 0);
      lookRef.current = closest;
      setLookIndex(closest);
    }}>
      <div ref={worldRef} className="qmv2-card-field" aria-label="People nearby">
        <img className="qmv2-scene" src="/assets/event-room.webp" alt="Illustrative demo room with three people at different distances" width="1659" height="948" draggable="false" />
        <div className="qmv2-atmosphere" />
        {people.filter(profile => !conversationId || profile.id === conversationId).map(profile => <div key={profile.id} className="qmv2-person-anchor" data-person-id={profile.id} style={{ '--head-x': `${spatialSceneHeads[profile.id].x}%`, '--head-y': `${spatialSceneHeads[profile.id].y}%` } as CSSProperties}>
          {renderCard(profile)}
        </div>)}
      </div>
    </div>
    {canPan && !conversationId && <nav className="qmv2-look-controls spatial-surface" aria-label="Look around the demo room" inert={hidden}>
      <button aria-label="Look left" disabled={lookIndex === 0} onClick={() => lookToward(lookIndex - 1)}><ArrowLeft size={18} /></button>
      <span>Look around</span>
      <button aria-label="Look right" disabled={lookIndex === heads.length - 1} onClick={() => lookToward(lookIndex + 1)}><ArrowRight size={18} /></button>
    </nav>}
  </>;
}
