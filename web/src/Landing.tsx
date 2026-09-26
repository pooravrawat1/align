import { useRef } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Bookmark } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Brand, Button } from './ui';
import { VisorScene, type VisorHandle } from './VisorScene';
import { JOURNEY, JOURNEY_TRACKS, ROOM_IMAGE } from './visorGeometry';
import { createCheckpointScroll, type CheckpointScroll } from './checkpointScroll';
import { resolveJourneyMotion } from './journeyMotion';
import type { Profile } from './types';
import './Landing.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

function MatchReason() {
  return <div className="qv-reason-body">
    <span className="qv-eyebrow">Different skills. Shared ambition.</span>
    <div className="qv-skill-pair"><div><small>You</small><strong>Embedded<br />systems</strong></div><span>+</span><div><small>Maya</small><strong>Computer<br />vision</strong></div></div>
    <div className="qv-common-ground"><span /><p>You’re both building<br /><strong>assistive technology.</strong></p></div>
  </div>;
}

function SavedContext() {
  return <div className="qv-saved-body">
    <div className="qv-context-row"><span>Where you met</span><strong>HackGT · The atrium</strong></div>
    <div className="qv-followup"><Bookmark size={14} /><p>Explore computer vision<br />on wearable hardware.</p></div>
    <span className="qv-saved-status"><Check size={13} />Shared interest · assistive technology</span>
  </div>;
}

function MayaIdentity() {
  return <div className="qv-match-identity"><span className="qv-portrait" style={{ backgroundImage: `url(${ROOM_IMAGE})` }} aria-hidden="true" /><div><strong>Maya</strong><small>Computer vision engineer</small></div><i className="qv-small-light" /></div>;
}

function NetworkCopy() {
  return <div className="qv-network-copy"><span className="qv-eyebrow">03 / Keep the connection</span><h2>Remember the person.<br /><span>And the possibility.</span></h2><p>A name is a start. Keep the shared interest<br />and the idea you wanted to come back to.</p><span className="qv-preview-label">Your network · Illustrative preview</span></div>;
}

function AlexConnection({ linear = false }: { linear?: boolean }) {
  return <div className={`qv-alex-link${linear ? ' qv-alex-link-linear' : ''}`}><span aria-hidden="true">A</span><div><strong>Alex <span>· Connected with Maya</span></strong><small>You · embedded systems</small></div><i aria-hidden="true" /></div>;
}

