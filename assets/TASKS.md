# Align — 24-Hour Hackathon Execution Plan

Original source of truth (superseded for the current demo): [`match-prd.md`](match-prd.md)
Team size: 4 people  
Deadline: 24 hours from kickoff

> **Current demo override (September 26, 2026):** The checklist below is the
> original execution snapshot. The current headset demo uses bundled Alex on
> headset A and Maya/Sam on headset B, name-only floating cues, and no headset
> profile editor or expanded profile cards. The Person 3 contract and offline
> results are in [matcher/README.md](../matcher/README.md) and
> [quest-demo-fixtures.json](quest-demo-fixtures.json); the current scoring rules
> are in [align-matching-rubric.md](align-matching-rubric.md). In particular,
> Q-06/Q-08, D-01 through D-05, D-14, and the custom-profile acceptance items
> below do **not** apply to this two-headset build. Unity/Photon teammates own
> the one-caller coordinator and Maya/Sam operator switch. The web UI is not
> being reworked.

## Ship target

By Hour 20, two Quest 2 headsets must be able to join room `DEMO`, calibrate to the same marked origin, see a readable card above the other person, and show the same green match explanation. The flow must work three times in a row and take under two minutes.

Hours 20–24 are reserved for reliability, rehearsal, and submission. No new features enter the build after Hour 20.

## Locked MVP decisions

- Unity + C# + Meta XR All-in-One SDK, passthrough, and TextMeshPro
- Photon Fusion Shared Mode for room and pose synchronization
- Manual shared-origin calibration using position and yaw only
- Quest 2 uses synchronized headset poses, not computer vision, to locate participants
- Every spatial participant must wear a connected headset and join the same room
- Cards render only for calibrated, in-range, in-view participants with a recent valid pose
- Tracking is accessed through `IHeadPoseProvider`, with simulated and Quest implementations
- A required profile creation/editing UI with name, bio, interests, skills, goals, and optional social links
- Two preset profiles, Alex and Maya, remain available as one-click demo defaults
- A small HTTP matching service with structured JSON; Person 3 chooses FastAPI or Express based on familiarity at kickoff
- A matching interface in Unity that can return either the live API result or a bundled precomputed result
- Target two headsets; four-user support, Shared Spatial Anchors, voice input, authentication, persistence, and polish beyond the core reveal are cut

If live AI or the backend is not working by Hour 12, the demo uses the bundled result. Judges should see a reliable product, not infrastructure debugging.

## Ownership

| Person | Primary ownership | Deliverable at Hour 12 |
|---|---|---|
| Person 1 — Quest/MR lead | Unity project, Quest builds, passthrough, profile-card rendering | Installable build showing a readable billboard card in passthrough |
| Person 2 — Multiplayer/spatial lead | Photon room, network identity, pose sync, interpolation, calibration | Two devices see aligned remote-head placeholders |
| Person 3 — Backend/AI lead | Profile/match schema, API, model call, cache, deterministic fallback | Contract-tested endpoint plus fixture responses |
| Person 4 — UX/demo/integration lead | Profile creation UI, preset/demo flow, match states, recovery controls, QA, pitch and backup | A user can create, preview, edit, and save a profile or load a demo preset |

Each task has exactly one owner. Pairing is encouraged, but ownership does not move unless the team explicitly reassigns it.

## First 30 minutes — everyone

- [ ] **ALL-01** Confirm both headsets can install and launch an Android build; record device IDs and battery state.
- [ ] **ALL-02** Confirm Photon credentials, AI credentials, signing setup, Wi-Fi/hotspot, and one development machine that can build to Quest.
- [ ] **ALL-03** Create branches `person-1/quest`, `person-2/network`, `person-3/backend`, and `person-4/ux-demo`.
- [ ] **ALL-04** Agree on the contracts below. Any contract change must be announced to all four people.
- [ ] **ALL-05** Put a visible calibration marker and forward arrow in the physical demo area.

## Shared contracts — freeze by Hour 1

