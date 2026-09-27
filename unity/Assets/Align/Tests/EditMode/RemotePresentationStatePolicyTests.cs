using Align.Presentation;
using Align.Profiles;
using NUnit.Framework;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Align.Tests
{
    public sealed class RemotePresentationStatePolicyTests
    {
        [Test]
        public void DiscoveryStateReflectsSharedMatchResult()
        {
            Assert.That(RemotePresentationStatePolicy.DiscoveryState(false), Is.EqualTo(RemotePresentationState.DiscoveryNeutral));
            Assert.That(RemotePresentationStatePolicy.DiscoveryState(true), Is.EqualTo(RemotePresentationState.DiscoveryMatched));
        }

        [Test]
        public void EmptyReasonRemainsEmpty()
        {
            Assert.That(RemotePresentationStatePolicy.LimitReason("   "), Is.Empty);
        }

        [Test]
        public void MatchReasonIsLimitedToThirtyWords()
        {
            string reason = string.Join(" ", new[] {
                "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
                "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
                "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty", "hidden"
            });

            string limited = RemotePresentationStatePolicy.LimitReason(reason);

            Assert.That(limited.Split(' '), Has.Length.EqualTo(RemotePresentationStatePolicy.MaximumReasonWords));
            Assert.That(limited, Does.Not.Contain("hidden"));
            Assert.That(limited, Does.EndWith("…"));
        }

        [Test]
        public void ConversationTemporarilyOverridesAndThenRestoresDiscoveryState()
        {
            var root = new GameObject("Presenter test");
            try
            {
                var presenter = root.AddComponent<RemoteProfileCardPresenter>();
                presenter.SetMatchState(true, "A useful reason to meet.");
                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.DiscoveryMatched));

                presenter.SetConversationState(true);
                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.Conversation));

                presenter.SetConversationState(false);
                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.DiscoveryMatched));
            }
            finally
            {
                Object.DestroyImmediate(root);
            }
        }

        [Test]
        public void MatchChangesDuringConversationApplyOnlyWhenDiscoveryResumes()
        {
            var root = new GameObject("Presenter conversation update test");
            try
            {
                var presenter = root.AddComponent<RemoteProfileCardPresenter>();
                presenter.SetMatchState(true, "Initial reason.");
                presenter.SetConversationState(true);

                presenter.SetMatchState(false, string.Empty);
                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.Conversation));
                presenter.SetConversationState(false);
                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.DiscoveryNeutral));

                presenter.SetConversationState(true);
                presenter.SetMatchState(true, "Updated reason.");
                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.Conversation));
                presenter.SetConversationState(false);
                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.DiscoveryMatched));
            }
            finally
            {
                Object.DestroyImmediate(root);
            }
        }

        [TestCase("")]
        [TestCase("   ")]
        public void CompatibleResultWithoutReasonRemainsNeutral(string reason)
        {
            var root = new GameObject("Presenter empty reason test");
            try
            {
                var presenter = root.AddComponent<RemoteProfileCardPresenter>();
                presenter.SetMatchState(true, reason);

                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.DiscoveryNeutral));

                presenter.SetConversationState(true);
                presenter.SetConversationState(false);
                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.DiscoveryNeutral));
            }
            finally
            {
                Object.DestroyImmediate(root);
            }
        }

        [Test]
        public void ReactivatingHiddenCardSnapsToLatestNeutralMaterial()
        {
            (GameObject root, RemoteProfileCardPresenter presenter, Image panel) = CreateConfiguredPresenter("Neutral recovery");
            try
            {
                root.SetActive(false);
                presenter.SetMatchState(true, "Current positive reason.");
                Assert.That(panel.color.a, Is.GreaterThan(0f));

                root.SetActive(true);
                root.SetActive(false);
                presenter.SetMatchState(false, string.Empty);
                root.SetActive(true);

                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.DiscoveryNeutral));
                Assert.That(panel.color.a, Is.EqualTo(0f));
            }
            finally
            {
                Object.DestroyImmediate(root);
            }
        }

        [Test]
        public void ReactivatingHiddenCardSnapsConversationMaterialWithoutGreenFlash()
        {
            (GameObject root, RemoteProfileCardPresenter presenter, Image panel) = CreateConfiguredPresenter("Conversation recovery");
            try
            {
                root.SetActive(false);
                presenter.SetMatchState(true, "Current positive reason.");
                Assert.That(panel.color.a, Is.GreaterThan(0f));

                root.SetActive(true);
                root.SetActive(false);
                presenter.SetConversationState(true);
                root.SetActive(true);

                Assert.That(presenter.PresentationState, Is.EqualTo(RemotePresentationState.Conversation));
                Assert.That(panel.color.a, Is.EqualTo(0f));
            }
            finally
            {
                Object.DestroyImmediate(root);
            }
        }

        [Test]
        public void VisibilityRepairIsIdempotentAndLivesAboveControlledCard()
        {
            var root = new GameObject("Legacy participant");
            var card = new GameObject("Card");
            card.transform.SetParent(root.transform, false);
            try
            {
                var participant = root.AddComponent<RemoteParticipantView>();
                RemoteCardVisibility first = RemoteParticipantPresentationWiring.EnsureVisibility(participant, null, card);
                RemoteCardVisibility repaired = RemoteParticipantPresentationWiring.EnsureVisibility(participant, null, card);

                Assert.That(repaired, Is.SameAs(first));
                Assert.That(root.GetComponents<RemoteCardVisibility>(), Has.Length.EqualTo(1));
                Assert.That(repaired.gameObject, Is.SameAs(root));
                Assert.That(repaired.CardRoot, Is.SameAs(card));
                Assert.That(repaired.gameObject, Is.Not.SameAs(repaired.CardRoot));
            }
            finally
            {
                Object.DestroyImmediate(root);
            }
        }

        [Test]
        public void BindingProfileNeverEnablesPrivateHeadsetDetails()
        {
            var root = new GameObject("Presenter privacy test", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            try
            {
                TMP_Text name = CreateText(root.transform, "Name");
                TMP_Text bio = CreateText(root.transform, "Bio");
                TMP_Text interests = CreateText(root.transform, "Interests");
                TMP_Text social = CreateText(root.transform, "Social");
                TMP_Text reason = CreateText(root.transform, "Reason");
                var presenter = root.AddComponent<RemoteProfileCardPresenter>();
                presenter.Configure(name, bio, interests, social, reason, root.GetComponent<Image>());

                presenter.Bind(new ProfileCardData
                {
                    Name = "Maya Chen",
                    Bio = "Private bio",
                    Interests = new[] { "Private interest" },
                    SocialLinks = new[] { new SocialLinkData { Platform = "Private", UrlOrHandle = "handle" } }
                });
                presenter.SetMatchState(true, "A useful reason to meet.");

                Assert.That(name.text, Is.EqualTo("maya chen"));
                Assert.That(bio.gameObject.activeSelf, Is.False);
                Assert.That(interests.gameObject.activeSelf, Is.False);
                Assert.That(social.gameObject.activeSelf, Is.False);
                Assert.That(reason.gameObject.activeSelf, Is.True);
            }
            finally
            {
                Object.DestroyImmediate(root);
            }
        }

        private static TMP_Text CreateText(Transform parent, string name)
        {
            var child = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer));
            child.transform.SetParent(parent, false);
            return child.AddComponent<TextMeshProUGUI>();
        }

        private static (GameObject, RemoteProfileCardPresenter, Image) CreateConfiguredPresenter(string name)
        {
            var root = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            Image panel = root.GetComponent<Image>();
            var presenter = root.AddComponent<RemoteProfileCardPresenter>();
            presenter.Configure(
                CreateText(root.transform, "Name"),
                null,
                null,
                null,
                CreateText(root.transform, "Reason"),
                panel);
            return (root, presenter, panel);
        }
    }
}
