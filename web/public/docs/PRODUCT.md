# Catalyst product plan

## The promise
Help someone notice a useful conversation in the room, then get out of the way. Afterward, help them remember the person and why they met.

## Companion website
- **Home:** what should I do next? One event, profile readiness, recent connections, and a useful follow-up.
- **Event:** what is happening in this room? Preparation, live setup, and recap states, plus discreet demo recovery controls.
- **Network:** who did I meet? A constellation and accessible list, contextual search, saved reasons, private notes, and follow-up dates.
- **Profile:** how do I appear? An editor beside distant/nearby/matched card previews, visible-field choices, and preferences.

Public entry explains the product through an illustrative shared-room scene. Demo sign-in uses prepared profiles; no credentials are collected.

## Spatial state flow
Join room → confirm profile → calibrate → ready → ambient room → notice a participant → see a reason to meet → open details → start conversation → save → return to room → leave with recap.

Distant identities are quiet labels. Nearby identities show role and up to three tags. Matches add a jade edge, symbol, label, and concrete explanation under 30 words—not a public numerical rating. Nonmatches stay neutral.

Conversation mode quiets other identities and pauses match notifications. Saving is deliberate and personal; it does not imply mutual acceptance, exchanged contact details, or a delivered message.

Recovery scenarios remove remote cards when connection or alignment is unreliable. Boundary messaging overrides social content. These are controlled browser scenarios, not real safety detection.

## Service boundaries
This build provides an ephemeral local session store, explicit profile editing, mock room enrollment and calibration, deterministic matching with a precomputed Alex/Maya fixture, canonical cached match pairs, personal connection ownership, historical introduction reasons, notes, status, dates, leave, and event-data clearing.

Profiles and connections are fictional sample data. Hidden matching fields are excluded from evaluation. Production authentication, cross-account permission enforcement, shared multiplayer rooms, durable storage, real AI calls, and notification delivery are not implemented.

## Native implementation next
Use Unity, C#, Meta XR/OpenXR, TextMeshPro world-space canvases, and the selected networking layer. Establish manual shared origin first; transmit local poses relative to the origin; interpolate remote transforms; attach identities above headsets; orient to the viewer; synchronize the symmetric match state.

Validate with two physical Quest 2 headsets: passthrough, physical alignment, text contrast/readability, controller targeting, 72fps target, 10–20Hz pose updates, <250ms perceived tracking latency, drift recovery, and three consecutive two-minute demos. A browser simulation cannot prove those acceptance criteria.

## Design system
Spatial Salon: warm graphite, warm white, subdued metadata, jade for meaningful state. Geist display type and Inter interface type. Environmental glass belongs to short spatial surfaces; forms, lists, settings, and long explanations use opaque reading surfaces. Respect reduced motion/transparency. No neon, gaming chrome, public rankings, or dozens of identical dashboard cards.
