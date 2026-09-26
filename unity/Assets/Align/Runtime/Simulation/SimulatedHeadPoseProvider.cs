using Align.Pose;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Align.Simulation
{
    /// <summary>
    /// Keyboard-controlled stand-in for a tracked headset.
    /// WASD moves horizontally, Q/E moves vertically, arrows rotate, and T
    /// toggles tracking validity.
    /// </summary>
    [DefaultExecutionOrder(-100)]
    public sealed class SimulatedHeadPoseProvider : MonoBehaviour, IHeadPoseProvider
    {
        [SerializeField, Min(0f)] private float movementSpeed = 1.5f;
        [SerializeField, Min(0f)] private float yawSpeedDegrees = 90f;
        [SerializeField] private bool isTracked = true;
        [SerializeField] private bool controlsEnabled = true;
        [SerializeField] private Key toggleTrackingKey = Key.T;

        private double _sampleTimeSeconds;

        public Vector3 Position => transform.position;
        public Quaternion Rotation => transform.rotation;
        public bool IsTracked => isTracked;
        public double SampleTimeSeconds => _sampleTimeSeconds;
        public HeadPoseSample CurrentPose =>
            new(Position, Rotation, IsTracked, SampleTimeSeconds);

        public void SetTracked(bool tracked)
        {
            isTracked = tracked;
            _sampleTimeSeconds = Time.realtimeSinceStartupAsDouble;
        }

        public void SetControlsEnabled(bool enabled)
        {
            controlsEnabled = enabled;
        }

        private void OnEnable()
        {
            _sampleTimeSeconds = Time.realtimeSinceStartupAsDouble;
        }

        private void Update()
        {
            if (controlsEnabled)
            {
                UpdateControls();
            }

            _sampleTimeSeconds = Time.realtimeSinceStartupAsDouble;
        }

        private void UpdateControls()
        {
            Keyboard keyboard = Keyboard.current;
            if (keyboard == null)
            {
                return;
            }

            if (keyboard[toggleTrackingKey].wasPressedThisFrame)
            {
                isTracked = !isTracked;
            }

            float horizontal = 0f;
            float forward = 0f;
            float vertical = 0f;
            float yaw = 0f;

            if (keyboard.aKey.isPressed) horizontal -= 1f;
            if (keyboard.dKey.isPressed) horizontal += 1f;
            if (keyboard.sKey.isPressed) forward -= 1f;
            if (keyboard.wKey.isPressed) forward += 1f;
            if (keyboard.qKey.isPressed) vertical -= 1f;
            if (keyboard.eKey.isPressed) vertical += 1f;
            if (keyboard.leftArrowKey.isPressed) yaw -= 1f;
            if (keyboard.rightArrowKey.isPressed) yaw += 1f;

            Vector3 planarForward = Vector3.ProjectOnPlane(transform.forward, Vector3.up);
            if (planarForward.sqrMagnitude < 0.0001f)
            {
                planarForward = Vector3.forward;
            }

            planarForward.Normalize();
            Vector3 planarRight = Vector3.Cross(Vector3.up, planarForward).normalized;
            Vector3 movement = planarRight * horizontal + planarForward * forward + Vector3.up * vertical;
            if (movement.sqrMagnitude > 1f)
            {
                movement.Normalize();
            }

            transform.position += movement * (movementSpeed * Time.unscaledDeltaTime);
            transform.Rotate(Vector3.up, yaw * yawSpeedDegrees * Time.unscaledDeltaTime, Space.World);
        }

        private void OnValidate()
        {
            movementSpeed = Mathf.Max(0f, movementSpeed);
            yawSpeedDegrees = Mathf.Max(0f, yawSpeedDegrees);
        }
    }
}
