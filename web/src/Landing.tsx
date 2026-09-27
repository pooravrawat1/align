import { useRef, useState, type MouseEvent } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, MapPin } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Brand, Button } from './ui';
import { VisorScene, type VisorHandle } from './VisorScene';
import { JOURNEY, JOURNEY_TRACKS, ROOM_IMAGE, VISOR_PATH, journeyState } from './visorGeometry';
import { createCheckpointScroll, type CheckpointScroll } from './checkpointScroll';
import { resolveJourneyMotion } from './journeyMotion';
import type { Profile } from './types';
import './Landing.css';
import { LandingProduct } from './LandingProduct';
import { SpatialSurface } from './SpatialSurface';

gsap.registerPlugin(ScrollTrigger, useGSAP);

function SavedContext() {
  return <div className="qv-saved-body">
    <div className="qv-saved-common"><span>You both care about</span><strong>Assistive technology</strong></div>
    <div className="qv-saved-expertise"><div><span>Your expertise</span><strong>Embedded systems</strong></div><div><span>Her expertise</span><strong>Computer vision</strong></div></div>
    <div className="qv-followup"><div><strong>Something to talk about</strong><p>Bringing visual assistance to wearable hardware.</p></div></div>
    <span className="qv-saved-status"><MapPin size={13} />HackGT · The atrium</span>
  </div>;
}

function MayaIdentity() {
  return <div className="qv-match-identity"><span className="qv-portrait" style={{ backgroundImage: `url(${ROOM_IMAGE})` }} aria-hidden="true" /><div><strong>Maya</strong><small>Computer vision engineer</small></div><i className="qv-small-light" /></div>;
}

function NetworkCopy() {
  return <div className="qv-network-copy"><h2>A reason to meet.<br /><span>A connection to keep.</span></h2><p>Your hardware. Her computer vision. A shared interest in making the world more accessible.</p><p className="qv-network-ending">The rest starts with hello.</p></div>;
}

