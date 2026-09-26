# Align Unity client

This is the mixed-reality client for Align. The first slice is intentionally independent of Photon and Meta-specific components: it establishes a head-pose contract, editor simulation, remote profile presentation, and visibility gating that Person 2 can connect to networking.

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

## Tests

Open **Window → General → Test Runner**, select **EditMode**, and run all tests. The initial suite verifies the card visibility policy for room, calibration, tracking, staleness, range, and view direction.

## Boundaries

- `SimulatedHeadPoseProvider` is the hardware-free source used now.
- `QuestHeadPoseProvider` reads the XR head transform and tracking flag only.
- `PoseLoopbackDriver` is temporary and must be replaced by Person 2's Photon adapter.
- The Quest 2 implementation does not request or process passthrough camera frames.
- Passthrough scene configuration and on-device verification remain pending until Unity and the Quest hardware are available.
