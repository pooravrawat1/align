using Align.Calibration;
using Align.Networking;
using Align.Pose;
using Align.Presentation;
using Align.Profiles;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.XR;
using XRCommonUsages = UnityEngine.XR.CommonUsages;
using XRInputDevice = UnityEngine.XR.InputDevice;

namespace Align.Integration
{
    /// <summary>
    /// Owns the complete two-Quest demo state machine while leaving transport
    /// details behind IAlignRoomTransport.
    /// </summary>
    public sealed class TwoHeadsetDemoController : MonoBehaviour
    {
        [SerializeField] private MonoBehaviour poseProviderBehaviour;
        [SerializeField] private MonoBehaviour roomTransportBehaviour;
        [SerializeField] private RemoteParticipantView remoteParticipant;
        [SerializeField] private RemoteProfileCardPresenter remoteCard;

        private readonly SharedOriginCalibration _calibration = new();
        private IHeadPoseProvider _poseProvider;
        private IAlignRoomTransport _transport;
        private RemoteCardVisibility _remoteVisibility;
        private XRInputDevice _leftController;
        private XRInputDevice _rightController;
        private bool _wasPrimaryPressed;
        private bool _wasSecondaryPressed;
        private bool _wasMenuPressed;
        private string _assignedProfileId = string.Empty;
        private string _requestedProfileId = "auto";
        private string _remoteProfileId = string.Empty;
        private int _poseSequence;
        private int _lastRemoteSequence = -1;
        private int _lastResetGeneration = -1;
        private string _lastError = string.Empty;
        private string _lastStatus = string.Empty;

        public void Configure(
            MonoBehaviour poseProvider,
            MonoBehaviour roomTransport,
            RemoteParticipantView participant,
            RemoteProfileCardPresenter presenter)
        {
            poseProviderBehaviour = poseProvider;
            roomTransportBehaviour = roomTransport;
            remoteParticipant = participant;
            remoteCard = presenter;
            ResolveDependencies();
        }

        private void Awake()
        {
            ResolveDependencies();
        }

        private void OnEnable()
        {
            ResolveDependencies();
            if (_transport != null)
            {
                _transport.SnapshotReceived += ApplySnapshot;
                _transport.TransportError += ApplyTransportError;
            }
            AcquireControllers();
            UpdateStatus("Press A or X on the shared marker to calibrate.");
        }

        private void OnDisable()
        {
            if (_transport != null)
            {
                _transport.SnapshotReceived -= ApplySnapshot;
                _transport.TransportError -= ApplyTransportError;
            }
        }

        private void Update()
        {
            if (_poseProvider == null || _transport == null)
            {
                UpdateStatus("Integration dependencies are missing.");
                return;
            }

            HandleControls();
            HeadPoseSample localPose = _poseProvider.CurrentPose;
            HeadPoseSample sharedPose = _calibration.ToShared(localPose);
            _poseSequence = _poseSequence == int.MaxValue ? 0 : _poseSequence + 1;
            _transport.SetLocalState(new LocalRoomState(
                _requestedProfileId,
                _calibration.IsCalibrated,
                sharedPose,
                _poseSequence));
        }

        private void HandleControls()
        {
            bool primary = ReadButton(XRCommonUsages.primaryButton) ||
                (Keyboard.current?.cKey.isPressed ?? false);
            if (primary && !_wasPrimaryPressed)
            {
                if (_calibration.IsCalibrated)
                {
                    if (_remoteVisibility != null)
                    {
                        _remoteVisibility.SetDismissed(!_remoteVisibility.IsDismissed);
                        UpdateStatus(_remoteVisibility.IsDismissed
                            ? "Card hidden. Press A or X to show it again."
                            : "Card enabled. Waiting for a live peer.");
                    }
                }
                else
                {
                    _calibration.Capture(_poseProvider.CurrentPose);
                    _lastError = string.Empty;
                    UpdateStatus(_calibration.IsCalibrated
                        ? "Calibrated. Press A or X again to hide the card."
                        : "Head tracking is unavailable; calibration was not captured.");
                }
            }
            _wasPrimaryPressed = primary;

            bool secondary = ReadButton(XRCommonUsages.secondaryButton) ||
                (Keyboard.current?.pKey.isPressed ?? false);
            if (secondary && !_wasSecondaryPressed && _assignedProfileId != "alex")
            {
                _requestedProfileId = _assignedProfileId == "sam" ? "maya" : "sam";
                remoteCard?.SetMatchState(false, string.Empty);
                UpdateStatus($"Switching local demo profile to {_requestedProfileId}…");
            }
            _wasSecondaryPressed = secondary;

            bool menu = ReadButton(XRCommonUsages.menuButton) ||
                (Keyboard.current?.rKey.isPressed ?? false);
            if (menu && !_wasMenuPressed)
            {
                _calibration.Reset();
                remoteParticipant?.ClearPose();
                remoteParticipant?.SetSessionState(false, false, false);
                _remoteVisibility?.SetDismissed(false);
                remoteCard?.SetMatchState(false, string.Empty);
                _transport.RequestRoomReset();
                UpdateStatus("Room reset. Press A or X to recalibrate.");
            }
            _wasMenuPressed = menu;
        }

