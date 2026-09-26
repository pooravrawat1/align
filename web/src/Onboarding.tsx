import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import profileContract from "../shared/profile-contract.json";
import { Brand, Button } from "./ui";
import type { Profile } from "./types";

export type OnboardingDetails = Required<Pick<Profile,
  "name" | "email" | "role" | "bio" | "skills" | "interests" | "lookingFor" | "linkedin"
>>;
type TagField = "skills" | "interests" | "lookingFor";
type Draft = Omit<OnboardingDetails, "name"> & {
  firstName: string; lastName: string; tagInputs: Record<TagField, string>;
};
type Person = "alex" | "maya";
type Entry = { selected: Person; step: number; drafts: Record<Person, Draft> };
export const entryDraftKey = "align-entry-v1";
const headings = ["Create your profile", "What are you working on?", "Who would you love to meet?"];
const descriptions = ["Your introduction starts here.", "", "Find people with something in common—or something you need."];
const stepNames = ["Introduce yourself", "Share what you bring", "Find common ground"];
const { stringLimits, topicLimit, topicItemLimit } = profileContract;

function draftIssue(draft: Draft, onlyStep?: number): { step: number; message: string } | undefined {
  if (onlyStep === undefined || onlyStep === 0) {
    if (!draft.firstName.trim() || !draft.lastName.trim()) return { step: 0, message: "Add your first and last name." };
    if (`${draft.firstName.trim()} ${draft.lastName.trim()}`.length > stringLimits.name) return { step: 0, message: `Keep your full name to ${stringLimits.name} characters or fewer.` };
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(draft.email.trim()) || draft.email.trim().length > stringLimits.email) return { step: 0, message: "Enter an email address with a full domain, such as alex@example.com." };
    if (!draft.role.trim() || draft.role.trim().length > stringLimits.role) return { step: 0, message: `Add a headline in ${stringLimits.role} characters or fewer.` };
  }
  if (onlyStep === undefined || onlyStep === 1) {
    if (draft.bio.length > stringLimits.bio) return { step: 1, message: `Keep your current focus to ${stringLimits.bio} characters or fewer.` };
    if (draft.linkedin.trim()) {
      try {
        const url = new URL(draft.linkedin.trim());
        if (draft.linkedin.trim().length > stringLimits.linkedin || !["https:", "http:"].includes(url.protocol) || url.username || url.password ||
          !(url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com"))) throw new Error();
      } catch { return { step: 1, message: "Enter a LinkedIn URL, such as https://www.linkedin.com/in/your-name." }; }
    }
  }
}

function initialEntry(profiles: Profile[], initialProfileId: string): Entry {
  const drafts = Object.fromEntries((["alex", "maya"] as const).map((id) => {
    const person = profiles.find((profile) => profile.id === id)!;
    const [firstName, ...rest] = person.name.trim().split(/\s+/);
    return [id, { firstName, lastName: rest.join(" "), email: person.email || `${id}@example.com`,
      role: person.role, bio: person.bio, skills: person.skills, interests: person.interests,
      lookingFor: person.lookingFor, linkedin: person.linkedin || "", tagInputs: { skills: "", interests: "", lookingFor: "" } }];
  })) as Record<Person, Draft>;
  const fallback: Entry = { selected: initialProfileId === "maya" ? "maya" : "alex", step: 0, drafts };
  try {
    const saved = JSON.parse(sessionStorage.getItem(entryDraftKey) || "null");
    if (!saved || !["alex", "maya"].includes(saved.selected) || ![0, 1, 2].includes(saved.step)) return fallback;
    for (const id of ["alex", "maya"] as const) {
      const draft = saved.drafts?.[id];
      if (!draft || !["firstName", "lastName", "email", "role", "bio", "linkedin"].every((key) => typeof draft[key] === "string") ||
        !["skills", "interests", "lookingFor"].every((key) => Array.isArray(draft[key]) && draft[key].length <= topicLimit && draft[key].every((value: unknown) => typeof value === "string" && value.length <= topicItemLimit))) return fallback;
      draft.tagInputs = Object.fromEntries(["skills", "interests", "lookingFor"].map((key) => [key,
        typeof draft.tagInputs?.[key] === "string" ? draft.tagInputs[key].slice(0, topicItemLimit) : ""]));
    }
    return { selected: saved.selected, step: saved.step, drafts: saved.drafts };
  } catch { return fallback; }
}

function withTag(values: string[], input: string) {
  const value = input.trim();
  return value && value.length <= topicItemLimit && values.length < topicLimit && !values.some((tag) => tag.toLowerCase() === value.toLowerCase()) ? [...values, value] : values;
}
function confirmTags(draft: Draft): Draft {
  return { ...draft, skills: withTag(draft.skills, draft.tagInputs.skills),
    interests: withTag(draft.interests, draft.tagInputs.interests), lookingFor: withTag(draft.lookingFor, draft.tagInputs.lookingFor),
    tagInputs: { skills: "", interests: "", lookingFor: "" } };
}
function Tags({ label, placeholder, values, onChange, input, onInputChange, variant = "chip" }: {
  label: string; placeholder: string; values: string[]; onChange: (values: string[]) => void;
  input: string; onInputChange: (value: string) => void;
  variant?: "chip" | "pill";
}) {
  const id = useId();
  const add = () => {
    onChange(withTag(values, input));
    onInputChange("");
  };
  return <div className={`entry-tags${variant === "pill" ? " entry-tags-pills" : ""}`} role="group" aria-labelledby={`${id}-label`}>
    <label id={`${id}-label`} htmlFor={id}>{label}</label>
    <div className="entry-tags-field">
      {values.map((value) => <span className="entry-tag" key={value}>{value}
        <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((tag) => tag !== value))}><X size={12} /></button>
      </span>)}
      {values.length < topicLimit && <input id={id} aria-label={placeholder} placeholder={placeholder} maxLength={topicItemLimit} value={input}
        onChange={(event) => onInputChange(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); }
        }} />}
    </div>
  </div>;
}

