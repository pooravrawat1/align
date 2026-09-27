using System;
using System.Reflection;
using Align.Calibration;
using Align.Integration;
using Align.Networking;
using Align.Pose;
using Align.Presentation;
using NUnit.Framework;
using TMPro;
using UnityEngine;

namespace Align.Tests
{
    public sealed class SharedIntroductionRevealTests
    {
        [Test]
        public void ReadyMatchShowsOnlyNameUntilSharedRevealArrives()
        {
            using var view = new Harness();
            var snapshot = view.Snapshot();
            view.Apply(snapshot);
            Assert.IsTrue(view.Name.gameObject.activeSelf);
            Assert.That(view.Name.text, Is.EqualTo("maya chen"));
            Assert.IsFalse(view.Reason.gameObject.activeSelf);
            Assert.That(view.Reason.text, Is.Empty);
            Assert.That(view.Player.PlaybackState, Is.EqualTo(NarrationPlaybackState.Idle));

            view.Press();
            Assert.That(Get(view.Transport, "_revealPresentationId"), Is.EqualTo("pair-1"));
            Assert.IsFalse(view.Visibility.IsDismissed);
            Assert.IsFalse(view.Reason.gameObject.activeSelf); // No optimistic local-only reveal.

            snapshot.introductionRequested = true;
            snapshot.introductionRevealed = true;
            view.Apply(snapshot);
            Assert.IsTrue(view.Reason.gameObject.activeSelf);
            Assert.That(view.Reason.text, Is.EqualTo(snapshot.match.reason));
            Assert.That(view.Presenter.PresentationState, Is.EqualTo(RemotePresentationState.DiscoveryMatched));
        }

        [Test]
        public void PeerRevealOpensSummaryWithoutAnyLocalPress()
        {
            using var view = new Harness();
            var snapshot = view.Snapshot();
            view.Apply(snapshot);
            snapshot.introductionRequested = true;
            snapshot.introductionRevealed = true;
            view.Apply(snapshot);
            Assert.IsTrue(view.Reason.gameObject.activeSelf);
            Assert.IsFalse(view.Visibility.IsDismissed);
            Assert.That(Get(view.Transport, "_revealPresentationId"), Is.Empty);
        }

        [Test]
        public void PressWhileSummaryIsPendingRequestsSharedRevealWithoutHidingName()
        {
            using var view = new Harness();
            var snapshot = view.Snapshot();
            snapshot.matchAvailable = false;
            snapshot.matchStatus = "pending";
            view.Apply(snapshot);
            view.Press();
            Assert.That(Get(view.Transport, "_revealPresentationId"), Is.EqualTo("pair-1"));
            Assert.IsFalse(view.Visibility.IsDismissed);
            Assert.IsFalse(view.Reason.gameObject.activeSelf);
            snapshot.introductionRequested = true;
            view.Apply(snapshot);
            view.Press();
            Assert.IsFalse(view.Visibility.IsDismissed);
        }

        [Test]
        public void CalibrationPressNeverRequestsReveal()
        {
            using var view = new Harness();
            ((SharedOriginCalibration)Get(view.Controller, "_calibration")).Reset();
            Set(view.Controller, "_poseProvider", new TrackedPose());
            view.Press();
            Assert.IsTrue(((SharedOriginCalibration)Get(view.Controller, "_calibration")).IsCalibrated);
            Assert.That(Get(view.Transport, "_revealPresentationId"), Is.Empty);
            Assert.IsFalse(view.Visibility.IsDismissed);
        }

        [Test]
        public void NewPairingReturnsToNameEvenWithTheSameMatchText()
        {
            using var view = new Harness();
            var snapshot = view.Snapshot();
            snapshot.introductionRevealed = true;
            snapshot.introductionRequested = true;
            view.Apply(snapshot);
            view.Press(); // Disabled narration permits dismissal after reveal.
            Assert.IsTrue(view.Visibility.IsDismissed);
            snapshot.presentationId = "pair-2";
            snapshot.introductionRequested = false;
            snapshot.introductionRevealed = false;
            view.Apply(snapshot);
            Assert.IsFalse(view.Visibility.IsDismissed);
            Assert.IsFalse(view.Reason.gameObject.activeSelf);
            Assert.IsTrue(view.Name.gameObject.activeSelf);
            view.Press();
            Assert.That(Get(view.Transport, "_revealPresentationId"), Is.EqualTo("pair-2"));
        }

