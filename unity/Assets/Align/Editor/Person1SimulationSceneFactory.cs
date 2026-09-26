using System.IO;
using Align.Presentation;
using Align.Profiles;
using Align.Simulation;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Align.Editor
{
    public static class Person1SimulationSceneFactory
    {
        private const string SceneDirectory = "Assets/Align/Scenes";
        private const string ScenePath = SceneDirectory + "/Person1Simulation.unity";

        [MenuItem("Align/Setup/Create Person 1 Simulation Scene")]
        public static void CreateScene()
        {
            if (EditorApplication.isPlaying)
            {
                Debug.LogWarning("Exit Play Mode before creating the simulation scene.");
                return;
            }

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            Camera viewer = CreateViewerCamera();
            CreateLighting();
            CreateFloor();

            var sourceObject = new GameObject("Simulated Remote Pose Source");
            sourceObject.transform.SetPositionAndRotation(
                new Vector3(0f, 1.6f, 2.2f),
                Quaternion.identity);
            SimulatedHeadPoseProvider poseProvider =
                sourceObject.AddComponent<SimulatedHeadPoseProvider>();

            var remoteRoot = new GameObject("Remote Participant - Maya");
            RemoteParticipantView participant =
                remoteRoot.AddComponent<RemoteParticipantView>();
            CreateHeadsetPlaceholder(remoteRoot.transform);

            GameObject card = CreateProfileCard(remoteRoot.transform, viewer.transform);
            participant.Configure(remoteRoot.transform, card.transform, 0.25f);
            participant.SetSessionState(true, true, true);

            RemoteCardVisibility visibility =
                remoteRoot.AddComponent<RemoteCardVisibility>();
            visibility.Configure(participant, viewer, card);

            PoseLoopbackDriver loopback = sourceObject.AddComponent<PoseLoopbackDriver>();
            loopback.Configure(poseProvider, participant);

            Directory.CreateDirectory(SceneDirectory);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();

            Selection.activeGameObject = sourceObject;
            Debug.Log(
                "Created Person1Simulation. Press Play, use WASD/QE and arrow keys " +
                "to move the remote pose, and press T to toggle tracking.");
        }

        private static Camera CreateViewerCamera()
        {
            var cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.position = new Vector3(0f, 1.6f, -3.5f);
            cameraObject.transform.rotation = Quaternion.LookRotation(
                new Vector3(0f, 1.6f, 2.2f) - cameraObject.transform.position,
                Vector3.up);
            Camera camera = cameraObject.AddComponent<Camera>();
            camera.nearClipPlane = 0.05f;
            cameraObject.AddComponent<AudioListener>();
            return camera;
        }

        private static void CreateLighting()
        {
            var lightObject = new GameObject("Directional Light");
            lightObject.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            Light light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.2f;
        }

        private static void CreateFloor()
        {
            GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
            floor.name = "Simulation Floor";
            floor.transform.localScale = new Vector3(0.8f, 1f, 0.8f);
        }

        private static void CreateHeadsetPlaceholder(Transform parent)
        {
            GameObject headset = GameObject.CreatePrimitive(PrimitiveType.Cube);
            headset.name = "Debug Headset";
            headset.transform.SetParent(parent, false);
            headset.transform.localScale = new Vector3(0.24f, 0.12f, 0.14f);
        }

        private static GameObject CreateProfileCard(Transform parent, Transform viewer)
        {
            var card = new GameObject("Profile Card", typeof(RectTransform));
            card.transform.SetParent(parent, false);

            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.sizeDelta = new Vector2(620f, 330f);
            cardRect.localScale = Vector3.one * 0.0015f;

            Canvas canvas = card.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            card.AddComponent<CanvasScaler>().dynamicPixelsPerUnit = 12f;

            Image panel = card.AddComponent<Image>();
            panel.color = new Color(0.12f, 0.13f, 0.15f, 0.96f);

            TMP_Text name = CreateText(card.transform, "Name", 38f, new Vector2(32f, -28f), new Vector2(556f, 58f));
            TMP_Text bio = CreateText(card.transform, "Bio", 22f, new Vector2(32f, -91f), new Vector2(556f, 86f));
            TMP_Text interests = CreateText(card.transform, "Interests", 20f, new Vector2(32f, -184f), new Vector2(556f, 38f));
            TMP_Text social = CreateText(card.transform, "Social", 17f, new Vector2(32f, -228f), new Vector2(556f, 34f));
            TMP_Text matchReason = CreateText(card.transform, "Match reason", 18f, new Vector2(32f, -266f), new Vector2(556f, 48f));

            RemoteProfileCardPresenter presenter = card.AddComponent<RemoteProfileCardPresenter>();
            presenter.Configure(name, bio, interests, social, matchReason, panel);
            presenter.Bind(new ProfileCardData
            {
                UserId = "maya",
                Name = "Maya Chen",
                Bio = "Computer vision engineer building visual assistance software.",
                Interests = new[] { "Assistive technology", "Robotics", "Startups" },
                SocialLinks = new[]
                {
                    new SocialLinkData { Platform = "GitHub", UrlOrHandle = "maya-builds" }
                }
            });
            presenter.SetMatchState(false, string.Empty);

            YawBillboard billboard = card.AddComponent<YawBillboard>();
            billboard.Configure(viewer);
            return card;
        }

        private static TMP_Text CreateText(
            Transform parent,
            string objectName,
            float fontSize,
            Vector2 anchoredPosition,
            Vector2 size)
        {
            var textObject = new GameObject(objectName, typeof(RectTransform));
            textObject.transform.SetParent(parent, false);
            RectTransform rect = textObject.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;

            TextMeshProUGUI text = textObject.AddComponent<TextMeshProUGUI>();
            text.fontSize = fontSize;
            text.color = new Color(0.95f, 0.96f, 0.97f);
            text.alignment = TextAlignmentOptions.TopLeft;
            text.overflowMode = TextOverflowModes.Ellipsis;
            text.richText = false;
            return text;
        }
    }
}
