using Align.Pose;
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

        [Test]
        public void CardHeightStaysOnWorldUpWhenTheRemoteHeadTilts()
        {
            var remoteHead = new GameObject("Remote Head");
            var card = new GameObject("Card");
            card.transform.SetParent(remoteHead.transform, false);

            try
            {
                RemoteParticipantView participant =
                    remoteHead.AddComponent<RemoteParticipantView>();
                remoteHead.transform.SetPositionAndRotation(
                    new Vector3(1f, 1.6f, 2f), Quaternion.Euler(70f, 15f, 55f));
                participant.Configure(remoteHead.transform, card.transform, 0.22f);

                Assert.That(card.transform.position.x, Is.EqualTo(1f).Within(0.001f));
                Assert.That(card.transform.position.y, Is.EqualTo(1.82f).Within(0.001f));
                Assert.That(card.transform.position.z, Is.EqualTo(2f).Within(0.001f));
            }
            finally
            {
                Object.DestroyImmediate(remoteHead);
            }
        }

        [Test]
        public void ViewerPanelCanShowBeforeCalibrationAndOutsideTheViewFrustum()
        {
            var input = ValidInput(localCalibrated: false, remoteCalibrated: false,
                remotePosition: new Vector3(0f, 0f, -20f));
            Assert.That(RemoteCardVisibilityPolicy.ShouldShowViewerPanel(input), Is.True);
            Assert.That(RemoteCardVisibilityPolicy.ShouldShow(input), Is.False);
        }

        [Test]
        public void ViewerPanelHidesDisconnectedUntrackedAndStalePeers()
        {
            Assert.That(RemoteCardVisibilityPolicy.ShouldShowViewerPanel(
                ValidInput(sameRoom: false)), Is.False);
            Assert.That(RemoteCardVisibilityPolicy.ShouldShowViewerPanel(
                ValidInput(isTracked: false)), Is.False);
            Assert.That(RemoteCardVisibilityPolicy.ShouldShowViewerPanel(
                ValidInput(nowSeconds: 12d, lastReceivedAtSeconds: 10d)), Is.False);
        }

        [Test]
        public void DismissedCardStaysHiddenAcrossRoomUpdatesAndCanBeRestored()
        {
            var peer = new GameObject("Peer");
            var viewer = new GameObject("Viewer", typeof(Camera));
            var card = new GameObject("Card");
            try
            {
                RemoteParticipantView participant = peer.AddComponent<RemoteParticipantView>();
                participant.Configure(peer.transform, null);
                participant.SetSessionState(true, true, true);
                participant.ApplyPose(new HeadPoseSample(
                    new Vector3(0f, 1.6f, 2f), Quaternion.identity, true,
                    Time.realtimeSinceStartupAsDouble));

                RemoteCardVisibility visibility = peer.AddComponent<RemoteCardVisibility>();
                visibility.Configure(participant, viewer.GetComponent<Camera>(), card, viewerFixed: true);
                visibility.RefreshVisibility();
                Assert.That(card.activeSelf, Is.True);

                visibility.SetDismissed(true);
                Assert.That(card.activeSelf, Is.False);
                participant.SetSessionState(true, true, true);
                participant.ApplyPose(new HeadPoseSample(
                    new Vector3(1f, 1.6f, 2f), Quaternion.identity, true,
                    Time.realtimeSinceStartupAsDouble));
                visibility.RefreshVisibility();
                Assert.That(card.activeSelf, Is.False, "Fresh room updates must not reopen a dismissed card.");

                visibility.SetDismissed(false);
                Assert.That(card.activeSelf, Is.True);
                participant.ClearPose();
                visibility.SetDismissed(true);
                visibility.SetDismissed(false);
                Assert.That(card.activeSelf, Is.False, "Reopening must still require a live tracked peer.");
            }
            finally
            {
                Object.DestroyImmediate(card);
                Object.DestroyImmediate(viewer);
                Object.DestroyImmediate(peer);
            }
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
