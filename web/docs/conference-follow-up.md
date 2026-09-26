# Conference recap and follow-up

## Placement and visual contract

- Home keeps its approved event photograph, profile, focus, and recent connections. Once the featured event ends, its primary action becomes View recap.
- Events owns the report at `#/events?event=<id>&tab=recap`, inside the existing Your recap tab. The current worktree uses Overview / Your recap rather than simulated Before / During / After; retain that navigation.
- Network remains the long-term directory. Report notes and contacted status update the existing connection owner; no second relationship store.
- `#/recap-demo` is a public completed-conference example, discoverable from Events and the report. It does not join an event, create requests, or overwrite the visitor's real demo session.
- Reuse PageHeader, PanelHeader, Avatar, Chip, Button and TextAction, existing fonts, charcoal tokens, white primary actions, hairline dividers, and event imagery. A divided people list opens a focused inline follow-up editor; mobile stacks the same content. No extra main navigation destination.

## Report and interaction

Show accepted connections and private saves separately, explicit shared profile topics, the owner's meeting note, next action, and contacted state. Pending requests retain their existing inbox. Saved profiles never imply a meeting.

Draft follow-up opens an editable message beside its source note. Generate with Gemini explicitly uses that note and permitted common ground; the existing compatibility service must continue excluding private notes. Copy and email handoff do not mark contacted. Mark contacted is a separate reversible action. No automatic sending or delivered reminders.

Five fictional people populate the completed-conference demo, including connected, saved, no-note, and already-contacted examples. Prepared drafts are labeled; live Gemini generation has distinct loading, success, and recoverable error states. Note edits invalidate generated context without silently overwriting edited drafts. Drafts survive refresh, are scoped by owner/event/person, and never reuse withdrawn profile evidence.

## Hosting and ownership

For this hackathon, the public example persists only its private progress in this browser. It uses a stateless server-side Gemini endpoint with fixed fictional identities and bounded notes, so a serverless restart cannot erase the example. No API key enters the client. Normal session recaps keep using authorized server records; existing ordinary sessions remain temporary, not cross-device durable accounts. Production database/authentication and automated delivery are outside this slice.

## Closure inventory and verification

Inventory: Home entry, event report entry, public demo, report model, owner-scoped draft storage, note/status edits, Gemini service and route authorization, model failure/retry, pending inbox, responsive and keyboard interaction. Preserve matching, profile editing, spatial preview, global Network styling, and other concurrent dirty changes.

Verify model/endpoint tests for event ownership, visibility, input/schema/evidence validation, source labels and failures; browser tests for direct demo entry, note -> generation -> edit/copy -> contacted, refresh, reset, visitor isolation, ordinary recap navigation, and desktop/mobile overflow. Run a production build, bounded visual review, and an adversarial review. A live Gemini response and a hosted browser run are separate proof from mocked tests.
