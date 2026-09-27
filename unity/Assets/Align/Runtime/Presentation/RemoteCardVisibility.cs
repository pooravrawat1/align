using UnityEngine;

namespace Align.Presentation
{
    [DefaultExecutionOrder(100)]
    public sealed class RemoteCardVisibility : MonoBehaviour
    {
        [SerializeField] private RemoteParticipantView participant;
        [SerializeField] private Camera viewerCamera;
        [SerializeField] private GameObject cardRoot;
        [SerializeField, Min(0f)] private float minimumDistanceMeters = 0.5f;
        [SerializeField, Min(0f)] private float maximumDistanceMeters = 6f;
        [SerializeField, Min(0f)] private float maximumPoseAgeSeconds = 0.75f;
        [SerializeField, Range(-1f, 1f)] private float minimumViewDot = 0.35f;
        [SerializeField, Range(0f, 0.25f)] private float viewportPadding = 0.02f;

        public bool IsVisible { get; private set; }
        public RemoteParticipantView Participant => participant;
        public Camera ViewerCamera => viewerCamera;
        public GameObject CardRoot => cardRoot;

        public void Configure(
            RemoteParticipantView remoteParticipant,
            Camera localViewer,
            GameObject remoteCardRoot)
        {
            participant = remoteParticipant;
            viewerCamera = localViewer;
            cardRoot = remoteCardRoot;
        }

        private void LateUpdate()
        {
            Camera activeCamera = viewerCamera != null ? viewerCamera : Camera.main;
            bool shouldShow = participant != null && activeCamera != null;

            if (shouldShow)
            {
                var input = new RemoteCardVisibilityInput(
                    participant.IsInSameRoom,
                    participant.IsLocalCalibrated,
                    participant.IsRemoteCalibrated,
                    participant.HasPose,
                    participant.IsPoseTracked,
                    participant.LastPoseReceivedAtSeconds,
                    Time.realtimeSinceStartupAsDouble,
                    activeCamera.transform.position,
                    activeCamera.transform.forward,
                    participant.RenderedHeadPosition,
                    minimumDistanceMeters,
                    maximumDistanceMeters,
                    maximumPoseAgeSeconds,
                    minimumViewDot);

                shouldShow = RemoteCardVisibilityPolicy.ShouldShow(input) &&
                    IsInsideViewport(activeCamera, participant.RenderedHeadPosition);
            }

            SetVisible(shouldShow);
        }

        private bool IsInsideViewport(Camera activeCamera, Vector3 worldPosition)
        {
            Vector3 viewport = activeCamera.WorldToViewportPoint(worldPosition);
            return viewport.z > 0f &&
                viewport.x >= -viewportPadding &&
                viewport.x <= 1f + viewportPadding &&
                viewport.y >= -viewportPadding &&
                viewport.y <= 1f + viewportPadding;
        }

        private void SetVisible(bool visible)
        {
            IsVisible = visible;
            if (cardRoot != null && cardRoot.activeSelf != visible)
            {
                cardRoot.SetActive(visible);
            }
        }
    }
}