        [Test]
        public void ResetDropsAnUnacknowledgedRevealRequest()
        {
            using var view = new Harness();
            view.Transport.RequestIntroductionReveal("pair-1");
            view.Transport.RequestRoomReset();
            Assert.That(Get(view.Transport, "_revealPresentationId"), Is.Empty);
        }

        private sealed class Harness : IDisposable
        {
            private readonly GameObject root = new("Reveal test");
            private readonly GameObject remote = new("Remote participant");
            public readonly TwoHeadsetDemoController Controller;
            public readonly HttpRoomTransport Transport;
            public readonly RemoteCardVisibility Visibility;
            public readonly RemoteProfileCardPresenter Presenter;
            public readonly TMP_Text Name;
            public readonly TMP_Text Reason;
            public BioNarrationPlayer Player => root.GetComponent<BioNarrationPlayer>();

            public Harness()
            {
                Transport = root.AddComponent<HttpRoomTransport>();
                Transport.enabled = false; // Tests never send HTTP.
                var participant = remote.AddComponent<RemoteParticipantView>();
                Visibility = remote.AddComponent<RemoteCardVisibility>();
                var card = new GameObject("Card", typeof(RectTransform));
                card.transform.SetParent(remote.transform);
                Name = Text(card.transform, "Name");
                Reason = Text(card.transform, "Reason");
                Presenter = card.AddComponent<RemoteProfileCardPresenter>();
                Presenter.Configure(Name, null, null, null, Reason, null);
                Controller = root.AddComponent<TwoHeadsetDemoController>();
                Controller.Configure(null, Transport, participant, Presenter);
                Set(Controller, "narrateMatchBios", false);
                ((SharedOriginCalibration)Get(Controller, "_calibration")).Capture(
                    new HeadPoseSample(Vector3.zero, Quaternion.identity, true, 0));
            }

            public RoomStateSnapshot Snapshot() => new()
            {
                roomCode = "DEMO", clientId = Transport.ClientId, assignedProfileId = "alex",
                presentationId = "pair-1", matchAvailable = true, matchStatus = "ready",
                match = new RoomMatchPayload { userA = "alex", userB = "maya", compatible = true, reason = "You both attended Build Together." },
                participants = new[] { new RoomParticipantPayload
                {
                    clientId = "peer", profileId = "maya", calibrated = true,
                    pose = new RoomPosePayload { tracked = true, rw = 1, sequence = 1 }
                } }
            };
            public void Apply(RoomStateSnapshot snapshot) => Invoke(Controller, "ApplySnapshot", snapshot);
            public void Press() => Invoke(Controller, "HandlePrimaryPress");
            public void Dispose()
            {
                UnityEngine.Object.DestroyImmediate(root);
                UnityEngine.Object.DestroyImmediate(remote);
            }
            private static TMP_Text Text(Transform parent, string name)
            {
                var child = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer));
                child.transform.SetParent(parent, false);
                return child.AddComponent<TextMeshProUGUI>();
            }
        }

        private sealed class TrackedPose : IHeadPoseProvider
        {
            public Vector3 Position => Vector3.zero;
            public Quaternion Rotation => Quaternion.identity;
            public bool IsTracked => true;
            public double SampleTimeSeconds => 0;
            public HeadPoseSample CurrentPose => new(Position, Rotation, IsTracked, SampleTimeSeconds);
        }
        private const BindingFlags Flags = BindingFlags.Instance | BindingFlags.NonPublic;
        private static object Get(object target, string name) => target.GetType().GetField(name, Flags).GetValue(target);
        private static void Set(object target, string name, object value) => target.GetType().GetField(name, Flags).SetValue(target, value);
        private static void Invoke(object target, string name, params object[] args) => target.GetType().GetMethod(name, Flags).Invoke(target, args);
    }
}
