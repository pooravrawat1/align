# Conference recap and follow-up

## Placement and visual contract

- Home keeps its approved event photograph, profile, focus, and recent connections. Once the featured event ends, its primary action becomes View recap.
- Events owns the report at `#/events?event=<id>&tab=recap`, inside the existing Overview / People / Your recap navigation.
- Network remains the long-term directory. Report notes and contacted status update the existing connection owner; no second relationship store.
- `#/recap-demo?persona=alex` and `#/recap-demo?persona=maya` are reciprocal public examples of the same prepared event story. They do not join an event, create requests, or overwrite the visitor's real demo session. The route defaults to Alex for legacy links.
- Reuse PageHeader, PanelHeader, Avatar, Chip, Button and TextAction, existing fonts, charcoal tokens, white primary actions, hairline dividers, and event imagery. A divided people list opens a focused inline follow-up editor; mobile stacks the same content. No extra main navigation destination.

## Report and interaction

Show accepted connections and private saves separately, explicit shared profile topics, the owner's meeting note, next action, and contacted state. Pending requests retain their existing inbox. Saved profiles never imply a meeting.

Draft follow-up opens an editable message beside its source note. Connected people use a meeting note; saved-only profiles use a private note and never imply a meeting. Generate with Gemini explicitly uses that note and permitted common ground; the existing compatibility service must continue excluding private notes. Copy and email handoff do not mark contacted. Mark contacted is a separate reversible action. No automatic sending or delivered reminders.

Each prepared persona has five fictional people, including connected, saved-without-meeting, six-minute reciprocal Alex/Maya, and already-contacted examples. Duration appears only when the authored fixture explicitly says a conversation occurred; it is authored story data, not evidence of headset measurement. A saved profile never receives timing or discussion claims. Prepared drafts are labeled; live Gemini generation has distinct loading, success, and recoverable error states. Note edits invalidate generated context without silently overwriting edited drafts. Drafts survive refresh and are scoped by owner/event/person. Any profile withdrawal observed in an app state update removes that person’s drafts across events; changed shared evidence also invalidates cached drafts. The temporary server has no durable revocation history, so withdrawal and re-sharing completed while this browser is offline cannot be detected retrospectively.

## Hosting and ownership

For this hackathon, the public example persists only its private progress in this browser. Progress and follow-up drafts are namespaced by fixture version and persona, so switching or resetting one attendee cannot expose or erase the other attendee's work. It uses a stateless server-side Gemini endpoint with fixed fictional identities and bounded notes, so a serverless restart cannot erase the example. No API key enters the client. Normal session recaps keep using authorized server records; existing ordinary sessions remain temporary, not cross-device durable accounts. Production database/authentication and automated delivery are outside this slice.

## Closure inventory and verification

Inventory: Home entry, event report entry, public demo, report model, owner-scoped draft storage, note/status edits, Gemini service and route authorization, model failure/retry, pending inbox, responsive and keyboard interaction. Preserve matching, profile editing, spatial preview, global Network styling, and other concurrent dirty changes.

Verify model/endpoint tests for event ownership, visibility, input/schema/evidence validation, source labels and failures; browser tests for direct demo entry, note -> generation -> edit/copy -> contacted, refresh, reset, visitor isolation, ordinary recap navigation, and desktop/mobile overflow. Run a production build, bounded visual review, and an adversarial review. A live Gemini response and a hosted browser run are separate proof from mocked tests.

## Running and hosting

Open `#/recap-demo?persona=alex` or `#/recap-demo?persona=maya` for the completed-conference examples; no login or running session is needed for either prepared report. The live report remains `#/events?event=demo&tab=recap` after entering the app. Add `GEMINI_API_KEY` through the server environment to enable generation. Optional `GEMINI_MODEL` selects a model; `GEMINI_FOLLOW_UP_TIMEOUT_MS` controls the dedicated generation deadline, capped at 15 seconds. Keys must never use a `VITE_` prefix. Without a configured key, the prepared message remains editable and copyable and generation returns a recoverable unavailable response.

`npm run build`, then `node scripts/package-preview.mjs`, writes an isolated temporary Vercel Build Output artifact. It preserves the web/matcher/assets module layout inside the API function, copying only the explicit source inventory and the built static site. Run `vercel --prebuilt --yes` from the printed directory for a preview deployment to the already-linked Catalyst project. It does not publish the production alias or configure secrets.

The user worktree advanced concurrently from `6e7e089` to `32db621` during implementation. This slice preserves concurrent Landing, Spatial, matching, and profile work. Verification is scoped to the conference report and API changes, not those other features. Build output contains the current web app snapshot.

## Verification boundary

Prepared example content is authored fiction; Gemini prose is explicitly a suggestion for the attendee to review. Schema and evidence-substring checks do not prove every generated claim. Live Gemini has not been verified because no local or linked Vercel key is configured. The public demo endpoint has bounded inputs and concurrent work, but no distributed per-visitor usage quota; enable provider/platform budget controls before making live generation publicly available.

## Historical delivered review preview — September 26, 2026

The preview below documents the earlier single-person recap delivery. It predates the current Alex/Maya persona story and is not evidence for the changes described above.

- URL: https://catalyst-6qnx1as87-caseys-projects-0122e9d8.vercel.app/#/recap-demo
- Deployment: `dpl_D3Prxj6ArJD8jJii2EwfSMB8DSCt`, preview target; production alias unchanged. Existing Vercel sign-in protection applies, so this is not an anonymously accessible judge link.
- Source boundary: `/Users/casey/align`, HEAD `32db621` plus the scoped follow-up working changes and concurrent existing web changes in the built artifact. No agent-owned commit.
- Production build and TypeScript passed; 28 focused Node tests and 12 browser scenarios passed. A later cleanup-centralization change passed the four affected browser scenarios, with the withdrawal test corrected to await the asynchronous bootstrap result.
- Deployed API health returned JSON 200. Desktop 1440px and mobile 390px browser checks used deployed assets/API responses authenticated through `vercel curl`: prepared draft, no-key generation fallback, edited draft and contacted status surviving refresh, no horizontal overflow, and no page errors passed. No mock generation was used in that hosted check.
- The local browser suite additionally covers mocked Gemini success, recipient isolation, saved-versus-connected language, stale generation cancellation, observed withdrawal/re-sharing, clear-data/sign-out/expired-session cleanup, and Home-to-recap routing after an event ends. Desktop/mobile visual review and the scoped design scan passed. Live-model output and anonymous-public access remain unverified/unconfigured.
