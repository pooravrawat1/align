using UnityEngine;
using UnityEngine.XR;

namespace Align.Quest
{
    /// <summary>
    /// Applies the Quest center-eye pose to the camera without requiring the XR
    /// Interaction Toolkit. The camera should be a child of an XR Origin.
    /// </summary>
    [DefaultExecutionOrder(-200)]
    public sealed class QuestTrackedCameraDriver : MonoBehaviour
    {
        private InputDevice _headDevice;

        private void OnEnable()
        {
            AcquireHeadDevice();
            Application.onBeforeRender += ApplyPose;
        }

        private void OnDisable()
        {
            Application.onBeforeRender -= ApplyPose;
        }

        private void Update()
        {
            ApplyPose();
        }

        private void ApplyPose()
        {
            if (!_headDevice.isValid)
            {
                AcquireHeadDevice();
            }

            if (!_headDevice.isValid)
            {
                return;
            }

            if (!_headDevice.TryGetFeatureValue(CommonUsages.centerEyePosition, out Vector3 position))
            {
                _headDevice.TryGetFeatureValue(CommonUsages.devicePosition, out position);
            }

            if (!_headDevice.TryGetFeatureValue(CommonUsages.centerEyeRotation, out Quaternion rotation))
            {
                _headDevice.TryGetFeatureValue(CommonUsages.deviceRotation, out rotation);
            }

            transform.SetLocalPositionAndRotation(position, rotation);
        }

        private void AcquireHeadDevice()
        {
            _headDevice = InputDevices.GetDeviceAtXRNode(XRNode.CenterEye);
            if (!_headDevice.isValid)
            {
                _headDevice = InputDevices.GetDeviceAtXRNode(XRNode.Head);
            }
        }
    }
}
