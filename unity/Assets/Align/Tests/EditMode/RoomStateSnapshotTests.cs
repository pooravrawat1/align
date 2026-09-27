using Align.Networking;
using NUnit.Framework;
using UnityEngine;

namespace Align.Tests.EditMode
{
    public sealed class RoomStateSnapshotTests
    {
        [TestCase("pending", "")]
        [TestCase("unavailable", "AI introduction unavailable. Retrying shortly; no scripted fallback.")]
        public void LiveStatusSurvivesDeserialization(string status, string error)
        {
            string json = "{\"clientId\":\"quest\",\"matchAvailable\":false,\"matchStatus\":\"" +
                status + "\",\"matchError\":\"" + error + "\"}";
            RoomStateSnapshot snapshot = JsonUtility.FromJson<RoomStateSnapshot>(json);
            Assert.IsFalse(snapshot.matchAvailable);
            Assert.AreEqual(status, snapshot.matchStatus);
            Assert.AreEqual(error, snapshot.matchError);
        }

        [Test]
        public void OlderRelaySnapshotsRemainCompatible()
        {
            RoomStateSnapshot snapshot = JsonUtility.FromJson<RoomStateSnapshot>(
                "{\"clientId\":\"quest\",\"matchAvailable\":true,\"match\":{\"compatible\":true,\"reason\":\"A shared introduction\"}}");
            Assert.IsTrue(snapshot.matchAvailable);
            Assert.IsTrue(snapshot.match.compatible);
            Assert.AreEqual("A shared introduction", snapshot.match.reason);
            Assert.IsFalse(snapshot.introductionRevealed); // Fail closed to names only.
        }

        [Test]
        public void SharedRevealStateSurvivesDeserialization()
        {
            var snapshot = JsonUtility.FromJson<RoomStateSnapshot>(
                "{\"presentationId\":\"pair-1\",\"introductionRequested\":true,\"introductionRevealed\":true}");
            Assert.AreEqual("pair-1", snapshot.presentationId);
            Assert.IsTrue(snapshot.introductionRequested);
            Assert.IsTrue(snapshot.introductionRevealed);
        }
    }
}