```csharp
public struct PlayerProfile {
    public string UserId;
    public string Name;
    public string Bio;
    public string[] Interests;
    public string[] Skills;
    public string[] LookingFor;
    public SocialLink[] SocialLinks;
}

public struct SocialLink {
    public string Platform;
    public string UrlOrHandle;
}

public struct MatchResult {
    public string UserA;
    public string UserB;
    public bool Compatible;
    public float Score;
    public string Reason; // 30 words maximum
}
```

Networked player state must contain:

- `userId`, selected profile ID, calibrated head position, calibrated yaw/rotation, and ready state
- match state: `pending`, `matched`, or `neutral`, plus a shared reason string

Coordinates sent over the network are relative to the calibrated origin, in Unity meters. Pair cache keys sort the two user IDs before joining them.

Social links are display-only fields. Do not send them to the matching model or include them in match explanations.

```csharp
public interface IHeadPoseProvider {
    Vector3 Position { get; }
    Quaternion Rotation { get; }
    bool IsTracked { get; }
}
```

Use `SimulatedHeadPoseProvider` for editor development and `QuestHeadPoseProvider` for the headset camera/XR origin. Multiplayer, calibration, and rendering must depend on the interface rather than Meta XR classes directly.

## Immediate start while Quest hardware is unavailable

**Current status:** Unity `6000.0.66f2` and its Android toolchain are installed. The project opens and compiles, the simulation and Quest demo scenes have been generated, and a Quest 2-only APK builds successfully at `unity/Builds/Quest/Align.apk`. The APK was installed and launched on Quest 2 `CoralWallaby3906`; logs confirm OpenXR, 72 Hz, and an active passthrough layer, but the visible scene has not yet been confirmed in-headset. The second headset still has ADB authorization trouble. All nine EditMode tests pass in a recorded Unity batch run. Hold APK rebuild/install until explicitly requested.

- [x] **S-01** Create the Unity project scaffold and pin Unity `6000.0.66f2` in the repository.
- [x] **S-02** Implement `IHeadPoseProvider` and a keyboard-controlled `SimulatedHeadPoseProvider`.
- [ ] **S-03** Create a test participant prefab containing a head anchor, debug cube, and profile-card anchor 0.25 m above it.
- [ ] **S-04** Run two editor/desktop clients and synchronize simulated position, yaw, tracking state, and pose timestamp.
- [ ] **S-05** Gate the remote card on room membership, calibration, pose freshness, distance, and view direction.

### Next Person 1 actions

- [x] **P1-NEXT-01** Install Unity Hub and Unity `6000.0.66f2` or newer with Android Build Support, Android SDK/NDK Tools, and OpenJDK.
- [x] **P1-NEXT-02** Open `unity/`, resolve packages, import TextMeshPro Essential Resources, and reach a clean Console with no compile errors.
- [x] **P1-NEXT-03** Run all EditMode tests and fix any Unity-version or package compatibility issues.
- [x] **P1-NEXT-04** Run **Align → Setup → Create Person 1 Simulation Scene** and save the generated scene/assets.
- [x] **P1-NEXT-05** Verify `WASD`, `Q/E`, arrow-key movement, and the `T` tracking toggle in Play Mode.
- [ ] **P1-NEXT-06** Verify cards hide for invalid tracking, stale pose, range, calibration, room, and view-frustum failures; then complete S-03 and S-05.
- [ ] **P1-NEXT-07** Create a reusable participant prefab from the validated simulation object for Person 2's Photon integration.

**Hardware-free checkpoint:** Moving the simulated head in Client A makes Client B show the correct card above it; leaving the view, range, room, or tracked state hides the card.

## Person 1 — Quest and mixed reality

### Hours 0–4: prove the device path

- [x] **Q-01** Open and validate the pinned Unity Quest project; document any editor/package resolution changes.
- [x] **Q-02** Configure Android/Quest build settings, OpenXR or Meta XR, permissions, and passthrough.
- [ ] **Q-03** Make a minimal scene that launches on the physical Quest 2 at 72 Hz with passthrough visible.
- [x] **Q-04** Create a world-space test card with large high-contrast text and a simple billboard component.

**Device-path status:** `QuestDemo.unity` and a verified development APK are ready. The APK has run as the foreground process and logs report active passthrough, but Q-03 remains open until passthrough and the card are visibly confirmed on a physical Quest 2.

