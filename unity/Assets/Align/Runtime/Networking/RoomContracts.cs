using System;
using Align.Pose;
using UnityEngine;

namespace Align.Networking
{
    [Serializable]
    public sealed class RoomPosePayload
    {
        public float px;
        public float py;
        public float pz;
        public float rx;
        public float ry;
        public float rz;
        public float rw = 1f;
        public bool tracked;
        public int sequence;

        public static RoomPosePayload FromPose(in HeadPoseSample pose, int poseSequence)
        {
            return new RoomPosePayload
            {
                px = pose.Position.x,
                py = pose.Position.y,
                pz = pose.Position.z,
                rx = pose.Rotation.x,
                ry = pose.Rotation.y,
                rz = pose.Rotation.z,
                rw = pose.Rotation.w,
                tracked = pose.IsTracked,
                sequence = Mathf.Max(0, poseSequence)
            };
        }

        public HeadPoseSample ToPose(double receivedAtSeconds)
        {
            Quaternion rotation = new(rx, ry, rz, rw);
            float rotationMagnitudeSquared =
                rotation.x * rotation.x + rotation.y * rotation.y +
                rotation.z * rotation.z + rotation.w * rotation.w;
            if (rotationMagnitudeSquared < 0.0001f)
            {
                rotation = Quaternion.identity;
            }
            else
            {
                rotation = Quaternion.Normalize(rotation);
            }

            return new HeadPoseSample(
                new Vector3(px, py, pz),
                rotation,
                tracked,
                receivedAtSeconds);
        }
    }

    [Serializable]
    public sealed class RoomUpdateRequest
    {
        public string roomCode;
        public string clientId;
        public string requestedProfileId;
        public bool calibrated;
        public RoomPosePayload pose;
        public bool resetRoom;
    }

    [Serializable]
    public sealed class RoomParticipantPayload
    {
        public string clientId;
        public string profileId;
        public bool calibrated;
        public RoomPosePayload pose;
    }

    [Serializable]
    public sealed class RoomMatchPayload
    {
        public string userA;
        public string userB;
        public bool compatible;
        public int score;
        public string reason;
    }

    [Serializable]
    public sealed class RoomStateSnapshot
    {
        public string roomCode;
        public string clientId;
        public string assignedProfileId;
        public int revision;
        public int resetGeneration;
        public RoomParticipantPayload[] participants;
        public bool matchAvailable;
        public string matchSource;
        public RoomMatchPayload match;
    }

    public readonly struct LocalRoomState
    {
        public LocalRoomState(
            string requestedProfileId,
            bool calibrated,
            HeadPoseSample pose,
            int sequence)
        {
            RequestedProfileId = requestedProfileId;
            Calibrated = calibrated;
            Pose = pose;
            Sequence = sequence;
        }

        public string RequestedProfileId { get; }
        public bool Calibrated { get; }
        public HeadPoseSample Pose { get; }
        public int Sequence { get; }
    }
}