export function Onboarding({ profiles, initialProfileId, busy, onComplete, error }: {
  profiles: Profile[]; initialProfileId: string; busy: boolean;
  onComplete: (id: string, details: OnboardingDetails) => Promise<boolean>; error: string;
}) {
  const [entry, setEntry] = useState(() => initialEntry(profiles, initialProfileId));
  const [validationError, setValidationError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const formPanel = useRef<HTMLElement>(null);
  const previousStep = useRef(entry.step);
  const { selected, step, drafts } = entry;
  const draft = drafts[selected];
  useEffect(() => {
    try { sessionStorage.setItem(entryDraftKey, JSON.stringify(entry)); } catch { /* The in-memory draft remains usable. */ }
  }, [entry]);
  useEffect(() => {
    if (previousStep.current !== step) {
      if (formPanel.current) formPanel.current.scrollTop = 0;
      title.current?.focus({ preventScroll: window.matchMedia("(min-width: 761px)").matches });
    }
    previousStep.current = step;
  }, [step]);
  const update = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setValidationError("");
    setEntry((current) => ({ ...current, drafts: { ...current.drafts, [current.selected]: { ...current.drafts[current.selected], [field]: value } } }));
  };
  const navigateStep = (nextStep: number) => {
    if (busy) return;
    setValidationError("");
    setEntry((current) => ({ ...current, step: nextStep }));
  };
  const advance = async () => {
    if (busy) return;
    const confirmed = confirmTags(draft);
    setEntry((current) => ({ ...current, drafts: { ...current.drafts, [selected]: confirmed } }));
    const issue = draftIssue(confirmed, step === 2 ? undefined : step);
    if (issue) {
      setValidationError(issue.message);
      setEntry((current) => ({ ...current, step: issue.step }));
      return;
    }
    setValidationError("");
    if (step < 2) { setEntry((current) => ({ ...current, step: current.step + 1 })); return; }
    const success = await onComplete(selected, { name: `${draft.firstName.trim()} ${draft.lastName.trim()}`, email: draft.email.trim(), role: draft.role.trim(), bio: draft.bio.trim(),
      skills: confirmed.skills, interests: confirmed.interests, lookingFor: confirmed.lookingFor, linkedin: draft.linkedin.trim() });
    if (success) { try { sessionStorage.removeItem(entryDraftKey); } catch { /* No stored draft. */ } }
  };
  return <main className="login-page product-panel" id="main-content" tabIndex={-1}>
    <a className="icon-button login-close" href="#/" aria-label="Close and return to Catalyst"><X size={20} aria-hidden="true" /></a>
    <section className="login-visual">
      <div className="login-wash" aria-hidden="true" /><Brand />
      <div className="login-journey">
        <div className="login-quote"><h1>Get started<br />with Catalyst</h1><p>A little about you.<br />Then, a reason to say hello.</p></div>
        <ol className="login-steps" aria-label="Your journey with Catalyst">
          {[<>Introduce<br />yourself</>, <>Share what<br />you bring</>, <>Find common<br />ground</>].map((label, index) =>
            <li key={index}>
              <button type="button" aria-label={`Step ${index + 1}: ${stepNames[index]}`} aria-controls="entry-panel"
                aria-current={step === index ? "step" : undefined} disabled={busy} onClick={() => navigateStep(index)}>
                <span className="login-step-number" aria-hidden="true">{index + 1}</span><span>{label}</span>
              </button>
            </li>)}
        </ol>
      </div>
    </section>
    <section className="login-form" id="entry-panel" ref={formPanel} aria-label="Profile setup"><div>
      <h2 ref={title} tabIndex={-1}>{headings[step]}</h2>{descriptions[step] && <p>{descriptions[step]}</p>}
      <form className="login-profile-form" aria-label={headings[step]} onSubmit={(event) => { event.preventDefault(); void advance(); }}>
        {step === 0 && <div className="login-demo-switch" data-selected={selected} role="group" aria-label="Autofill a demo person">
          {(["alex", "maya"] as const).map((id) => <button key={id} type="button" aria-pressed={selected === id} disabled={busy}
            onClick={() => { setEntry((current) => ({ ...current, selected: id })); setValidationError(""); }}>{id === "alex" ? "Alex" : "Maya"}</button>)}
        </div>}
        <fieldset disabled={busy} className="login-fields" key={`${selected}-${step}`}>
          <legend className="sr-only">{headings[step]}</legend>
          {step === 0 && <>
            <div className="login-name-fields">
              <label>First name<input name="given-name" autoComplete="given-name" required pattern={".*\\S.*"} maxLength={stringLimits.name} value={draft.firstName} onChange={(event) => update("firstName", event.target.value)} /></label>
              <label>Last name<input name="family-name" autoComplete="family-name" required pattern={".*\\S.*"} maxLength={stringLimits.name} value={draft.lastName} onChange={(event) => update("lastName", event.target.value)} /></label>
            </div>
            <label>Email<input name="email" type="email" autoComplete="email" required maxLength={stringLimits.email} pattern={"[^\\s@,;<>]+@[^\\s@,;<>]+\\.[^\\s@,;<>]+"} title="Enter an email address with a full domain, such as alex@example.com." value={draft.email} onChange={(event) => update("email", event.target.value)} /></label>
            <label>Headline<input name="role" autoComplete="organization-title" required pattern={".*\\S.*"} maxLength={stringLimits.role} placeholder="Hardware engineer" value={draft.role} onChange={(event) => update("role", event.target.value)} /></label>
          </>}
          {step === 1 && <>
            <div className="entry-field-group">
              <label>Current focus<textarea name="bio" rows={3} maxLength={stringLimits.bio} value={draft.bio} onChange={(event) => update("bio", event.target.value)} aria-describedby="entry-focus-help" /></label>
              <span className="entry-hint" id="entry-focus-help">A project, idea, or problem you're exploring.</span>
            </div>
            <Tags label="I can help with" placeholder="Add a skill" values={draft.skills} onChange={(values) => update("skills", values)} input={draft.tagInputs.skills} onInputChange={(value) => update("tagInputs", { ...draft.tagInputs, skills: value })} />
            <label>LinkedIn profile<input type="url" name="linkedin" maxLength={stringLimits.linkedin} placeholder="https://www.linkedin.com/in/you" value={draft.linkedin} onChange={(event) => update("linkedin", event.target.value)} /></label>
          </>}
          {step === 2 && <>
            <Tags variant="pill" label="Interests" placeholder="Add an interest" values={draft.interests} onChange={(values) => update("interests", values)} input={draft.tagInputs.interests} onInputChange={(value) => update("tagInputs", { ...draft.tagInputs, interests: value })} />
            <Tags variant="pill" label="I'm looking for help with" placeholder="Add what you need" values={draft.lookingFor} onChange={(values) => update("lookingFor", values)} input={draft.tagInputs.lookingFor} onInputChange={(value) => update("tagInputs", { ...draft.tagInputs, lookingFor: value })} />
            <div className="entry-room"><span className="entry-room-mark" aria-hidden="true">B</span><div><strong>The Builders Room</strong><span>Demo room · Code DEMO</span></div><Check size={16} aria-label="Selected" /></div>
          </>}
        </fieldset>
        {(validationError || error) && <p className="field-error" role="alert">{validationError || error}</p>}
        <Button type="submit" className="full-width" busy={busy}>{step === 2 ? "Go to Home" : "Continue"}<ArrowRight size={16} /></Button>
      </form>
    </div></section>
  </main>;
}