**Checkpoint H4:** An APK runs on a Quest 2 and a test card is readable in passthrough.

### Hours 4–10: build the remote avatar/card prefab

- [ ] **Q-05** Create `NetworkPlayerView`: invisible head anchor, debug cube toggle, and card anchor 0.25 m above the synchronized remote head pose.
- [ ] **Q-06** Bind the card to name, one-line bio, at most three interest tags, and compact optional social handles in the nearby/expanded state.
- [ ] **Q-07** Hide the local user's card and make every remote card yaw-face the local camera.
- [ ] **Q-08** Add a `RemoteCardVisibility` gate requiring same-room membership, calibration, a fresh tracked pose, configured range, and the local camera's view frustum.
- [ ] **Q-09** Add distance detail: name-only when distant; full card when nearby. Use a conservative fixed threshold if tuning is costly.
- [ ] **Q-10** Expose neutral, pending, and green matched visual states for Person 4 to drive.

### Hours 10–16: integrate and optimize

- [ ] **Q-11** Connect Person 2's remote pose to the prefab and verify card offset/alignment while walking.
- [x] **Q-12** Implement `QuestHeadPoseProvider` using the tracked XR camera transform; do not request or process passthrough camera pixels.
- [ ] **Q-13** Keep scene geometry, transparency, and lighting minimal; verify stable frame rate on-device.
- [ ] **Q-14** Produce numbered APKs for H12 and H16 integration tests and document the install command/path.

### Hours 16–24: hardening support

- [ ] **Q-15** Fix only device, rendering, readability, and performance bugs from the shared test list.
- [ ] **Q-16** Produce the final release APK and a known-good backup APK.

## Person 2 — multiplayer and spatial alignment

### Hours 0–4: prove two-device networking

- [ ] **N-01** Add Photon Fusion Shared Mode and implement join-by-room-code with default room `DEMO`.
- [ ] **N-02** Spawn one network player per client with a unique `userId`; prevent duplicate local representations.
- [ ] **N-03** Synchronize a debug cube's position and yaw between two editor/device clients.

**Checkpoint H4:** Two clients join `DEMO` and see each other's moving debug cube.

### Hours 4–10: calibration and smooth tracking

- [ ] **N-04** Implement calibration: capture current headset horizontal position and yaw when the user stands on the marker facing the arrow.
- [ ] **N-05** Convert local head poses into calibrated shared-space poses before transmission; ignore pitch/roll when defining the origin.
- [ ] **N-06** Transmit poses and timestamps at 10–20 Hz, interpolate remote transforms, and mark a pose stale after a configurable timeout.
- [ ] **N-07** Add ready/calibrated state and prevent the main experience from starting until both users are ready.
- [ ] **N-08** Add recalibrate, reconnect, and leave/reset hooks for Person 4's buttons.

**Checkpoint H10:** Two physical headsets show remote cubes close to the other headset after calibration.

### Hours 10–16: state integration

- [ ] **N-09** Synchronize selected profile ID and match state so both clients receive the same result/reason.
- [ ] **N-10** Make one authoritative client/service submit each unordered pair once; handle a late join or reconnect without duplicate evaluations.
- [ ] **N-11** Replace the debug cube view with Person 1's card prefab while retaining a debug toggle.

### Hours 16–24: hardening support

- [ ] **N-12** Test packet loss/reconnect and eliminate duplicate players, stale rooms, or asymmetric match state.
- [ ] **N-13** Tune interpolation and update rate only after correctness; document known drift and the one-click recovery.

## Person 3 — backend, AI, and deterministic fallback

### Hours 0–4: contract-first service

- [ ] **B-01** Scaffold the smallest familiar HTTP service and add `POST /match` plus `GET /health`.
- [ ] **B-02** Validate the agreed profile schema, including optional social links, and return the exact `MatchResult` shape.
- [ ] **B-03** Store results in memory using a sorted `userA:userB` key so A/B and B/A are identical.
- [ ] **B-04** Add Alex/Maya fixtures and the known successful result from the PRD.

**Checkpoint H4:** A local request returns valid match JSON for Alex and Maya.

