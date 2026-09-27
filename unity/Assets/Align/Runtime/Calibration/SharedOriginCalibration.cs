using Align.Pose;
using UnityEngine;

namespace Align.Calibration
{
    /// <summary>
    /// Maps a device-local tracking space into the shared demo space. Both users
    /// stand on the same physical marker and face the same arrow when capturing.
    /// </summary>
    public sealed class SharedOriginCalibration
    {
        private Vector3 _originPosition;
        private Quaternion _worldToSharedYaw = Quaternion.identity;

        public bool IsCalibrated { get; private set; }

        public Vector3 OriginPosition => _originPosition;

        public void Capture(in HeadPoseSample localPose)
        {
            if (!localPose.IsTracked)
            {
                return;
            }

            _originPosition = new Vector3(localPose.Position.x, 0f, localPose.Position.z);
            Quaternion localYaw = ExtractYaw(localPose.Rotation);
            _worldToSharedYaw = Quaternion.Inverse(localYaw);
            IsCalibrated = true;
        }

        public HeadPoseSample ToShared(in HeadPoseSample localPose)
        {
            if (!IsCalibrated)
            {
                return localPose;
            }

            Vector3 position = _worldToSharedYaw * (localPose.Position - _originPosition);
            Quaternion rotation = _worldToSharedYaw * localPose.Rotation;
            return new HeadPoseSample(
                position,
                Quaternion.Normalize(rotation),
                localPose.IsTracked,
                localPose.SampleTimeSeconds);
        }

        public void Reset()
        {
            _originPosition = Vector3.zero;
            _worldToSharedYaw = Quaternion.identity;
            IsCalibrated = false;
        }

        public static Quaternion ExtractYaw(Quaternion rotation)
        {
            Vector3 forward = Vector3.ProjectOnPlane(rotation * Vector3.forward, Vector3.up);
            if (forward.sqrMagnitude < 0.0001f)
            {
                return Quaternion.identity;
            }

            return Quaternion.LookRotation(forward.normalized, Vector3.up);
        }
    }
}