export function Landing({ onEnter }: { profiles: Profile[]; onEnter: () => void }) {
  const root = useRef<HTMLElement>(null);
  const runway = useRef<HTMLElement>(null);
  const scene = useRef<VisorHandle>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const checkpoints = useRef<CheckpointScroll | null>(null);
  const entryTimeline = useRef<gsap.core.Timeline | null>(null);
  const releaseEntryInput = useRef<(() => void) | null>(null);
  const [entering, setEntering] = useState(false);

  const { contextSafe } = useGSAP(() => {
    const media = gsap.matchMedia();
    let alive = true;
    media.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      const select = gsap.utils.selector(root);
      const syncScene = (progress: number) => {
        scene.current?.setProgress(progress);
        root.current?.style.setProperty('--journey-progress', String(progress));
        const copy = journeyState(progress).networkCopy;
        root.current?.style.setProperty('--network-copy-opacity', String(copy));
        root.current?.style.setProperty('--network-copy-visibility', copy > 0 ? 'visible' : 'hidden');
      };
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: runway.current, start: 'top top', end: 'bottom bottom', scrub: true,
          // Refresh restores the timeline with callbacks suppressed; synchronize the renderer explicitly.
          onRefresh: trigger => syncScene(trigger.animation?.progress() ?? trigger.progress),
        },
      });
      timeline.current = tl;
      tl.to({}, { duration: 1 }, 0);
      const tracks = JOURNEY_TRACKS;
      const to = (selector: string, vars: gsap.TweenVars, range: readonly [number, number]) =>
        tl.to(select(selector), { ...vars, duration: range[1] - range[0] }, range[0]);
      const reveal = (selector: string, range: readonly [number, number], from: gsap.TweenVars = {}) =>
        tl.fromTo(select(selector), { autoAlpha: 0, y: 18, filter: 'blur(10px)', clipPath: 'inset(0 0 16% 0)', ...from },
          { autoAlpha: 1, y: 0, x: 0, scale: 1, filter: 'blur(0px)', clipPath: 'inset(0 0 0% 0)', duration: range[1] - range[0], ease: 'power2.out' }, range[0]);
      to('.qv-hero-copy', { autoAlpha: 0, y: -20, filter: 'blur(8px)', scale: .985, transformOrigin: 'left bottom', ease: 'power2.in' }, tracks.heroExit);
      to('.qv-lens-caption', { autoAlpha: 0, y: -10, filter: 'blur(5px)', ease: 'power1.in' }, tracks.heroExit);
      to('.qv-jordan', { autoAlpha: 0 }, tracks.jordanExit);
      to('.qv-tether', { autoAlpha: 0 }, tracks.savedShell);
      to('.qv-world-dim', { opacity: .26 }, tracks.worldDim);
      to('.qv-scene-shade', { opacity: 1 }, tracks.worldDim);
      reveal('.qv-match-saved', tracks.savedIn, { y: 14, scale: .975, transformOrigin: 'center top' });
      tl.eventCallback('onUpdate', () => syncScene(tl.progress()));
      syncScene(tl.progress());
      const controller = createCheckpointScroll(root.current!, () => {
        const trigger = tl.scrollTrigger!;
        return [trigger.start, trigger.end];
      }, resolveJourneyMotion, () => tl.scrollTrigger!.end);
      checkpoints.current = controller;
      return () => { controller.destroy(); checkpoints.current = null; timeline.current = null; scene.current?.setProgress(0); root.current?.style.removeProperty('--journey-progress'); root.current?.style.removeProperty('--network-copy-opacity'); root.current?.style.removeProperty('--network-copy-visibility'); };
    });
    void document.fonts.ready.then(() => { if (alive) ScrollTrigger.refresh(); });
    return () => { alive = false; entryTimeline.current?.kill(); releaseEntryInput.current?.(); media.revert(); };
  }, { scope: root });

  const enterExperience = contextSafe((event: MouseEvent<HTMLButtonElement>) => {
    if (entryTimeline.current || entering) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onEnter();
      return;
    }

    setEntering(true);
    root.current?.classList.add('is-entering');
    checkpoints.current?.destroy();
    checkpoints.current = null;
    timeline.current?.scrollTrigger?.disable(false);

    const blockScroll = (event: Event) => event.preventDefault();
    const blockKey = (event: KeyboardEvent) => {
      if ([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', 'Tab', 'Enter'].includes(event.key)) event.preventDefault();
    };
    window.addEventListener('wheel', blockScroll, { passive: false });
    window.addEventListener('touchmove', blockScroll, { passive: false });
    window.addEventListener('keydown', blockKey, true);
    releaseEntryInput.current = () => {
      window.removeEventListener('wheel', blockScroll);
      window.removeEventListener('touchmove', blockScroll);
      window.removeEventListener('keydown', blockKey, true);
    };

    const select = gsap.utils.selector(root);
    const trigger = event.currentTarget;
    const fromScene = Boolean(trigger.closest('.qv-stage'));
    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });
    entryTimeline.current = tl;
    gsap.set(select('.qv-entry-transition'), { autoAlpha: 1 });
    gsap.set(select('.qv-entry-aperture, .qv-entry-rim'), { scale: .28, rotation: -.6, transformOrigin: '50% 50%' });
    gsap.set(select('.qv-entry-rim'), { opacity: .12 });

    tl.to(trigger, { scale: .98, duration: .1, ease: 'power2.out' }, 0)
      .to(select('.qv-header, .qv-hero-copy, .qv-stage-bottom, .qv-closing > *'),
        { autoAlpha: 0, duration: .24, ease: 'power2.inOut' }, .02);

    if (fromScene) {
      // Continue the renderer's current geometry; never introduce a second visor.
      gsap.set(select('.qv-entry-optics'), { visibility: 'hidden' });
      const optical = { progress: timeline.current?.progress() ?? 0 };
      tl.to(optical, {
        progress: Math.max(optical.progress, JOURNEY.discover), duration: .54, ease: 'sine.inOut',
        onUpdate: () => scene.current?.setProgress(optical.progress),
      }, 0)
        .to(select('.qv-hud'), { autoAlpha: 0, duration: .2 }, 0)
        .to(select('.qv-entry-backdrop'), { opacity: .18, duration: .22, ease: 'sine.inOut' }, .08);
    } else {
      gsap.set(select('.qv-entry-optics'), { visibility: 'hidden' });
      tl.to(select('.qv-entry-backdrop'), { opacity: .18, duration: .22, ease: 'sine.inOut' }, 0);
    }
    tl.call(onEnter, [], .32);
  });

  function jumpTo(moment: 'discover' | 'network' | 'start' | 'event' | 'connections') {
    if (entryTimeline.current) return;
    const trigger = timeline.current?.scrollTrigger;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (moment === 'event' || moment === 'connections') {
      const target = root.current?.querySelector(moment === 'event' ? '#lp-event' : '#lp-network');
      target?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth' });
    } else if (trigger) {
      const progress = moment === 'start' ? 0 : JOURNEY.network;
      checkpoints.current?.travelTo(trigger.start + (trigger.end - trigger.start) * progress);
    } else {
      const target = moment === 'start' ? '#qv-experience' : '#qv-linear-network';
      root.current?.querySelector(target)?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth' });
    }
  }

  return <main className={`qv-landing${entering ? ' is-entering' : ''}`} ref={root} id="main-content" tabIndex={-1} aria-busy={entering || undefined}>
    <div className="qv-entry-transition" aria-hidden="true">
      <div className="qv-entry-backdrop" />
      <svg className="qv-entry-optics" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid meet">
        <path className="qv-entry-aperture" d={VISOR_PATH} />
        <path className="qv-entry-rim" d={VISOR_PATH} fill="none" />
      </svg>
    </div>
    <section className="qv-runway" ref={runway} id="qv-experience" aria-label="The Catalyst experience">
      <div className="qv-stage">
        <VisorScene ref={scene}>
          <div className="qv-scene-shade" />
          <div className="qv-world-dim" />
          <SpatialSurface className="qv-jordan"><span className="qv-small-light" /><div><strong>Jordan</strong><small>Creative technologist</small></div><span className="qv-neutral-tether" /></SpatialSurface>
          <SpatialSurface className="qv-match" matched>
            <MayaIdentity />
            <div className="qv-match-saved"><SavedContext /></div>
            <svg className="qv-tether" viewBox="0 0 80 80" aria-hidden="true"><path d="M78 2 19 61" /><circle cx="14" cy="66" r="6" /><circle cx="14" cy="66" r="2" /></svg>
          </SpatialSurface>
        </VisorScene>
        <div className="qv-top-shade" aria-hidden="true" />
        <header className="qv-header">
          <Brand />
          <nav aria-label="Website navigation"><button onClick={() => jumpTo('discover')}>The Experience</button><button onClick={() => jumpTo('network')}>The Connection</button></nav>
          <div className="qv-header-actions"><Button className="qv-enter" onClick={enterExperience} disabled={entering}>Step inside<ArrowUpRight size={15} /></Button></div>
        </header>
        <div className="qv-hero-copy"><h1>Your people.<br className="qv-mobile-break" /> In plain sight<span>.</span></h1><p>A little context. A real connection.</p><div className="qv-hero-actions"><Button className="qv-primary" onClick={enterExperience} disabled={entering}>Try the demo<ArrowUpRight size={17} /></Button><Button variant="secondary" className="qv-how" onClick={() => jumpTo('discover')}>See how it works<ArrowDown size={14} /></Button></div></div>
        <span className="qv-lens-caption">Through Alex’s eyes<span />Catalyst</span>
        <div className="qv-network"><NetworkCopy /></div>
        <div className="qv-stage-bottom"><span>Mixed reality, imagined.</span><span className="qv-progress-track" aria-hidden="true"><i /></span></div>
      </div>
    </section>
    <div className="qv-linear-story">
      <section className="qv-linear-network" id="qv-linear-network"><NetworkCopy /><div className="qv-static-connection"><div className="qv-static-card qv-static-saved"><MayaIdentity /><SavedContext /></div></div></section>
    </div>
    <LandingProduct onEnter={enterExperience} entering={entering} />
    <footer className="qv-closing" data-landing-stop aria-labelledby="qv-closing-title">
      <div className="qv-closing-top">
        <div className="qv-closing-copy">
          <h2 id="qv-closing-title">Who could you<br /><span>build with?</span></h2>
          <p>Bring what you know. Find what you’re missing.</p>
          <div className="qv-closing-action"><Button className="qv-primary" onClick={enterExperience} disabled={entering}>Step inside<ArrowUpRight size={17} /></Button><small>Try the browser demo.<br />No headset needed.</small></div>
        </div>
        <nav className="qv-closing-nav" aria-label="Explore Catalyst">
          <button onClick={() => jumpTo('start')}>The Experience<ArrowRight size={20} /></button>
          <button onClick={() => jumpTo('event')}>Find your room<ArrowRight size={20} /></button>
          <button onClick={() => jumpTo('connections')}>Your connections<ArrowRight size={20} /></button>
        </nav>
      </div>
      <div className="qv-closing-bottom"><span>Made for meeting in person.</span><button onClick={() => jumpTo('start')}>Back to the room<ArrowUpRight size={18} /></button></div>
    </footer>
  </main>;
}
