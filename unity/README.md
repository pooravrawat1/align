# Align Unity client

This is the mixed-reality client for Align. The first slice establishes a head-pose contract, editor simulation, Quest 2 OpenXR/passthrough setup, remote profile presentation, and visibility gating that Person 2 can connect to networking.

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

## Quest 2 demo and build

1. Select **Align → Setup → Configure Quest Project**.
2. Select **Align → Setup → Create Quest Demo Scene** if `QuestDemo.unity` does not exist.
3. Select **Align → Build → Build Quest APK**.

The build is written to `Builds/Quest/Align.apk`. The checked-in scene uses a transparent XR camera over Quest passthrough, requests a 72 Hz refresh rate, and places Maya's hardcoded demo head anchor 2.5 m in front of the shared origin. Press A or X on either controller to toggle the green match state; press Space when previewing the same scene in the editor.

Do not rebuild or reinstall the APK until explicitly requested. Scene and non-UI systems can be developed and verified in the editor first.

The generated APK targets Quest 2 only. It does not require Quest Pro eye tracking. To install it after the headset accepts the USB debugging prompt, run from this directory:

```sh
ADB="/Applications/Unity/Hub/Editor/6000.0.66f2/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb"
"$ADB" devices
"$ADB" install -r Builds/Quest/Align.apk
```

`adb devices` must report the headset as `device`, not `unauthorized`, before installation can succeed.

## Tests

Open **Window → General → Test Runner**, select **EditMode**, and run all tests. The initial suite verifies the card visibility policy for room, calibration, tracking, staleness, range, and view direction.

## Boundaries

- `SimulatedHeadPoseProvider` is the hardware-free source used now.
- `QuestHeadPoseProvider` reads the XR head transform and tracking flag only.
- `PoseLoopbackDriver` is temporary and must be replaced by Person 2's Photon adapter.
- The Quest 2 implementation does not request or process passthrough camera frames.
- `QuestDemo.unity` uses AR Foundation passthrough, but Align code never requests or processes passthrough image frames.
- The hardcoded Maya anchor proves rendering only. Person 2 still needs to replace it with the calibrated remote headset pose.
- The existing APK is built, manifest-verified, installed, and was observed as the foreground process on one Quest 2. Logs confirm OpenXR, 72 Hz, and active passthrough, but the visible passthrough/card result still needs in-headset confirmation. The second headset still needs ADB authorization.
