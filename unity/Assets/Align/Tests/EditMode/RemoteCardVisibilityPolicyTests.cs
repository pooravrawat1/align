using Align.Presentation;
using NUnit.Framework;
using UnityEngine;

namespace Align.Tests
{
    public sealed class RemoteCardVisibilityPolicyTests
    {
        [Test]
        public void ValidParticipantInFrontOfViewerIsVisible()
        {
            Assert.That(RemoteCardVisibilityPolicy.ShouldShow(ValidInput()), Is.True);
        }

        [TestCase(false, true, true)]
        [TestCase(true, false, true)]
        [TestCase(true, true, false)]
        public void RoomAndCalibrationAreRequired(
            bool sameRoom,
            bool localCalibrated,
            bool remoteCalibrated)
        {
            RemoteCardVisibilityInput input = ValidInput(
                sameRoom: sameRoom,
                localCalibrated: localCalibrated,
                remoteCalibrated: remoteCalibrated);

            Assert.That(RemoteCardVisibilityPolicy.ShouldShow(input), Is.False);
        }

        [Test]
        public void TrackedPoseIsRequired()
        {
            Assert.That(
                RemoteCardVisibilityPolicy.ShouldShow(ValidInput(isTracked: false)),
                Is.False);
        }

        [Test]
        public void StalePoseIsHidden()
        {
            Assert.That(
                RemoteCardVisibilityPolicy.ShouldShow(
                    ValidInput(nowSeconds: 12d, lastReceivedAtSeconds: 10d)),
                Is.False);
        }

        [TestCase(0f, 0f, 0.2f)]
        [TestCase(0f, 0f, 7f)]
        public void ParticipantOutsideConfiguredRangeIsHidden(float x, float y, float z)
        {
            Assert.That(
                RemoteCardVisibilityPolicy.ShouldShow(
                    ValidInput(remotePosition: new Vector3(x, y, z))),
                Is.False);
        }

        [Test]
        public void ParticipantBehindViewerIsHidden()
        {
            Assert.That(
                RemoteCardVisibilityPolicy.ShouldShow(
                    ValidInput(remotePosition: new Vector3(0f, 0f, -2f))),
                Is.False);
        }

        private static RemoteCardVisibilityInput ValidInput(
            bool sameRoom = true,
            bool localCalibrated = true,
            bool remoteCalibrated = true,
            bool isTracked = true,
            double nowSeconds = 10d,
            double lastReceivedAtSeconds = 9.8d,
            Vector3? remotePosition = null)
        {
            return new RemoteCardVisibilityInput(
                sameRoom,
                localCalibrated,
                remoteCalibrated,
                hasPose: true,
                isPoseTracked: isTracked,
                lastPoseReceivedAtSeconds: lastReceivedAtSeconds,
                nowSeconds: nowSeconds,
                viewerPosition: Vector3.zero,
                viewerForward: Vector3.forward,
                remotePosition: remotePosition ?? new Vector3(0f, 0f, 2f),
                minimumDistanceMeters: 0.5f,
                maximumDistanceMeters: 6f,
                maximumPoseAgeSeconds: 0.75f,
                minimumViewDot: 0.35f);
        }
    }
}
