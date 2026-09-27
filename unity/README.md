# Align Unity client

This is the mixed-reality client for Align. The first slice establishes a head-pose contract, editor simulation, Quest 2 OpenXR/passthrough setup, remote profile presentation, and visibility gating that Person 2 can connect to networking.

## Shared match audio

The current physical demo relay runs `MATCH_MODE=fixture`, so its reviewed
shared summaries are deterministic and Gemini is not called. ElevenLabs still
speaks the exact summary displayed after either wearer reveals it.

Set `MATCH_MODE=live` and `GEMINI_API_KEY` on the laptop relay to generate the
shared introduction with Gemini. This build shows **AI introduction pending**
while generating and **AI unavailable; retrying** on failure; pose polling
continues in both cases. Set `MATCH_LIVE_FALLBACK=true` and
`MATCH_FALLBACK_TIMEOUT_MS=3000` on the relay to show and speak a shared-connection
template after three seconds, or immediately on an AI error. Both headsets use
the same result; late AI output cannot replace it mid-speech. This server setting
needs no APK rebuild. Without the opt-in, live mode still requires AI prose.

The two-headset controller automatically attaches `BioNarrationPlayer`. A
compatible match waits behind the name-only card until either wearer presses
A/X after calibration. The relay reveals the green introduction for both;
only then does the server's ElevenLabs integration read it, once per match.
The default voice is female (Sarah).
Set `ELEVENLABS_API_KEY` on the matcher server as described in
[narration setup](../matcher/README.md#shared-match-narration-elevenlabs), then
rebuild/reinstall the Quest APK. The Unity client uses the existing matcher's
URL and carries no provider credentials. Audio and UnityWebRequestAudio built-in
modules are enabled in the package manifest.

A/X reveals the introduction for both instead of dismissing the initial name.
It cannot stop speech while it is loading/playing.
Once the shared introduction is shown and audio finishes, press A/X to hide it;
another press shows it without replaying. Audio failure/disabled narration also
allows dismissal, so the card cannot get stuck. Nonmatches, profile switches, resets, loss of
tracking/connection, and disabling the controller cancel audio. Unavailable
speech leaves the visual match intact. Uncheck **Narrate Match Bios** on
`TwoHeadsetDemoController` to disable narration for a build. Verify on both
headsets: Alex and Maya hear the same shared match reason, Sam stays silent, and
switching back to Maya reads the shared introduction once. Neither profile bio
is narrated. Editor tests do not verify physical output.

## Required editor

- Unity `6000.0.66f2` or newer (Apple Silicon build on Apple Silicon Macs)
- Android Build Support
- Android SDK & NDK Tools
- OpenJDK

The project is pinned to `6000.0.66f2`, the current minimum documented by Meta for Unity development. The package manifest uses Unity OpenXR and Unity OpenXR: Meta; the deprecated Oculus XR provider is intentionally excluded.

## First open

1. Install the required editor and Android modules in Unity Hub.
2. Open the `unity/` directory as the project.
3. Wait for Package Manager to resolve dependencies.
4. If prompted, import **TextMeshPro Essential Resources**.
5. Select **Align → Setup → Create Person 1 Simulation Scene**.
6. Enter Play Mode.

The generated scene is saved to `Assets/Align/Scenes/Person1Simulation.unity` and added to Build Settings.

## Simulation controls

- `WASD`: move the simulated remote headset horizontally
- `Q` / `E`: move it down/up
- Left/Right arrows: rotate its yaw
- `T`: toggle tracking validity

The Maya card is visible only while the simulated participant is in the same room, calibrated, recently tracked, inside the configured range, and inside the camera view. Toggling tracking off should hide it immediately.

## Quest 2 two-headset demo and build

1. Select **Align → Setup → Configure Quest Project**.
2. Select **Align → Setup → Create Quest Demo Scene** if `QuestDemo.unity` does not exist.
3. Start the matcher from `matcher/` with `npm run start:demo`.
4. Select **Align → Build → Build Quest APK**.

The build is written to `Builds/Quest/Align.apk`. The scene generator detects the Mac's current IPv4 address and serializes `http://<LAN-IP>:4323` into the private-LAN room transport; set `ALIGN_MATCHER_URL` before launching Unity to override it. Both headsets and the Mac must be on a network that allows client-to-client traffic.

The headset surface intentionally shows only the remote person's name while neutral. A positive match adds a short translucent green panel and a reason capped at 30 words. The reusable presenter also exposes a conversation state that collapses back to the selected name and suppresses the reason until discovery resumes. Bio, interests, score, and social/contact data never render on the headset card.

Select **Align → Setup → Create Remote Participant Prefab** to create `Assets/Align/Prefabs/RemoteParticipant.prefab` without `QuestDemoController`, a staged pose, or pre-authorized room/calibration state. Other networking scenes can bind identity and supply session, pose, match, and conversation state through the documented runtime entry points.

On each headset, stand on the shared marker facing the arrow and press A or X to calibrate. Calibration never reveals the summary: both still see just the other person's name. Either wearer then presses A/X once more to reveal the shared green introduction for both, even if it must wait for AI/fallback generation. The synchronized flag arrives through the normal roughly 100 ms room polls (not frame-locked rendering). Speech starts after reveal. A/X does not interrupt loading or playing audio. After speech finishes, a fresh A/X press hides the entire local card; another shows it without replaying speech. Completed audio does not hide it automatically. Only this later hide/show is local. Profile changes, reconnects, and resets clear reveal and dismissal; an old queued press cannot reveal a new pairing. To recalibrate, reset with the left menu button and then press A/X. The first active client becomes Alex and the second becomes Maya. Press B or Y on the second headset to switch Maya/Sam. Connection, calibration, and match diagnostics are written to the Unity/ADB logs. There is no debug or operator-status panel in the headset view.

The Quest profile card is fixed 1.35 m in front of the wearer, with a consistent 64 cm width. It uses a pale translucent surface, rounded rim, soft shadow, and black text. A shared reveal press tints the same panel green and opens the explanation once the match is ready. Names appear for a live, tracked peer before calibration; matching still requires A/X on each headset. `Align → Preview → Render Glass Cards` renders the real Unity UI against light and dark backgrounds into the system temporary directory (`catalyst-glass-preview`). The glass effect uses translucent UI geometry rather than sampling or blurring passthrough camera frames.

Photon Fusion remains the intended final transport. The current HTTP relay is a bounded two-device fallback for a private demo network because the Fusion SDK and App ID are not checked in.

The generated APK targets Quest 2 only. It does not require Quest Pro eye tracking. To install it after the headset accepts the USB debugging prompt, run from this directory:

```sh
ADB="/Applications/Unity/Hub/Editor/6000.0.66f2/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb"
"$ADB" devices
"$ADB" install -r Builds/Quest/Align.apk
```

`adb devices` must report the headset as `device`, not `unauthorized`, before installation can succeed.

## Tests

Open **Window → General → Test Runner**, select **EditMode**, and run all tests. The suite covers card visibility, calibration, tracking, staleness, range, view direction, the standalone participant factory, legacy visibility repair, conversation lifecycle, reason limits, headset-detail privacy, live relay status, and finish-before-dismissal behavior. Physical audio completion should also be checked on both headsets.

## Boundaries

- `SimulatedHeadPoseProvider` is the hardware-free source used now.
- `QuestHeadPoseProvider` reads the XR head transform and tracking flag only.
- `PoseLoopbackDriver` remains only in the editor simulation scene.
- `HttpRoomTransport` drives the current physical two-headset fallback behind `IAlignRoomTransport`.
- `QuestDemoController` remains available as a staged local pose source, but is not included in the live `QuestDemo.unity` scene.
- The Quest 2 implementation does not request or process passthrough camera frames.
- `QuestDemo.unity` uses AR Foundation passthrough, but Align code never requests or processes passthrough image frames.
- The generated Quest scene consumes the live peer state from the relay and presents a viewer-fixed card; it does not place labels above a physical participant.
- The latest APK uses `http://172.20.10.8:4323` over the private hotspot. The wireless build is installed on both headsets. Both apps have joined room `DEMO` over Wi-Fi with USB forwarding removed; the physical unplug-and-walk check still needs participant confirmation. Keep the Mac awake with the matcher running. The previous loopback/USB APK is preserved at `Builds/Quest/Align-usb-fallback.apk`; only that build requires `adb -s <serial> reverse tcp:4323 tcp:4323` and connected USB cables. Rebuild the wireless APK if the Mac's IP changes. See the [wireless demo guide](../assets/LAPTOP_RELAY_DEMO.md) for the unplugged acceptance test.

See [the two-Quest teammate handoff](../web/docs/quest-demo-handoff.md) for the presentation state table, integration inputs, and rehearsal checklist.
