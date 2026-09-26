import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Glasses,
  Sparkles,
} from "lucide-react";
import { Avatar, Brand, Button, Tags } from "./ui";
import type { Profile } from "./types";
import "./Landing.css";

export function Landing({
  profiles,
  onEnter,
}: {
  profiles: Profile[];
  onEnter: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const maya = profiles.find((p) => p.id === "maya")!;
  const alex = profiles.find((p) => p.id === "alex")!;
  return (
    <main className="salon-landing" id="main-content" tabIndex={-1}>
      <header className="salon-nav">
        <Brand />
        <nav aria-label="Website navigation">
          <a
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("how-it-works")?.scrollIntoView({
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "instant"
                  : "smooth",
              });
            }}
          >
            The experience
          </a>
          <a href="#/login">Your network</a>
        </nav>
        <Button variant="secondary" onClick={onEnter}>
          Step inside
          <ArrowUpRight size={15} />
        </Button>
      </header>
      <section
        className="salon-stage"
        aria-label="An illustration of a shared room"
      >
        <img
          className="salon-environment"
          src="/assets/event-room.webp"
          alt="An imagined event space with people wearing mixed-reality headsets"
          fetchPriority="high"
        />
        <div className="salon-stage-shade" />
        <div className="salon-stage-meta">
          <span>
            <span className="status-dot" />A little common ground
          </span>
          <span>Mixed reality. Real connection.</span>
        </div>
        <div className="salon-headline">
          <h1>
            Walk into a room.
            <br />
            <span>Find your people.</span>
          </h1>
          <p>
            The right conversation is already in the room.
            <br />
            Align helps you see it.
          </p>
          <div>
            <Button onClick={onEnter}>
              Join an event
              <ArrowUpRight size={17} />
            </Button>
            <button
              className="salon-watch"
              onClick={() => setRevealed((v) => !v)}
            >
              <span>
                <Glasses size={17} />
              </span>
              {revealed ? "Replay the introduction" : "See the introduction"}
            </button>
          </div>
        </div>
        <div className={`salon-introductions ${revealed ? "is-revealed" : ""}`}>
          <div className="salon-identity salon-alex glass">
            <div className="person-line">
              <Avatar profile={alex} />
              <div>
                <h2>Alex</h2>
                <p>Hardware engineer</p>
              </div>
            </div>
            <Tags items={["Robotics", "Embedded systems"]} />
            <span className="identity-tether" />
          </div>
          <button
            className={`salon-identity salon-maya glass ${revealed ? "reason-visible" : ""}`}
            aria-expanded={revealed}
            onClick={() => setRevealed((v) => !v)}
          >
            <div className="person-line">
              <Avatar profile={maya} />
              <div>
                <h2>Maya</h2>
                <p>Computer vision engineer</p>
              </div>
              <ArrowUpRight size={16} />
            </div>
            <Tags items={["Computer vision", "Assistive tech"]} />
            {revealed ? (
              <div className="salon-reason">
                <span>
                  <Sparkles size={13} />A reason to meet
                </span>
                <p>
                  You’re both building assistive technology. Maya brings
                  computer vision; Alex can help bring it to wearable hardware.
                </p>
              </div>
            ) : (
              <span className="salon-card-hint">
                A little curiosity goes a long way <ArrowRight size={13} />
              </span>
            )}
            <span className="identity-tether" />
          </button>
          <span className="salon-distant glass">Jordan</span>
        </div>
        <div className="salon-scene-footer">
          <span>01 / The moment before hello</span>
          <span>Illustrative scene · interactive preview</span>
          <ArrowDown size={17} />
        </div>
      </section>
      <section className="salon-manifesto" id="how-it-works">
        <div className="eyebrow">Designed for the space between people</div>
        <h2>
          Less searching.
          <br />
          <span>More serendipity.</span>
        </h2>
        <div className="salon-manifesto-copy">
          <p>
            Someone nearby knows the thing you’re figuring out. Someone else is
            building what you can help bring to life.
          </p>
          <p>
            Make a small introduction. Enter a shared space. Let a reason to say
            hello find you.
          </p>
          <a href="#/login">
            Find your common ground <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
      <section className="salon-steps" aria-label="How Align works">
        {[
          {
            n: "01",
            title: "Bring your curiosity.",
            text: "Share what you’re building, what you know, and who you’d love to meet.",
          },
          {
            n: "02",
            title: "See a reason to say hello.",
            text: "Lightweight introductions appear in the room. A shared interest or complementary skill quietly comes into focus.",
          },
          {
            n: "03",
            title: "Keep the connection.",
            text: "Save someone deliberately. Remember why you met, make a note, and pick up where you left off.",
          },
        ].map((s) => (
          <article key={s.n}>
            <span>{s.n}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </article>
        ))}
      </section>
      <section className="salon-closing">
        <span className="salon-orbit" aria-hidden="true" />
        <div>
          <span className="eyebrow">People, not percentages</span>
          <h2>
            A useful introduction.
            <br />
            The rest is human.
          </h2>
          <p>
            <Check size={15} />
            Your words. Your interests. Your choice to connect.
          </p>
          <Button onClick={onEnter}>
            Make room for possibility
            <ArrowUpRight size={16} />
          </Button>
        </div>
      </section>
      <footer className="salon-footer">
        <Brand compact />
        <span>Spatial Salon · Align</span>
        <span>Interactive concept. Not a live headset service.</span>
        <a href="http://127.0.0.1:4310">
          Open original draft
          <ArrowUpRight size={13} />
        </a>
      </footer>
    </main>
  );
}
