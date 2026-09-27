using System.Reflection;
using Align.Calibration;
using Align.Integration;
using Align.Networking;
using Align.Pose;
using Align.Presentation;
using NUnit.Framework;
using UnityEngine;

namespace Align.Tests
{
    public sealed class MatchCardDismissalTests
    {
        [TestCase(false, true, NarrationPlaybackState.Idle, false)]
        [TestCase(false, true, NarrationPlaybackState.Completed, false)]
        [TestCase(false, false, NarrationPlaybackState.Idle, false)]
        [TestCase(true, true, NarrationPlaybackState.Idle, false)]
        [TestCase(true, true, NarrationPlaybackState.Loading, false)]
        [TestCase(true, true, NarrationPlaybackState.Speaking, false)]
        [TestCase(true, true, NarrationPlaybackState.Completed, true)]
        [TestCase(true, true, NarrationPlaybackState.Failed, true)]
        [TestCase(true, false, NarrationPlaybackState.Idle, true)]
        public void DismissalRequiresAnIntroductionAndFinishedAudio(
            bool hasIntroduction, bool enabled, NarrationPlaybackState state, bool expected)
        {
            Assert.That(MatchCardDismissalPolicy.CanDismiss(hasIntroduction, enabled, state), Is.EqualTo(expected));
        }

        [TestCase(false, NarrationPlaybackState.Idle)]
        [TestCase(true, NarrationPlaybackState.Idle)]
        [TestCase(true, NarrationPlaybackState.Loading)]
        [TestCase(true, NarrationPlaybackState.Speaking)]
        public void PrimaryPressCannotHideANameOrInterruptPendingSpeech(bool hasIntroduction, NarrationPlaybackState state)
        {
            WithController((controller, visibility, player) =>
            {
                SetField(controller, "_hasMatchIntroduction", hasIntroduction);
                SetPlayback(player, state);
                for (int index = 0; index < 4; index++) Invoke(controller, "HandlePrimaryPress");
                Assert.IsFalse(visibility.IsDismissed);
                Assert.That(player.PlaybackState, Is.EqualTo(state));
            });
        }

        [TestCase(NarrationPlaybackState.Completed)]
        [TestCase(NarrationPlaybackState.Failed)]
        public void FinishedIntroductionWaitsForAPressAndCanBeShownAgainWithoutRestartingSpeech(NarrationPlaybackState state)
        {
            WithController((controller, visibility, player) =>
            {
                SetField(controller, "_hasMatchIntroduction", true);
                SetPlayback(player, state);
                Assert.IsFalse(visibility.IsDismissed); // Completion alone never hides it.
                Invoke(controller, "HandlePrimaryPress");
                Assert.IsTrue(visibility.IsDismissed);
                Invoke(controller, "HandlePrimaryPress");
                Assert.IsFalse(visibility.IsDismissed);
                Invoke(controller, "HandlePrimaryPress");
                Assert.IsTrue(visibility.IsDismissed);
                Assert.That(player.PlaybackState, Is.EqualTo(state));
            });
        }

        [Test]
        public void ResetOrNewMatchRestoresTheNameAndLocksDismissalAgain()
        {
            WithController((controller, visibility, player) =>
            {
                SetField(controller, "_hasMatchIntroduction", true);
                SetPlayback(player, NarrationPlaybackState.Completed);
                Invoke(controller, "HandlePrimaryPress");
                Assert.IsTrue(visibility.IsDismissed);
                Invoke(controller, "ResetCardDismissal");
                Invoke(controller, "HandlePrimaryPress");
                Assert.IsFalse(visibility.IsDismissed);
            });
        }

        [TestCase(NarrationPlaybackState.Loading)]
        [TestCase(NarrationPlaybackState.Speaking)]
        [TestCase(NarrationPlaybackState.Completed)]
        [TestCase(NarrationPlaybackState.Failed)]
        public void ClearingAudioNeverGrantsCompletionToTheNextMatch(NarrationPlaybackState state)
        {
            WithController((controller, visibility, player) =>
            {
                SetPlayback(player, state);
                player.ClearMatch();
                Assert.That(player.PlaybackState, Is.EqualTo(NarrationPlaybackState.Idle));
                Assert.IsFalse(MatchCardDismissalPolicy.CanDismiss(true, true, player.PlaybackState));
            });
        }

        [Test]
        public void DismissedMatchSurvivesTrackingGapsButANewIntroductionRestoresTheCard()
        {
            WithController((controller, visibility, player) =>
            {
                var transport = controller.gameObject.AddComponent<HttpRoomTransport>();
                transport.enabled = false;
                controller.Configure(null, transport, visibility.GetComponent<RemoteParticipantView>(), null);
                const string reason = "A shared introduction.";
                SetField(controller, "_remoteProfileId", "maya");
                SetField(controller, "_cardMatchKey", "DEMO:0:pair-1:alex:peer:maya:" + reason);
                SetField(controller, "_hasMatchIntroduction", true);
                SetPlayback(player, NarrationPlaybackState.Completed);
                Invoke(controller, "HandlePrimaryPress");
                var snapshot = new RoomStateSnapshot
                {
                    roomCode = "DEMO", assignedProfileId = "alex", matchAvailable = true,
                    presentationId = "pair-1", introductionRequested = true, introductionRevealed = true,
                    match = new RoomMatchPayload { userA = "alex", userB = "maya", compatible = true, reason = reason },
                    participants = new[] { new RoomParticipantPayload
                    {
                        clientId = "peer", profileId = "maya", calibrated = true,
                        pose = new RoomPosePayload { tracked = false, rw = 1, sequence = 1 }
                    } }
                };
                Invoke(controller, "ApplySnapshot", snapshot);
                Assert.IsTrue(visibility.IsDismissed);
                Assert.That(player.PlaybackState, Is.EqualTo(NarrationPlaybackState.Completed));

                // Isolate the visual new-match transition without making an HTTP request.
                SetField(controller, "narrateMatchBios", false);
                snapshot.match.reason = "A different shared introduction.";
                Invoke(controller, "ApplySnapshot", snapshot);
                Assert.IsFalse(visibility.IsDismissed);
                Assert.That(player.PlaybackState, Is.EqualTo(NarrationPlaybackState.Idle));
            });
        }

        private static void WithController(System.Action<TwoHeadsetDemoController, RemoteCardVisibility, BioNarrationPlayer> action)
        {
            var root = new GameObject("Dismissal test");
            var remote = new GameObject("Remote participant");
            try
            {
                var participant = remote.AddComponent<RemoteParticipantView>();
                var visibility = remote.AddComponent<RemoteCardVisibility>();
                var controller = root.AddComponent<TwoHeadsetDemoController>();
                controller.Configure(null, null, participant, null);
                var calibration = (SharedOriginCalibration)GetField(controller, "_calibration");
                calibration.Capture(new HeadPoseSample(Vector3.zero, Quaternion.identity, true, 0));
                action(controller, visibility, root.GetComponent<BioNarrationPlayer>());
            }
            finally
            {
                Object.DestroyImmediate(root);
                Object.DestroyImmediate(remote);
            }
        }

        private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;
        private static object GetField(object target, string name) => target.GetType().GetField(name, PrivateInstance).GetValue(target);
        private static void SetField(object target, string name, object value) => target.GetType().GetField(name, PrivateInstance).SetValue(target, value);
        private static void Invoke(object target, string name, params object[] arguments) => target.GetType().GetMethod(name, PrivateInstance).Invoke(target, arguments);
        private static void SetPlayback(BioNarrationPlayer player, NarrationPlaybackState state) =>
            SetField(player, "<PlaybackState>k__BackingField", state);
    }
}
