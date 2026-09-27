using Align.Editor;
using Align.Presentation;
using Align.Profiles;
using NUnit.Framework;
using UnityEngine;

namespace Align.Tests
{
    public sealed class RemoteParticipantFactoryTests
    {
        [Test]
        public void StandaloneParticipantHasVisibilityOnRootAndStartsUnready()
        {
            (RemoteParticipantView participant, RemoteProfileCardPresenter presenter) =
                QuestDemoSceneFactory.CreateRemoteParticipant(
                    null,
                    new ProfileCardData { UserId = "remote", Name = "Remote Person" });
            try
            {
                RemoteCardVisibility visibility = participant.GetComponent<RemoteCardVisibility>();

                Assert.That(visibility, Is.Not.Null);
                Assert.That(visibility.Participant, Is.SameAs(participant));
                Assert.That(visibility.CardRoot, Is.SameAs(presenter.gameObject));
                Assert.That(visibility.gameObject, Is.Not.SameAs(visibility.CardRoot));
                Assert.That(participant.IsInSameRoom, Is.False);
                Assert.That(participant.IsLocalCalibrated, Is.False);
                Assert.That(participant.IsRemoteCalibrated, Is.False);
            }
            finally
            {
                Object.DestroyImmediate(participant.gameObject);
            }
        }
    }
}
