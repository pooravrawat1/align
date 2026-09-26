# Align

Align is a colocated mixed-reality networking experience for events. Attendees join the same session, create or select a short profile, and see lightweight profile cards above nearby participants. When two profiles are compatible, both participants see a shared green match state and a concise reason to start a conversation.

The project is being built as a 24-hour hackathon MVP for Meta Quest 2.

## MVP

The demo is successful when two users can:

1. Join room `DEMO` from separate clients.
2. Create and preview a profile with a name, bio, interests, skills, goals, and optional social links—or load the Alex and Maya demo profiles.
3. Edit and save that profile for the current session.
4. Calibrate their tracking spaces to a shared physical origin.
5. See a synchronized profile card above the other participant.
6. Receive the same compatibility result and match explanation.
7. Repeat the complete demo flow reliably in under two minutes.

Until Quest hardware is available, development uses simulated head poses and desktop clients. Tracking is kept behind a provider interface so real headset poses can be connected without changing the networking, calibration, or profile-card systems.

## Profile creation

Profile creation is part of the MVP, not a stretch goal. The UI supports:

- Name and short bio
- Interests and skills
- What the participant is looking for
- Optional LinkedIn, GitHub, Instagram, and personal website links or handles
- Profile preview, edit, and session save
- One-click Alex and Maya defaults for a fast, repeatable demo

Social links are displayed as user-provided contact information. They are not used as AI matching inputs.

## Planned stack

- Unity and C#
- Meta XR All-in-One SDK and Quest passthrough
- Photon Fusion Shared Mode
- TextMeshPro and world-space canvases
- A small HTTP matching service with structured JSON output
- A bundled deterministic result for offline and demo fallback

## Development priorities

```text
Desktop simulation
    → profile creation and preview
    → two-client pose synchronization
    → manual shared-origin calibration
    → remote profile cards
    → synchronized match reveal
    → Quest pose and passthrough integration
    → reliability testing and demo rehearsal
```

Live AI, sound, and animation are secondary to a reliable two-user experience. The profile form and Alex/Maya defaults are both required. The demo must continue to work when the matching service or internet connection is unavailable.

## Documentation

- [Product requirements](assets/match-prd.md)
- [24-hour execution plan](assets/TASKS.md)
- [Interactive companion prototype](web/README.md)

## Web companion prototype

The `web/` app is the complete Spatial Salon product mockup: landing and demo sign-in, Home, Event, Network, Profile, a browser-based spatial journey, and a deterministic local mock service.

```sh
cd web
npm ci
npm run dev
```

Open `http://127.0.0.1:4320`. Use the prepared Alex profile and room code `DEMO` for the shortest demonstration path.

## Safety and privacy

Align displays only information supplied by participants. It does not use facial recognition or infer sensitive attributes. The mixed-reality demo should run in a clearly marked, obstacle-free area with passthrough enabled.
