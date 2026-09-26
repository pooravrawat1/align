using Align.Pose;
using UnityEngine;

namespace Align.Presentation
{
    /// <summary>
    /// Receives already-calibrated remote poses. A later Photon adapter should be
    /// the only component responsible for calling ApplyPose from network state.
    /// </summary>
    [DefaultExecutionOrder(0)]
    public sealed class RemoteParticipantView : MonoBehaviour
    {
        [SerializeField] private Transform headRoot;
        [SerializeField] private Transform cardAnchor;
        [SerializeField, Min(0f)] private float cardHeightMeters = 0.25f;
        [SerializeField, Min(0f)] private float smoothingSharpness = 18f;

        private HeadPoseSample _latestPose;
        private bool _hasPose;
        private bool _hasRenderedPose;
        private double _lastPoseReceivedAtSeconds = -1d;

        public bool IsInSameRoom { get; private set; }
        public bool IsLocalCalibrated { get; private set; }
        public bool IsRemoteCalibrated { get; private set; }
        public bool HasPose => _hasPose;
        public bool IsPoseTracked => _hasPose && _latestPose.IsTracked;
        public double LastPoseReceivedAtSeconds => _lastPoseReceivedAtSeconds;
        public Vector3 RenderedHeadPosition => ResolveHeadRoot().position;

        public void Configure(
            Transform remoteHeadRoot,
            Transform remoteCardAnchor,
            float heightMeters = 0.25f)
        {
            headRoot = remoteHeadRoot;
            cardAnchor = remoteCardAnchor;
            cardHeightMeters = Mathf.Max(0f, heightMeters);
            ApplyCardOffset();
        }

        public void SetSessionState(
            bool isInSameRoom,
            bool isLocalCalibrated,
            bool isRemoteCalibrated)
        {
            IsInSameRoom = isInSameRoom;
            IsLocalCalibrated = isLocalCalibrated;
            IsRemoteCalibrated = isRemoteCalibrated;
        }

        public void ApplyPose(HeadPoseSample pose)
        {
            ApplyPose(pose, Time.realtimeSinceStartupAsDouble);
        }

        public void ApplyPose(HeadPoseSample pose, double receivedAtSeconds)
        {
            _latestPose = pose;
            _lastPoseReceivedAtSeconds = receivedAtSeconds;
            _hasPose = true;
        }

        public void ClearPose()
        {
            _hasPose = false;
            _hasRenderedPose = false;
            _lastPoseReceivedAtSeconds = -1d;
        }

        private void Awake()
        {
            ApplyCardOffset();
        }

        private void OnValidate()
        {
            cardHeightMeters = Mathf.Max(0f, cardHeightMeters);
            smoothingSharpness = Mathf.Max(0f, smoothingSharpness);
            ApplyCardOffset();
        }

        private void LateUpdate()
        {
            if (!_hasPose || !_latestPose.IsTracked)
            {
                return;
            }

            Transform target = ResolveHeadRoot();
            if (!_hasRenderedPose || smoothingSharpness <= 0f)
            {
                target.SetPositionAndRotation(_latestPose.Position, _latestPose.Rotation);
                _hasRenderedPose = true;
                return;
            }

            float blend = 1f - Mathf.Exp(-smoothingSharpness * Time.unscaledDeltaTime);
            target.position = Vector3.Lerp(target.position, _latestPose.Position, blend);
            target.rotation = Quaternion.Slerp(target.rotation, _latestPose.Rotation, blend);
        }

        private Transform ResolveHeadRoot()
        {
            return headRoot != null ? headRoot : transform;
        }

        private void ApplyCardOffset()
        {
            if (cardAnchor != null)
            {
                cardAnchor.localPosition = Vector3.up * cardHeightMeters;
            }
        }
    }
}
