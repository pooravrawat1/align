# Align

Align is a colocated mixed-reality networking experience for events. In the two-Quest demo, each wearer sees only the other person's floating name. A compatible pair sees the same green cue and a concise reason to start a conversation; full profiles and scores stay hidden.

The project is being built as a 24-hour hackathon MVP for Meta Quest 2.

## MVP

The current headset demo is successful when two users can:

1. Join room `DEMO` from separate clients.
2. Use the bundled Alex profile on headset A and Maya on headset B; an operator-only control switches B to Sam for a nonmatch.
3. Calibrate their tracking spaces to a shared physical origin.
4. See the other participant's name in a readable glass panel in front of the wearer.
5. Receive the same green match cue and conversation starter, or remain neutral for Sam.
6. Repeat Maya → Sam → Maya reliably in under two minutes.

Desktop development uses simulated head poses and browser clients. Tracking is kept behind a provider interface so headset poses can be connected without changing calibration or presentation. The integration branch includes a private-LAN HTTP room relay so the two-headset vertical slice can run before the login-gated Photon Fusion SDK and App ID are available. Photon remains the intended final transport behind the same room boundary. The matcher and relay are documented in [matcher/README.md](matcher/README.md).

## Quest 2 spatial behavior

Align does not use computer vision or camera-pixel access on Quest 2. Every participant shown in the mixed-reality experience must wear a connected headset and join the same room.

Quest 2 passthrough shows the physical person. The current two-headset demo presents the other participant in a viewer-fixed glass card, 1.35 m in front of the wearer. Its 64 cm width and black typography stay at a consistent readable size as either person moves. A compatible match gives the glass a pale green tint and expands the same card with the conversation starter.

The name card appears for a connected same-room peer with a recent tracked pose, even before calibration. It hides when the peer disconnects, stops tracking, or stops sending poses. Because this panel represents the connected peer rather than a physical location, it does not depend on their distance, viewing direction, or shared-origin alignment. Both users still press A/X to calibrate and enable matching. After calibration, A/X hides or shows the complete card on the local headset; dismissing it preserves the session and match.

The desktop simulation retains the original above-head spatial labels and their distance/view/calibration gating. People who are not wearing a connected headset are outside the Quest 2 MVP.

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

The judged run can use `npm run start:demo` in `matcher/` to force fixture-only matching with no Gemini requests. Optional auto mode attempts Gemini when configured and falls back to bundled rubric-scored results. The LAN relay assigns Alex to the first active headset and Maya to the second; B/Y on headset B switches Maya/Sam and invalidates the previous result.

## Documentation

- [Cable-free laptop relay setup and demo walkthrough](assets/LAPTOP_RELAY_DEMO.md)
- [Product requirements](assets/match-prd.md)
- [24-hour execution plan](assets/TASKS.md)
- [Unity client setup](unity/README.md)
- [Matching rubric](assets/align-matching-rubric.md)
- [Quest matcher and Unity handoff](matcher/README.md)
- [Interactive companion prototype](web/README.md)

## Unity client

The mixed-reality client lives in `unity/`. It includes the shared head-pose interface, keyboard-controlled simulation, Quest XR tracking, shared-origin calibration, a transport boundary plus private-LAN relay client, remote-only name presentation, synchronized match state, visibility gating, operator status/recovery controls, scene generators, and EditMode tests.

Unity `6000.0.66f2` and Android Build Support are installed. The merged source passes all 28 EditMode tests. The viewer-fixed card has also been rendered against light and dark backgrounds for visual checks. The Quest scene targets Quest 2, OpenXR, ARM64, 72 Hz, and passthrough; it joins room `DEMO`, assigns Alex/Maya roles, and synchronizes match results over the private-LAN relay. The source also includes compact neutral/matched/conversation presentation states and a standalone remote-participant prefab generator.

The latest APK at `unity/Builds/Quest/Align.apk` targets the laptop's private Wi-Fi relay at `http://172.20.10.8:4323`. The wireless build is installed on both headsets, and both apps have joined room `DEMO` over Wi-Fi with USB forwarding removed. The physical unplug-and-walk check still needs participant confirmation. The previous USB build is preserved at `unity/Builds/Quest/Align-usb-fallback.apk`. Keep the laptop awake and all three devices on this private network. Rebuild with `ALIGN_MATCHER_URL` if the laptop's IP changes; see the [wireless demo guide](assets/LAPTOP_RELAY_DEMO.md), [integration handoff](web/docs/quest-demo-handoff.md), and [rehearsal guide](web/docs/hackathon-demo.md).

Open `unity/` in Unity and use **Align → Build → Build Quest APK** whenever the matcher's LAN address changes. See [the Unity setup guide](unity/README.md) for scene controls and headset installation.

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
