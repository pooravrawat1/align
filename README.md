# Align

Align is a colocated mixed-reality networking experience for events. In the two-Quest demo, each wearer sees only the other person's floating name. A compatible pair sees the same green cue and a concise reason to start a conversation; full profiles and scores stay hidden.

The project is being built as a 24-hour hackathon MVP for Meta Quest 2.

## MVP

The current headset demo is successful when two users can:

1. Join room `DEMO` from separate clients.
2. Use the bundled Alex profile on headset A and Maya on headset B; an operator-only control switches B to Sam for a nonmatch.
3. Calibrate their tracking spaces to a shared physical origin.
4. See only the other participant's name above their head.
5. Receive the same green match cue and conversation starter, or remain neutral for Sam.
6. Repeat Maya → Sam → Maya reliably in under two minutes.

Quest/Unity and Photon integration is owned by the headset teammates. The matcher is a separate laptop service; its API and bundled offline results are documented in [matcher/README.md](matcher/README.md).

## Demo profiles and privacy

The Quest demo uses three fictional, self-declared profiles: Alex, Maya, and Sam. They include hidden interests, skills, networking goals, work domains, and past professional/personal experiences. The matcher uses the [team rubric](assets/align-matching-rubric.md), with a 0–100 percentage score and a 70% match threshold. The percentage is only for API/debug use.

There is no login, headset profile editor, or web-to-Quest profile transfer in this slice. The web companion remains a separate interactive mockup. Matching fields travel through Photon and, when live AI is enabled, to Gemini; they are hidden from other attendees in the headset view, not kept entirely on-device. Contact and social fields are never sent to Gemini.

Social links are displayed as user-provided contact information. They are not used as AI matching inputs.

## Planned stack

- Unity and C#
- Meta XR All-in-One SDK and Quest passthrough
- Photon Fusion Shared Mode
- TextMeshPro and world-space canvases
- A separate Node HTTP matching service with Gemini structured JSON output
- A bundled deterministic result for offline and demo fallback

## Development priorities

```text
Bundled Alex/Maya/Sam fixtures
    → matching service and offline result
    → two-client pose synchronization
    → manual shared-origin calibration
    → floating remote names
    → synchronized match reveal
    → Quest pose and passthrough integration
    → reliability testing and demo rehearsal
```

The judged run can use `npm run start:demo` in `matcher/` to force fixture-only matching with no Gemini requests. Optional auto mode attempts Gemini when configured and falls back to bundled rubric-scored results. The headset team owns the one-caller Photon coordinator and operator-only Maya/Sam switch.

## Documentation

- [Product requirements](assets/match-prd.md)
- [24-hour execution plan](assets/TASKS.md)
- [Matching rubric](assets/align-matching-rubric.md)
- [Quest matcher and Unity handoff](matcher/README.md)
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

Align uses only fictional, explicitly supplied demo profiles. It does not use facial recognition or infer event attendance or sensitive attributes. The mixed-reality demo should run in a clearly marked, obstacle-free area with passthrough enabled.