export function Landing({ onEnter }: { profiles: Profile[]; onEnter: () => void }) {
  const root = useRef<HTMLElement>(null);
  const runway = useRef<HTMLElement>(null);
  const scene = useRef<VisorHandle>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const checkpoints = useRef<CheckpointScroll | null>(null);
  const invitation = useRef<HTMLElement>(null);

  useGSAP(() => {
    const media = gsap.matchMedia();
    let alive = true;
    media.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      const select = gsap.utils.selector(root);
      const syncScene = (progress: number) => {
        scene.current?.setProgress(progress);
        root.current?.style.setProperty('--journey-progress', String(progress));
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
      const reveal = (selector: string, range: readonly [number, number]) =>
        tl.fromTo(select(selector), { autoAlpha: 0, y: 8, clipPath: 'inset(0 0 12% 0)' },
          { autoAlpha: 1, y: 0, clipPath: 'inset(0 0 0% 0)', duration: range[1] - range[0] }, range[0]);
      to('.qv-hero-copy, .qv-scroll-cue, .qv-lens-caption', { autoAlpha: 0, y: -8 }, tracks.heroExit);
      to('.qv-jordan', { autoAlpha: 0 }, tracks.jordanExit);
      to('.qv-scene-shade', { opacity: .88 }, tracks.shadeIn);
      reveal('.qv-discover-copy', tracks.discoverIn);
      reveal('.qv-match-reason', tracks.reasonIn);
      to('.qv-discover-copy, .qv-match-reason, .qv-tether', { autoAlpha: 0 }, tracks.detailExit);
      to('.qv-scene-shade', { opacity: 0 }, tracks.shadeOut);
      reveal('.qv-conversation-copy', tracks.conversationIn);
      to('.qv-conversation-copy', { autoAlpha: 0 }, tracks.conversationOut);
      to('.qv-world-dim', { opacity: .88 }, tracks.worldDim);
      to('.qv-network', { autoAlpha: 1 }, tracks.networkIn);
      reveal('.qv-match-saved', tracks.savedIn);
      tl.fromTo(select('.qv-network .qv-alex-link'), { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: tracks.connectionIn[1] - tracks.connectionIn[0] }, tracks.connectionIn[0]);
      tl.fromTo(select('.qv-network .qv-alex-link > i'), { scaleY: 0, transformOrigin: 'top' },
        { scaleY: 1, duration: tracks.connectionIn[1] - tracks.connectionIn[0] }, tracks.connectionIn[0]);
      tl.eventCallback('onUpdate', () => syncScene(tl.progress()));
      syncScene(tl.progress());
      const controller = createCheckpointScroll(root.current!, () => {
        const trigger = tl.scrollTrigger!;
        const range = trigger.end - trigger.start;
        return [trigger.start, ...Object.values(JOURNEY).map(value => trigger.start + range * value), invitation.current!.getBoundingClientRect().top + window.scrollY];
      }, resolveJourneyMotion);
      checkpoints.current = controller;
      return () => { controller.destroy(); checkpoints.current = null; timeline.current = null; scene.current?.setProgress(0); root.current?.style.removeProperty('--journey-progress'); };
    });
    void document.fonts.ready.then(() => { if (alive) ScrollTrigger.refresh(); });
    return () => { alive = false; media.revert(); };
  }, { scope: root });

  function jumpTo(moment: 'discover' | 'network' | 'start') {
    const trigger = timeline.current?.scrollTrigger;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (trigger) {
      const progress = moment === 'start' ? 0 : JOURNEY[moment];
      checkpoints.current?.travelTo(trigger.start + (trigger.end - trigger.start) * progress);
    } else {
      const target = moment === 'network' ? '#qv-linear-network' : moment === 'discover' ? '#qv-linear-discover' : '#qv-experience';
      root.current?.querySelector(target)?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth' });
    }
  }

  return <main className="qv-landing" ref={root} id="main-content" tabIndex={-1}>
    <section className="qv-runway" ref={runway} id="qv-experience" aria-label="The Catalyst experience">
      <div className="qv-stage">
        <VisorScene ref={scene}>
          <div className="qv-scene-shade" />
          <div className="qv-world-dim" />
          <div className="qv-jordan"><span className="qv-small-light" /><div><strong>Jordan</strong><small>Creative technologist</small></div><span className="qv-neutral-tether" /></div>
          <div className="qv-match">
            <MayaIdentity />
            <div className="qv-match-reason"><MatchReason /></div>
            <div className="qv-match-saved"><SavedContext /></div>
            <svg className="qv-tether" viewBox="0 0 80 80" aria-hidden="true"><path d="M78 2 19 61" /><circle cx="14" cy="66" r="6" /><circle cx="14" cy="66" r="2" /></svg>
          </div>
        </VisorScene>
        <div className="qv-top-shade" aria-hidden="true" />
        <header className="qv-header">
          <Brand />
          <nav aria-label="Website navigation"><button onClick={() => jumpTo('discover')}>The experience</button><button onClick={() => jumpTo('network')}>The connection</button></nav>
          <div className="qv-header-actions"><Button className="qv-enter" onClick={onEnter}>Step inside<ArrowUpRight size={15} /></Button></div>
        </header>
        <div className="qv-hero-copy"><h1>Your people.<br className="qv-mobile-break" /> In plain sight<span>.</span></h1><p>A little context. A real connection.</p><div className="qv-hero-actions"><Button className="qv-primary" onClick={onEnter}>Try the demo<ArrowUpRight size={17} /></Button><Button variant="secondary" className="qv-how" onClick={() => jumpTo('discover')}>See how it works<ArrowDown size={14} /></Button></div></div>
        <span className="qv-lens-caption">Through Alex’s eyes<span />Catalyst</span>
        <button className="qv-scroll-cue" onClick={() => jumpTo('discover')}><span>Scroll to find your people</span><ArrowDown size={23} strokeWidth={1.3} /></button>
        <div className="qv-chapter qv-discover-copy"><span className="qv-eyebrow">01 / Find the common ground</span><h2>You bring the hardware.<br /><span>She brings the vision.</span></h2><p>Different skills. The same thing you care about.<br />Now you have a reason to say hello.</p></div>
        <div className="qv-conversation-copy"><span className="qv-eyebrow">02 / Make it human</span><h2>We found the common ground.<br /><span>The conversation is yours.</span></h2></div>
        <div className="qv-network"><NetworkCopy /><AlexConnection /></div>
        <div className="qv-stage-bottom"><span>Mixed reality, imagined.</span><span className="qv-progress-track" aria-hidden="true"><i /></span></div>
      </div>
    </section>
    <div className="qv-linear-story">
      <section className="qv-linear-discover" id="qv-linear-discover"><div><span className="qv-eyebrow">01 / Find the common ground</span><h2>You bring the hardware.<br /><span>She brings the vision.</span></h2><p>Different skills. The same thing you care about. Now you have a reason to say hello.</p></div><div className="qv-static-card"><MayaIdentity /><MatchReason /></div><p className="qv-linear-conversation"><span className="qv-eyebrow">02 / Make it human</span>We found the common ground.<br /><strong>The conversation is yours.</strong></p></section>
      <section className="qv-linear-network" id="qv-linear-network"><NetworkCopy /><div className="qv-static-connection"><div className="qv-static-card qv-static-saved"><MayaIdentity /><SavedContext /></div><AlexConnection linear /></div></section>
    </div>
    <section className="qv-invitation" ref={invitation}>
      <div className="qv-invitation-mark" aria-hidden="true"><span /><span /></div>
      <h2>Who could you<br /><span>build with?</span></h2>
      <p>Bring what you know. Find what you’re missing.</p>
      <div className="qv-invitation-actions"><Button className="qv-primary" onClick={onEnter}>Try the demo<ArrowUpRight size={17} /></Button><Button variant="secondary" className="qv-back" onClick={() => jumpTo('start')}>Back to the room<ArrowRight size={15} /></Button></div>
      <small>No headset needed for this preview.</small>
    </section>
    <footer className="qv-footer"><Brand compact /><span>Made for meeting in person.</span></footer>
  </main>;
}
