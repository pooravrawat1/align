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
    /// editor) to preview neutral, matched, conversation, and discovery states.
    /// This staged pose source must not be present in the live network scene.
    /// </summary>
    public sealed class QuestDemoController : MonoBehaviour
    {
        [SerializeField] private RemoteParticipantView participant;
        [SerializeField] private RemoteProfileCardPresenter cardPresenter;
        [SerializeField] private Camera viewerCamera;
        [SerializeField, Min(0.5f)] private float demoDistanceMeters = 2.5f;
        [SerializeField] private string canonicalPreviewMatchReason = "You share a vision for wearable assistive technology. Combining computer vision with embedded hardware could turn that idea into something people can use every day.";

        private InputDevice _leftController;
        private InputDevice _rightController;
        private bool _wasPrimaryPressed;
        private bool _wasSecondaryPressed;
        private bool _isMatched;
        private bool _isInConversation;
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
            EnsureVisibilityGate();
        }

        public void ToggleMatchState()
        {
            _isMatched = !_isMatched;
            _isInConversation = false;
            cardPresenter?.SetMatchState(_isMatched, canonicalPreviewMatchReason);
            cardPresenter?.SetConversationState(false);
        }

        public void EnterConversation()
        {
            _isInConversation = true;
            cardPresenter?.SetConversationState(true);
        }

        public void FinishConversation()
        {
            _isInConversation = false;
            cardPresenter?.SetConversationState(false);
        }

        public void ResetDiscovery()
        {
            _isMatched = false;
            _isInConversation = false;
            cardPresenter?.SetMatchState(false, string.Empty);
            cardPresenter?.SetConversationState(false);
        }

        private void OnEnable()
        {
            AcquireControllers();
            EnsureVisibilityGate();
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
            bool secondaryPressed = ReadSecondaryButton();
#if UNITY_EDITOR
            Keyboard keyboard = Keyboard.current;
            primaryPressed |= keyboard != null && keyboard.spaceKey.isPressed;
            secondaryPressed |= keyboard != null && keyboard.backspaceKey.isPressed;
#endif
            if (primaryPressed && !_wasPrimaryPressed)
            {
                AdvancePreviewState();
            }
            if (secondaryPressed && !_wasSecondaryPressed)
            {
                ResetDiscovery();
            }

            _wasPrimaryPressed = primaryPressed;
            _wasSecondaryPressed = secondaryPressed;
        }

        private void AdvancePreviewState()
        {
            if (!_isMatched)
            {
                ToggleMatchState();
            }
            else if (!_isInConversation)
            {
                EnterConversation();
            }
            else
            {
                FinishConversation();
            }
        }

        private void EnsureVisibilityGate()
        {
            if (participant == null || cardPresenter == null)
            {
                return;
            }

            RemoteParticipantPresentationWiring.EnsureVisibility(
                participant, viewerCamera, cardPresenter.gameObject);
        }

        private bool ReadPrimaryButton()
        {
            if (!_leftController.isValid || !_rightController.isValid)
            {
                AcquireControllers();
            }

            return IsPrimaryPressed(_leftController) || IsPrimaryPressed(_rightController);
        }

        private bool ReadSecondaryButton()
        {
            if (!_leftController.isValid || !_rightController.isValid)
            {
                AcquireControllers();
            }

            return IsSecondaryPressed(_leftController) || IsSecondaryPressed(_rightController);
        }

        private static bool IsPrimaryPressed(InputDevice controller)
        {
            return controller.isValid &&
                controller.TryGetFeatureValue(CommonUsages.primaryButton, out bool pressed) &&
                pressed;
        }

        private static bool IsSecondaryPressed(InputDevice controller)
        {
            return controller.isValid &&
                controller.TryGetFeatureValue(CommonUsages.secondaryButton, out bool pressed) &&
                pressed;
        }

        private void AcquireControllers()
        {
            _leftController = InputDevices.GetDeviceAtXRNode(XRNode.LeftHand);
            _rightController = InputDevices.GetDeviceAtXRNode(XRNode.RightHand);
        }
    }
}
