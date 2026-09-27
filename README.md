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

Desktop development uses simulated head poses and browser clients. Tracking is kept behind a provider interface so headset poses can be connected without changing the networking, calibration, or profile-card systems. Quest/Unity and Photon integration is owned by the headset teammates. The matcher is a separate laptop service; its API and bundled offline results are documented in [matcher/README.md](matcher/README.md).

## Quest 2 spatial behavior

Align does not use computer vision or camera-pixel access on Quest 2. Every participant shown in the mixed-reality experience must wear a connected headset and join the same room.

Quest 2 passthrough shows the physical person. Align synchronizes that participant's tracked headset pose, converts it into the manually calibrated shared coordinate system, and renders their profile card approximately 25 cm above the remote headset.

A remote card is visible only when the participant:

- Is connected to the same room
- Has completed shared-origin calibration
- Has sent a recent valid head pose
- Is within the configured distance range
- Is inside the local user's viewing direction

This produces the intended “look toward someone and see their profile” behavior without claiming to detect or identify people from camera images. People who are not wearing a connected headset are outside the Quest 2 MVP.

## Demo profiles and privacy

The Quest demo uses three fictional, self-declared profiles: Alex, Maya, and Sam. They include hidden interests, skills, networking goals, work domains, and past professional/personal experiences. The matcher uses the [team rubric](assets/align-matching-rubric.md), with a 0–100 percentage score and a 70% match threshold. The percentage is only for API/debug use.

There is no login, headset profile editor, or web-to-Quest profile transfer in this slice. The web companion remains a separate interactive mockup. Matching fields travel through Photon and, when live AI is enabled, to Gemini; they are hidden from other attendees in the headset view, not kept entirely on-device. Contact and social fields are never sent to Gemini.

Social links are displayed as user-provided contact information. They are not used as AI matching inputs.

## Planned stack

- Unity and C#
- Unity OpenXR, Unity OpenXR: Meta, and Quest passthrough
- Photon Fusion Shared Mode
- TextMeshPro and world-space canvases
- A separate Node HTTP matching service with Gemini structured JSON output
- A bundled deterministic result for offline and demo fallback

## Development priorities

```text
Bundled Alex/Maya/Sam fixtures
    → matching service and offline result
    → desktop simulation
    → two-client pose synchronization
    → manual shared-origin calibration
    → floating remote names
    → synchronized match reveal
    → Quest 2 head-pose and passthrough integration
    → reliability testing and demo rehearsal
```

The judged run can use `npm run start:demo` in `matcher/` to force fixture-only matching with no Gemini requests. Optional auto mode attempts Gemini when configured and falls back to bundled rubric-scored results. The headset team owns the one-caller Photon coordinator and operator-only Maya/Sam switch.

## Documentation

- [Product requirements](assets/match-prd.md)
- [24-hour execution plan](assets/TASKS.md)
- [Unity client setup](unity/README.md)
- [Matching rubric](assets/align-matching-rubric.md)
- [Quest matcher and Unity handoff](matcher/README.md)
- [Interactive companion prototype](web/README.md)

## Unity client

The mixed-reality client lives in `unity/`. Its first implementation slice includes the shared head-pose interface, keyboard-controlled simulation, Quest XR head tracking adapter, remote profile-card presentation, visibility gating, editor scene generators, and EditMode policy tests.

Historical device evidence: a development APK at `unity/Builds/Quest/Align.apk` was configured for Quest 2, OpenXR, ARM64, 72 Hz, and passthrough. It was installed and launched on Quest 2 `CoralWallaby3906`; logs confirmed OpenXR, 72 Hz, and an active passthrough layer, but not the visible in-headset scene. That artifact does not prove the current source changes.

The current source adds compact discovery/conversation presentation and a standalone remote-participant prefab generator. The staged scene advances neutral → matched → conversation → matched with A or X; it is not person detection or live two-headset synchronization. Unity editor was unavailable during this presentation update, so the new EditMode tests and generated prefab remain unexecuted. See [the integration handoff](web/docs/quest-demo-handoff.md) and [the rehearsal guide](web/docs/hackathon-demo.md). Do not rebuild or reinstall the APK until explicitly requested.

Open `unity/` in Unity and use **Align → Build → Build Quest APK** to rebuild. See [the Unity setup guide](unity/README.md) for scene controls and headset installation.

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
