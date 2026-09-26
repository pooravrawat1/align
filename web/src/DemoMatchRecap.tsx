import { ChevronDown, Sparkles } from "lucide-react";
import fixtures from "../../assets/quest-demo-fixtures.json";

const alex = fixtures.profiles.alex;
const maya = fixtures.profiles.maya;
const result = fixtures.offlineResults.find(
  (item) => item.userA === "alex" && item.userB === "maya",
);
const sharedInterests = alex.interests.filter((interest) =>
  maya.interests.includes(interest),
);
const alexSkill = alex.skills.find((skill) => maya.lookingFor.includes(skill));
const mayaSkill = maya.skills.find((skill) => alex.lookingFor.includes(skill));
const sharedPastEvent = alex.experiences.find(
  (experience) =>
    experience.category === "professional" &&
    maya.experiences.some(
      (other) =>
        other.category === "professional" &&
        other.label === experience.label &&
        other.year === experience.year,
    ),
);
const sharedPersonalExperience = alex.experiences.find(
  (experience) =>
    experience.category === "personal" &&
    maya.experiences.some(
      (other) =>
        other.category === "personal" && other.label === experience.label,
    ),
);

export function DemoMatchRecap({ viewerId }: { viewerId: string }) {
  if ((viewerId !== "alex" && viewerId !== "maya") || !result) return null;
  const other = viewerId === "alex" ? maya : alex;

  return (
    <section className="demo-match-recap" aria-labelledby="demo-match-recap-title">
      <div className="demo-match-recap-header">
        <div>
          <span className="demo-match-recap-kicker">
            <Sparkles size={13} aria-hidden="true" />
            Quest demo recap
            <span className="demo-match-recap-sample">Preloaded sample</span>
          </span>
          <h2 id="demo-match-recap-title">
            Why you and {other.name} connected
          </h2>
          <p>
            A fictional, rubric-scored example you can explore after the
            headset moment. This page is not synced with the Quest devices and
            makes no live AI request.
          </p>
        </div>
        <div className="demo-match-recap-score" aria-label={"Rubric score " + result.score + " percent"}>
          <strong>{result.score}%</strong>
          <span>Rubric score</span>
        </div>
      </div>
      <details className="demo-match-recap-details">
        <summary>
          See what you matched on
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="demo-match-recap-content">
          <div className="demo-match-recap-breakdown" aria-label="Professional experience route score">
            <span>Same past event <strong>90</strong></span>
            <span>Shared interest <strong>+5</strong></span>
            <span>Skill meets a need <strong>+5</strong></span>
          </div>
          <div className="demo-match-recap-grid">
            <div className="demo-match-recap-fact">
              <span>Past professional experience</span>
              <strong>
                {sharedPastEvent
                  ? sharedPastEvent.label + " · " + sharedPastEvent.year
                  : "Shared event"}
              </strong>
              <p>You both listed the same past hackathon.</p>
            </div>
            <div className="demo-match-recap-fact">
              <span>Complementary skills</span>
              <strong>{mayaSkill} + {alexSkill}</strong>
              <p>Maya brings computer vision; Alex brings embedded systems for wearable hardware.</p>
            </div>
            <div className="demo-match-recap-fact">
              <span>Shared interests</span>
              <strong>{sharedInterests.join(" · ")}</strong>
              <p>Common ground beyond a single project.</p>
            </div>
            <div className="demo-match-recap-fact">
              <span>Beyond work</span>
              <strong>
                {sharedPersonalExperience?.label ?? "Shared personal experience"}
              </strong>
              <p>A self-declared experience they could talk about, without making it the main reason for the match.</p>
            </div>
          </div>
          <div className="demo-match-recap-starter">
            <span>The same conversation starter shown in the headset</span>
            <p>{result.reason}</p>
          </div>
        </div>
      </details>
    </section>
  );
}
