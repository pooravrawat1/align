using System.IO;
using Align.Profiles;
using UnityEditor;
using UnityEngine;

namespace Align.Editor
{
    public static class RemoteParticipantPrefabFactory
    {
        public const string PrefabDirectory = "Assets/Align/Prefabs";
        public const string PrefabPath = PrefabDirectory + "/RemoteParticipant.prefab";

        [MenuItem("Align/Setup/Create Remote Participant Prefab")]
        public static void CreatePrefab()
        {
            if (EditorApplication.isPlaying)
            {
                Debug.LogWarning("Exit Play Mode before creating the remote participant prefab.");
                return;
            }

            (var participant, _) = QuestDemoSceneFactory.CreateRemoteParticipant(
                null,
                new ProfileCardData { UserId = "remote", Name = "Participant" });
            try
            {
                Directory.CreateDirectory(PrefabDirectory);
                PrefabUtility.SaveAsPrefabAsset(participant.gameObject, PrefabPath);
                AssetDatabase.SaveAssets();
                Selection.activeObject = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath);
                Debug.Log($"Created standalone remote participant prefab at {PrefabPath}.");
            }
            finally
            {
                Object.DestroyImmediate(participant.gameObject);
            }
        }
    }
}