### Hours 4–10: guarded live matching

- [ ] **B-05** Add the LLM call with structured JSON output, a configurable threshold, and an explanation limit of 30 words.
- [ ] **B-06** Build the model input from bio, interests, skills, and goals only; exclude social links. Prohibit sensitive, romantic, medical, political, or employment judgments.
- [ ] **B-07** Add timeout/error handling that immediately returns the fixture result for known demo profiles.
- [ ] **B-08** Add unit/contract tests for valid output, reversed user order, cache reuse, timeout, malformed model output, and offline fallback.
- [ ] **B-09** Provide Person 4 with the base URL, sample request/response, start command, and `.env.example`; never commit secrets.

### Hours 10–16: Unity integration support

- [ ] **B-10** Pair with Person 4 to implement/test the Unity matching adapter against live and fallback modes.
- [ ] **B-11** Add a health indicator and concise logs that reveal live, cached, or fallback mode without exposing credentials.
- [ ] **B-12** Test over the actual demo network from a Quest-accessible address; if blocked, declare fallback mode by H12.

### Hours 16–24: freeze and operate

- [ ] **B-13** Freeze the API at H16; fix only contract or reliability bugs afterward.
- [ ] **B-14** Prepare one command to start the service and a second offline fixture/config bundled with the Unity build.

## Person 4 — UX, end-to-end integration, QA, and demo

### Hours 0–4: profile creation and deterministic flow

- [ ] **D-01** Implement the state flow: create/select profile → preview → room join → calibrate → waiting → experience.
- [ ] **D-02** Build the profile form with name, short bio, interests, skills, and what the user is looking for.
- [ ] **D-03** Add optional LinkedIn, GitHub, Instagram, and personal website fields with basic length and URL/handle validation.
- [ ] **D-04** Add profile preview, edit, and save-for-session behavior. Require a name and prevent empty or overlong entries.
- [ ] **D-05** Add one-click Alex and Maya presets that populate the same editable form rather than bypassing it.
- [ ] **D-06** Create a persistent debug/status panel showing room, connection, calibration, peer, backend, and match state.
- [ ] **D-07** Draft the sub-two-minute demo script and a reset checklist before integration begins.

### Hours 4–10: match experience and recovery

- [ ] **D-08** Implement a `MatchProvider` interface with `LiveMatchProvider` and `FixtureMatchProvider` implementations.
- [ ] **D-09** Drive Person 1's card states: neutral → pending → green matched, with the shared explanation.
- [ ] **D-10** Add buttons for edit profile, recalibrate, reconnect, re-run matching, force known demo match, and reset session.
- [ ] **D-11** Add a subtle match sound only if it takes under 30 minutes and works on-device; otherwise cut it.

### Hours 10–16: own the vertical slice

- [ ] **D-12** Integrate all branches in small commits; keep the project buildable after each merge.
- [ ] **D-13** Run the complete two-headset test and maintain one shared bug list ordered P0/P1/P2.
- [ ] **D-14** Verify custom profiles synchronize, social fields display but never enter AI requests, and both clients receive the same reason.
- [ ] **D-15** Verify forced fallback works with network/AI disabled.
- [ ] **D-16** Record the first backup video as soon as one complete successful flow exists.

### Hours 16–24: submission and presentation

- [ ] **D-17** Lead three consecutive timed demo runs; assign every failure to an owner immediately.
- [ ] **D-18** Record a clean final backup video showing both physical users and at least one headset view.
- [ ] **D-19** Prepare the one-minute pitch: problem (10s), profile creation (10s), live reveal (20s), architecture/impact (10s), close (10s).
- [ ] **D-20** Package final APK, server instructions, credentials checklist, video, screenshots, and submission text.

## Integration schedule

