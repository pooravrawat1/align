# Catalyst rehearsal and implementation boundary

## Product story

Alex builds wearable navigation hardware. Maya builds computer vision for visual assistance. Catalyst gives them a reason to introduce themselves, gets out of their way while they talk, and helps them follow up afterward.

Keep this explanation in the presentation, not in extra product banners or entry shortcuts. The existing three-step profile entry remains unchanged. Home, Event, Network, and Profile retain their current visual language; event details now include People beside Overview and Your recap. Browsing people does not join the room or announce presence.

## Short judge walkthrough

1. Enter through the existing Alex/Maya profile selector and normal setup. Show the current project, what this person brings, and what they need.
2. On Home, choose Meet people. Open Maya's profile: Alex's hardware and Maya's computer vision have a concrete shared purpose. Browsing is read-only; joining remains explicit.
3. Show the two-Quest interaction using the teammate's live scene. An eligible participant has a neutral name. A positive match adds green and a short reason. Explicit conversation mode returns to name only. Finishing restores the latest discovery state. Out-of-view, stale, uncalibrated, and disconnected participants are hidden by the existing visibility policy.
4. For a laptop rehearsal, use the existing Spatial preview navigation. This is a photographed browser illustration, not evidence of person tracking or Quest synchronization. Enter the room, select Maya, start/finish a conversation, then explicitly save the connection.
5. Open `#/recap-demo?persona=alex` for the authored after-event story. Show Maya's six-minute encounter, reason, note, next step, and editable follow-up. Switch to Maya to show the reciprocal story. A saved-only person has no duration or meeting claim. Copying does not send or mark contacted.

The prepared recap is fictional demonstration data, not a transcript, measured encounter, or live headset export. The ordinary event recap continues to show actual records from the temporary web session. Do not present the prepared route as a live bridge.

## Rehearsal routes and controls

- Web: from `web/`, `npm run dev`; default entry `http://127.0.0.1:4320/#/login`.
- Browser illustration: `#/spatial`, with the existing explicit room-entry control.
- Authored recap: `#/recap-demo?persona=alex` or `#/recap-demo?persona=maya`; no sign-in needed. Each persona's local notes, drafts, and contacted state persist separately. Reset recap resets only the selected persona.
- Deterministic Quest matching: from `matcher/`, `npm run start:demo`. The canonical Alex/Maya pair is positive; Alex/Sam is neutral. Switching back restores the same fixture result. Public `/match` request/response shape is unchanged.
- Unity teammate integration and staged controls: [Quest handoff](quest-demo-handoff.md). Use the standalone participant prefab generator in the live scene; never use the staged controller as a live pose source.

## Scope and proof limits

This slice owns aligned fictional profile content, read-only event browsing, reciprocal prepared recaps, scoped browser persistence, and native Quest presentation/generation. It does not implement Photon synchronization, shared-origin calibration, person recognition, automatic conversation detection, audio recording, duration capture, durable accounts, automatic email, or a headset-to-web encounter bridge.

Optional follow-up generation retains the existing server-only Gemini key mechanism. Prepared messages remain editable without a key. Mocked generation tests do not establish live-model quality. See [follow-up ownership and verification](conference-follow-up.md).

Implementation started at `f8c77f51713ead865b94e66b64be954b9e2147b7` in a shared dirty worktree. Concurrent Network/Profile/Landing/Inbox/Home/theme styling, attendee image assets, video-plan notes, and interaction changes are preserved and excluded from this slice's ownership. There was no agent-owned commit, push, deployment, APK build, or installation. Historical deployment/device notes elsewhere in the repository do not prove these new changes. Browser checks refer to their tested snapshots; subsequent concurrent styling edits are not covered by those earlier captures.

Unity editor is unavailable in this environment. New EditMode regression tests and prefab generation require execution in the teammate's Unity editor before claiming a working headset presentation. The required final proof remains two physical Quests: spatial alignment, return-to-view, lost tracking/connection, current-match restoration, and readability against bright and dark passthrough backgrounds.

## Local verification — September 26, 2026

- Matcher: 22 tests passed. Web models/API: 49 focused tests passed, including seed projection, fixture provenance, ownership, stale results, and follow-up authorization.
- Browser: 50 focused scenarios passed across entry (15), Home/Event/spatial/journey (21), and recap (14) runs. Active-event tests use a fixed clock; the existing ended-event recap behavior is separately covered. The final saved-only note regression checks save, collapse, and reload; stored extra fields cannot overwrite prepared identity or relationship.
- Production web build passed; a final TypeScript check passed after the small note-label correction. Existing bundle-size warnings remain. Desktop and 390px mobile layouts were visually inspected.
- Reviewer-confirmed Unity source fixes include neutral presentation without a reason, immediate current-state restoration after hidden-card reactivation, standalone prefab wiring, and required test assembly references. These are source-review claims, not executed Unity evidence.
- No live Gemini call, hosted deployment, physical Quest test, or Ray-Ban test was performed for this slice.
