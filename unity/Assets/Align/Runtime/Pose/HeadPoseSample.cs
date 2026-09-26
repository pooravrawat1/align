using UnityEngine;

namespace Align.Pose
{
    /// <summary>
    /// Engine-neutral pose data consumed by calibration, networking, and presentation.
    /// The timestamp belongs to the producer and must not be used to compare clocks
    /// between devices. Consumers track local receipt time for stale-pose checks.
    /// </summary>
    public readonly struct HeadPoseSample
    {
        public HeadPoseSample(
            Vector3 position,
            Quaternion rotation,
            bool isTracked,
            double sampleTimeSeconds)
        {
            Position = position;
            Rotation = rotation;
            IsTracked = isTracked;
            SampleTimeSeconds = sampleTimeSeconds;
        }

        public Vector3 Position { get; }

        public Quaternion Rotation { get; }

        public bool IsTracked { get; }

        public double SampleTimeSeconds { get; }
    }
}
