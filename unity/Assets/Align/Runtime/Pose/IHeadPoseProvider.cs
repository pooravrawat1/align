using UnityEngine;

namespace Align.Pose
{
    /// <summary>
    /// Isolates the rest of Align from a specific tracking implementation.
    /// </summary>
    public interface IHeadPoseProvider
    {
        Vector3 Position { get; }

        Quaternion Rotation { get; }

        bool IsTracked { get; }

        double SampleTimeSeconds { get; }

        HeadPoseSample CurrentPose { get; }
    }
}