        private void ApplySnapshot(RoomStateSnapshot snapshot)
        {
            if (_lastResetGeneration < 0)
            {
                _lastResetGeneration = snapshot.resetGeneration;
            }
            else if (snapshot.resetGeneration > _lastResetGeneration)
            {
                _lastResetGeneration = snapshot.resetGeneration;
                _calibration.Reset();
                remoteParticipant?.ClearPose();
                remoteParticipant?.SetSessionState(false, false, false);
                _remoteVisibility?.SetDismissed(false);
                remoteCard?.SetMatchState(false, string.Empty);
                UpdateStatus("Room reset by a headset. Press A or X to recalibrate.");
            }

            _assignedProfileId = snapshot.assignedProfileId ?? string.Empty;
            if (_assignedProfileId == "alex")
            {
                _requestedProfileId = "auto";
            }
            else if (_requestedProfileId == "auto")
            {
                _requestedProfileId = "maya";
            }

            RoomParticipantPayload remote = null;
            if (snapshot.participants != null)
            {
                foreach (RoomParticipantPayload participant in snapshot.participants)
                {
                    if (participant != null && participant.clientId != _transport.ClientId)
                    {
                        remote = participant;
                        break;
                    }
                }
            }

            if (remote == null)
            {
                remoteParticipant?.SetSessionState(false, _calibration.IsCalibrated, false);
                remoteParticipant?.ClearPose();
                remoteCard?.SetMatchState(false, string.Empty);
                UpdateStatus($"Connected as {_assignedProfileId}. Waiting for peer in DEMO.");
                return;
            }

            if (_remoteProfileId != remote.profileId)
            {
                _remoteProfileId = remote.profileId;
                remoteCard?.Bind(DemoProfileCatalog.Get(_remoteProfileId));
                remoteCard?.SetMatchState(false, string.Empty);
            }

            remoteParticipant?.SetSessionState(
                true,
                _calibration.IsCalibrated,
                remote.calibrated);
            if (remote.pose != null && remote.pose.sequence != _lastRemoteSequence)
            {
                _lastRemoteSequence = remote.pose.sequence;
                remoteParticipant?.ApplyPose(
                    remote.pose.ToPose(Time.realtimeSinceStartupAsDouble),
                    Time.realtimeSinceStartupAsDouble);
            }

            bool matched = snapshot.matchAvailable && snapshot.match != null &&
                snapshot.match.compatible;
            remoteCard?.SetMatchState(matched, matched ? snapshot.match.reason : string.Empty);
            string matchState = snapshot.matchAvailable
                ? (matched ? "MATCH" : "neutral")
                : "pending";
            UpdateStatus(
                $"{_assignedProfileId} ↔ {_remoteProfileId} | " +
                $"calibrated={_calibration.IsCalibrated && remote.calibrated} | {matchState}");
        }

        private void ApplyTransportError(string message)
        {
            _lastError = message ?? "Room transport error";
            remoteParticipant?.SetSessionState(false, _calibration.IsCalibrated, false);
            UpdateStatus(_lastError);
        }

        private void ResolveDependencies()
        {
            _poseProvider = poseProviderBehaviour as IHeadPoseProvider;
            _transport = roomTransportBehaviour as IAlignRoomTransport;
            _remoteVisibility = remoteParticipant != null
                ? remoteParticipant.GetComponent<RemoteCardVisibility>()
                : null;
        }

        private bool ReadButton(InputFeatureUsage<bool> usage)
        {
            if (!_leftController.isValid || !_rightController.isValid)
            {
                AcquireControllers();
            }
            return (_leftController.isValid &&
                    _leftController.TryGetFeatureValue(usage, out bool left) && left) ||
                (_rightController.isValid &&
                    _rightController.TryGetFeatureValue(usage, out bool right) && right);
        }

        private void AcquireControllers()
        {
            _leftController = InputDevices.GetDeviceAtXRNode(XRNode.LeftHand);
            _rightController = InputDevices.GetDeviceAtXRNode(XRNode.RightHand);
        }

        private void UpdateStatus(string message)
        {
            message ??= string.Empty;
            if (!string.IsNullOrWhiteSpace(message) && message != _lastStatus)
            {
                Debug.Log($"[Align] {message}");
            }
            _lastStatus = message;
        }
    }
}