| Time | Required result | Decision if missed |
|---|---|---|
| H1 | Contracts and branches frozen | Leads resolve immediately; no parallel schema invention |
| H4 | Passthrough card, two-client cube sync, match endpoint, and profile create/edit/preview flow each work independently | Drop cosmetic work and pair on the failed foundation |
| H8 | First merge window; project builds after shared contracts/prefabs land | Revert only the broken integration commit; keep working modules |
| H10 | Two-headset calibrated cube test | If alignment is poor, shrink demo area and prioritize recalibrate |
| H12 | End-to-end attempt with presets plus one custom-profile smoke test | Lock deterministic fallback if live backend/AI is not reliable |
| H16 | Feature complete; first successful full flow and backup recording | Cut distance behavior, sound, animation, and live AI as needed |
| H20 | Code freeze; three-run reliability test begins | Only P0/P1 fixes allowed |
| H22 | Final APK/video/submission package ready | Demo from known-good APK; do not take risky upgrades |
| H24 | Submission and rehearsed presentation | Done |

## Merge and communication rules

- Merge during planned windows around H4, H8, H12, and H16, not in one large merge near the deadline.
- Person 4 owns integration; the task owner resolves conflicts in their files.
- Commit messages start with the task ID, for example `N-04 add manual origin calibration`.
- Keep credentials out of Git. Commit `.env.example` and document setup in the README.
- Report blockers after 20 minutes. After 40 minutes, pair or use the fallback; do not silently burn an hour.
- Every merge into the demo branch must launch in the editor. At H8 onward, it must also be smoke-tested on at least one Quest.

## Acceptance test — run at H12, H16, and H20

- [ ] Install/launch on both Quest 2 headsets without editor intervention.
- [ ] Create, preview, edit, and save a custom profile with at least one social link.
- [ ] Confirm the custom profile appears correctly to the other client and social links are absent from the AI request.
- [ ] Select Alex on one device and Maya on the other.
- [ ] Join room `DEMO`; exactly one remote participant appears on each device.
- [ ] Calibrate both users at the same marker and forward arrow.
- [ ] Confirm no remote card appears before the remote participant joins and calibrates.
- [ ] Confirm the card hides when the remote pose becomes stale, leaves the configured range, or moves outside the viewing direction.
- [ ] Confirm no camera frames are requested or processed for Quest 2 participant detection.
- [ ] Each card stays approximately 20–30 cm above the other headset while the wearer turns and walks within the demo area.
- [ ] Cards face the viewer and are readable; neither user sees their own duplicate card.
- [ ] Both clients transition to green and display the identical explanation.
- [ ] The forced demo match completes when live AI/backend access is unavailable.
- [ ] Recalibrate, reconnect, re-run, and reset recover without reinstalling the app.
- [ ] Complete the full judge flow in under two minutes.
- [ ] Repeat the full flow three consecutive times.

## Bug priority and cut order

**P0 — stop everything:** build/install failure, crash, cannot join, no remote pose, card shown for an invalid/stale participant, unusable calibration, or asymmetric match result.

**P1 — fix before H20:** broken profile create/edit/save, unreadable card, major jitter, reset/reconnect failure, match delay over 10 seconds without fallback, or flow over two minutes.

**P2 — fix only if safe:** visual polish, minor spacing, audio, extra animations, and additional social platforms beyond the required fields.

Cut features in this order when behind:

1. Sound and reveal animation
2. Distance-based card detail
3. Extra social platforms beyond LinkedIn, GitHub, Instagram, and a personal website
4. Live AI call (retain deterministic matching and API-shaped fixture)
5. Backend dependency during the demo (retain bundled fixture)

Never cut profile create/edit/save, Alex/Maya demo defaults, two-device networking, manual calibration, pose-based visibility gating, remote cards, synchronized green state, recovery controls, or the backup recording.

## Demo-day runbook

- Charge both headsets and controllers; disable sleep surprises and unrelated notifications.
- Use the tested hotspot/router, start Photon/backend checks, and launch `GET /health` if live mode is enabled.
- Clear the demo area, tape the calibration marker/arrow, and mark where users should stand.
- Install the known-good APK on both headsets and run one private rehearsal before judging.
- Keep the backup APK, fixture mode, video, charging cables, and printed pitch immediately available.
- Start every judge run from a reset room and known Alex/Maya profile assignment.

## Definition of done

The project is done when custom profile creation works, the H20 acceptance test passes three times in a row, the final APK and backup video are accessible without rebuilding, and any team member can execute the reset-and-demo runbook.
