using UnityEngine;
using UnityEngine.XR;

namespace Align.Pose
{
    /// <summary>
    /// Reads only the tracked XR head transform. It never requests passthrough
    /// camera frames, which keeps the implementation compatible with Quest 2.
    /// </summary>
    [DefaultExecutionOrder(-100)]
    public sealed class QuestHeadPoseProvider : MonoBehaviour, IHeadPoseProvider
    {
        [SerializeField] private Transform sourceOverride;
        [SerializeField] private bool treatValidDeviceAsTrackedWhenFlagUnavailable = true;

        private InputDevice _headDevice;
        private Transform _resolvedSource;

        public Vector3 Position => ResolveSource().position;

        public Quaternion Rotation => ResolveSource().rotation;

        public bool IsTracked
        {
            get
            {
                EnsureHeadDevice();
                if (!_headDevice.isValid)
                {
                    return false;
                }

                return _headDevice.TryGetFeatureValue(CommonUsages.isTracked, out bool tracked)
                    ? tracked
                    : treatValidDeviceAsTrackedWhenFlagUnavailable;
            }
        }

        public double SampleTimeSeconds => Time.realtimeSinceStartupAsDouble;

        public HeadPoseSample CurrentPose =>
            new(Position, Rotation, IsTracked, SampleTimeSeconds);

        private void OnEnable()
        {
            _resolvedSource = null;
            _headDevice = InputDevices.GetDeviceAtXRNode(XRNode.Head);
        }

        private Transform ResolveSource()
        {
            if (sourceOverride != null)
            {
                return sourceOverride;
            }

            if (_resolvedSource == null)
            {
                Camera mainCamera = Camera.main;
                _resolvedSource = mainCamera != null ? mainCamera.transform : transform;
            }

            return _resolvedSource;
        }

        private void EnsureHeadDevice()
        {
            if (!_headDevice.isValid)
            {
                _headDevice = InputDevices.GetDeviceAtXRNode(XRNode.Head);
            }
        }
    }
}
