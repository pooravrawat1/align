# Two-Quest presentation handoff

This handoff covers the Unity presentation boundary only. Live room join, identity, shared-origin calibration, pose transport/interpolation, coordinator election, and synchronized matcher delivery belong to the networking teammate.

## Runtime ownership

The live participant object uses these existing entry points:

- `RemoteParticipantView.SetSessionState(inSameRoom, localCalibrated, remoteCalibrated)` whenever readiness changes.
- `RemoteParticipantView.ApplyPose(HeadPoseSample)` for an already-calibrated remote pose. The receiver records local receipt time for staleness; do not compare producer clocks between headsets.
- `RemoteParticipantView.ClearPose()` on peer loss, profile switch, leave, or recalibration.
- `RemoteProfileCardPresenter.Bind(ProfileCardData)` for identity. Only `Name` renders on headset; the other fields remain unavailable to the attendee surface.
- `RemoteProfileCardPresenter.SetMatchState(compatible, reason)` with the same coordinator-owned `/match` result on both clients. The presenter caps the visible reason at 30 words and never renders score.
- `RemoteProfileCardPresenter.SetConversationState(true)` on explicit Start Conversation and `false` on explicit Finish Conversation. There is no microphone, timer, inferred conversation, audio cue, or saved-to-server claim.

`QuestDemoController` is a local staged-pose preview and must not be included in the live network scene. Replace it with the networking adapter; do not let two components call `ApplyPose` for one participant.

## Presentation state table

| State | Name | Panel/reason | Other people | Input owner |
| --- | --- | --- | --- | --- |
| Neutral discovery | neutral name | hidden | visibility policy decides each participant | synchronized nonmatch or cleared result |
| Matched discovery | green name | translucent green, shared reason | visibility policy decides each participant | synchronized positive `/match` result |
| Conversation | selected neutral name | hidden | live coordinator should suppress nonselected participant views | explicit action synchronized by teammate |
| Finished | returns to neutral/matched discovery | restored from last shared result | restored | explicit Finish Conversation |

The presenter makes one gentle color transition when state changes. It does not pulse, loop, flash, play audio, or advance on a timer.

The neutral name is white with a strong dark outline for passthrough readability; “neutral” means no green match treatment, not black text. This source decision still needs in-headset readability verification across bright and dark backgrounds.

## Participant object setup

Use one root per remote participant:

Generate the standalone starting asset with **Align → Setup → Create Remote Participant Prefab**. It writes `Assets/Align/Prefabs/RemoteParticipant.prefab`, contains no staged controller, and starts outside the room with both calibration flags false. Regeneration is deterministic from `QuestDemoSceneFactory.CreateRemoteParticipant(...)`; bind the actual remote identity after instantiation.

1. Add `RemoteParticipantView` to the remote root and configure its invisible head root, card anchor, and 0.25–0.28 m vertical card offset.
2. Put `RemoteCardVisibility` on the remote root, not on the card it controls. Configure the participant, local XR camera, and card root. This keeps the evaluator alive while the card is hidden.
3. Put `RemoteProfileCardPresenter` and `YawBillboard` on the world-space card.
4. Keep the current visibility limits unless rehearsal establishes a specific adjustment: 0.5–6 m, 0.75 s maximum local receipt age, view dot 0.35, and viewport padding 0.02.
5. Feed only calibrated shared-space poses. `RemoteParticipantView` smooths the rendered transform; it does not calibrate or serialize poses.

`QuestDemoSceneFactory` demonstrates this wiring and the compact name/reason layout. At runtime `QuestDemoController` also repairs older generated demo scenes by adding the visibility component to the participant root. That repair exists for the staged scene only, not as a substitute for a reusable live participant prefab.

## Staged preview controls

In `QuestDemo.unity` only:

- A or X / editor Space: neutral → matched discovery → conversation → matched discovery.
- B or Y / editor Backspace: reset to neutral discovery.
- Looking away, leaving the viewport, exceeding range, invalidating tracking, making the pose stale, leaving the room, or losing either calibration hides the card through `RemoteCardVisibility`.

The staged controller continually places Maya 2.5 m ahead of the viewer. It proves presentation state and visibility wiring only; it cannot prove remote tracking, calibration, network alignment, multiplayer ordering, or physical co-location.

## Coordinator requirements

- Join both clients to `DEMO`, assign Alex to headset A, and Maya or Sam to headset B.
- Capture position and yaw at the same marked physical origin, transform local poses into shared Unity metres, and transmit at the teammate-selected rate.
- One coordinator sends one `/match` request after both profiles are ready and broadcasts a versioned result to both clients.
- Before Maya ↔ Sam changes, clear match presentation and pose, advance the profile/result version, then publish the new identity. Ignore responses from older versions.
- Use the canonical `assets/quest-demo-fixtures.json` profiles and result. Do not copy a second divergent fixture into Unity. The staged controller's preview string mirrors the canonical positive reason but is not a networking fixture.
- A failed request may use the matching canonical offline result, but both headsets must receive the same chosen result and provenance must not be presented as live AI.

## Maya → Sam → Maya rehearsal

Run this on both connected physical Quests three times:

1. Both join `DEMO`, calibrate at the marker, and reach ready.
2. Verify each headset shows only the other wearer and only while fresh, in range, and in view.
3. With Maya selected, verify both displays become green with the same short reason.
4. Start conversation explicitly; verify the selected name remains while the reason and other participant labels are suppressed. Finish and verify discovery returns.
5. Switch Maya to Sam. Confirm the prior green state and reason clear before Sam appears, and both remain neutral.
6. Switch Sam back to Maya. Confirm both restore the same green reason with no stale Sam or earlier request result.
7. Look away, interrupt tracking, and exercise recalibration/reconnect once; confirm the card hides and recovers without flashing.

Record separately whether each check is editor, APK, one-device, or two-device evidence. Source and EditMode tests do not prove passthrough readability, physical alignment, controller targeting, LAN reachability, frame rate, or synchronized behavior. APK rebuild/install and physical-device verification remain pending explicit authorization.

Unity editor/CLI was unavailable in the implementation environment, so the added EditMode coverage was not run there. Run the complete `Align.Tests.EditMode` assembly in Unity Test Runner before teammate integration; this includes factory wiring, idempotent legacy visibility repair, match changes during conversation, privacy, and existing visibility invariants.
