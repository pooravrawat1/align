using UnityEngine;

namespace Align.Presentation
{
    public readonly struct RemoteCardVisibilityInput
    {
        public RemoteCardVisibilityInput(
            bool isInSameRoom,
            bool isLocalCalibrated,
            bool isRemoteCalibrated,
            bool hasPose,
            bool isPoseTracked,
            double lastPoseReceivedAtSeconds,
            double nowSeconds,
            Vector3 viewerPosition,
            Vector3 viewerForward,
            Vector3 remotePosition,
            float minimumDistanceMeters,
            float maximumDistanceMeters,
            float maximumPoseAgeSeconds,
            float minimumViewDot)
        {
            IsInSameRoom = isInSameRoom;
            IsLocalCalibrated = isLocalCalibrated;
            IsRemoteCalibrated = isRemoteCalibrated;
            HasPose = hasPose;
            IsPoseTracked = isPoseTracked;
            LastPoseReceivedAtSeconds = lastPoseReceivedAtSeconds;
            NowSeconds = nowSeconds;
            ViewerPosition = viewerPosition;
            ViewerForward = viewerForward;
            RemotePosition = remotePosition;
            MinimumDistanceMeters = minimumDistanceMeters;
            MaximumDistanceMeters = maximumDistanceMeters;
            MaximumPoseAgeSeconds = maximumPoseAgeSeconds;
            MinimumViewDot = minimumViewDot;
        }

        public bool IsInSameRoom { get; }
        public bool IsLocalCalibrated { get; }
        public bool IsRemoteCalibrated { get; }
        public bool HasPose { get; }
        public bool IsPoseTracked { get; }
        public double LastPoseReceivedAtSeconds { get; }
        public double NowSeconds { get; }
        public Vector3 ViewerPosition { get; }
        public Vector3 ViewerForward { get; }
        public Vector3 RemotePosition { get; }
        public float MinimumDistanceMeters { get; }
        public float MaximumDistanceMeters { get; }
        public float MaximumPoseAgeSeconds { get; }
        public float MinimumViewDot { get; }
    }

    public static class RemoteCardVisibilityPolicy
    {
        public static bool ShouldShow(in RemoteCardVisibilityInput input)
        {
            if (!input.IsInSameRoom ||
                !input.IsLocalCalibrated ||
                !input.IsRemoteCalibrated ||
                !input.HasPose ||
                !input.IsPoseTracked)
            {
                return false;
            }

            double poseAge = input.NowSeconds - input.LastPoseReceivedAtSeconds;
            if (double.IsNaN(poseAge) || poseAge > Mathf.Max(0f, input.MaximumPoseAgeSeconds))
            {
                return false;
            }

            Vector3 toRemote = input.RemotePosition - input.ViewerPosition;
            float minimumDistance = Mathf.Max(0f, input.MinimumDistanceMeters);
            float maximumDistance = Mathf.Max(minimumDistance, input.MaximumDistanceMeters);
            float distanceSquared = toRemote.sqrMagnitude;
            if (distanceSquared < minimumDistance * minimumDistance ||
                distanceSquared > maximumDistance * maximumDistance)
            {
                return false;
            }

            if (input.ViewerForward.sqrMagnitude < 0.0001f || distanceSquared < 0.0001f)
            {
                return false;
            }

            float viewDot = Vector3.Dot(
                input.ViewerForward.normalized,
                toRemote.normalized);
            return viewDot >= Mathf.Clamp(input.MinimumViewDot, -1f, 1f);
        }
    }
}
