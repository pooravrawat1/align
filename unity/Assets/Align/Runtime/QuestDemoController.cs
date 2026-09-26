using Align.Pose;
using Align.Presentation;
using UnityEngine;
using UnityEngine.XR;
using Keyboard = UnityEngine.InputSystem.Keyboard;

namespace Align.Quest
{
    /// <summary>
    /// Feeds one hard-coded, calibrated remote participant into the same view
    /// Person 2's network adapter will drive later. Press A/X (or Space in the
    /// editor) to preview the matched-card state.
    /// </summary>
    public sealed class QuestDemoController : MonoBehaviour
    {
        [SerializeField] private RemoteParticipantView participant;
        [SerializeField] private RemoteProfileCardPresenter cardPresenter;
        [SerializeField] private Camera viewerCamera;
        [SerializeField, Min(0.5f)] private float demoDistanceMeters = 2.5f;
        [SerializeField] private string matchReason = "You both build assistive technology";

        private InputDevice _leftController;
        private InputDevice _rightController;
        private bool _wasPrimaryPressed;
        private bool _isMatched;
        private bool _didLogPlacement;

        public void Configure(
            RemoteParticipantView remoteParticipant,
            RemoteProfileCardPresenter presenter,
            Camera localViewer,
            float distanceMeters)
        {
            participant = remoteParticipant;
            cardPresenter = presenter;
            viewerCamera = localViewer;
            demoDistanceMeters = Mathf.Max(0.5f, distanceMeters);
        }

        public void ToggleMatchState()
        {
            _isMatched = !_isMatched;
            cardPresenter?.SetMatchState(_isMatched, matchReason);
        }

        private void OnEnable()
        {
            AcquireControllers();
            if (participant != null)
            {
                participant.SetSessionState(true, true, true);
            }
        }

        private void Update()
        {
            Camera activeViewer = viewerCamera != null ? viewerCamera : Camera.main;
            if (participant != null && activeViewer != null)
            {
                Vector3 forward = Vector3.ProjectOnPlane(activeViewer.transform.forward, Vector3.up);
                if (forward.sqrMagnitude < 0.0001f)
                {
                    forward = Vector3.forward;
                }

                Vector3 demoHeadPosition =
                    activeViewer.transform.position + forward.normalized * demoDistanceMeters;
                participant.ApplyPose(new HeadPoseSample(
                    demoHeadPosition,
                    Quaternion.identity,
                    true,
                    Time.realtimeSinceStartupAsDouble));

                if (!_didLogPlacement)
                {
                    Debug.Log(
                        $"Align demo card active: viewer={activeViewer.transform.position:F2}, " +
                        $"head={demoHeadPosition:F2}, distance={demoDistanceMeters:F1}m");
                    _didLogPlacement = true;
                }
            }

            bool primaryPressed = ReadPrimaryButton();
#if UNITY_EDITOR
            Keyboard keyboard = Keyboard.current;
            primaryPressed |= keyboard != null && keyboard.spaceKey.isPressed;
#endif
            if (primaryPressed && !_wasPrimaryPressed)
            {
                ToggleMatchState();
            }

            _wasPrimaryPressed = primaryPressed;
        }

        private bool ReadPrimaryButton()
        {
            if (!_leftController.isValid || !_rightController.isValid)
            {
                AcquireControllers();
            }

            return IsPrimaryPressed(_leftController) || IsPrimaryPressed(_rightController);
        }

        private static bool IsPrimaryPressed(InputDevice controller)
        {
            return controller.isValid &&
                controller.TryGetFeatureValue(CommonUsages.primaryButton, out bool pressed) &&
                pressed;
        }

        private void AcquireControllers()
        {
            _leftController = InputDevices.GetDeviceAtXRNode(XRNode.LeftHand);
            _rightController = InputDevices.GetDeviceAtXRNode(XRNode.RightHand);
        }
    }
}
