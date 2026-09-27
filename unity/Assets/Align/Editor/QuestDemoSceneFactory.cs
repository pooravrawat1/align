using System.IO;
using Align.Presentation;
using Align.Profiles;
using Align.Quest;
using TMPro;
using Unity.XR.CoreUtils;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using UnityEngine.XR.ARFoundation;

namespace Align.Editor
{
    public static class QuestDemoSceneFactory
    {
        public const string SceneDirectory = "Assets/Align/Scenes";
        public const string ScenePath = SceneDirectory + "/QuestDemo.unity";

        [MenuItem("Align/Setup/Create Quest Demo Scene")]
        public static void CreateScene()
        {
            if (EditorApplication.isPlaying)
            {
                Debug.LogWarning("Exit Play Mode before creating the Quest scene.");
                return;
            }

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("Align Runtime").AddComponent<QuestRuntimeBootstrap>();
            new GameObject("AR Session").AddComponent<ARSession>();

            Camera viewer = CreateXrOrigin();
            (RemoteParticipantView participant, RemoteProfileCardPresenter presenter) =
                CreateRemoteParticipant(
                    viewer, DemoMayaProfile(), "Remote Participant - Maya (Demo Anchor)", stagedReady: true);

            var controllerObject = new GameObject("Quest Demo Controller");
            QuestDemoController controller = controllerObject.AddComponent<QuestDemoController>();
            controller.Configure(participant, presenter, viewer, 2.5f);

            Directory.CreateDirectory(SceneDirectory);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(ScenePath, true),
                new EditorBuildSettingsScene("Assets/Align/Scenes/Person1Simulation.unity", true)
            };
            AssetDatabase.SaveAssets();

            Selection.activeGameObject = controllerObject;
            Debug.Log("Created staged QuestDemo. Look forward for Maya; A/X advances presentation state and B/Y resets neutral discovery.");
        }

        [MenuItem("Align/Preview/Toggle Quest Demo Match _F8")]
        private static void ToggleMatchPreview()
        {
            if (!EditorApplication.isPlaying)
            {
                Debug.LogWarning("Enter Play Mode before toggling the Quest demo match.");
                return;
            }

            QuestDemoController controller = Object.FindFirstObjectByType<QuestDemoController>();
            if (controller == null)
            {
                Debug.LogWarning("No QuestDemoController is active in the current scene.");
                return;
            }

            controller.ToggleMatchState();
        }

        private static Camera CreateXrOrigin()
        {
            var originObject = new GameObject("XR Origin");
            XROrigin origin = originObject.AddComponent<XROrigin>();
            origin.Origin = originObject;
            origin.RequestedTrackingOriginMode = XROrigin.TrackingOriginMode.Floor;

            var offsetObject = new GameObject("Camera Offset");
            offsetObject.transform.SetParent(originObject.transform, false);
            origin.CameraFloorOffsetObject = offsetObject;
            origin.CameraYOffset = 0f;

            var cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.SetParent(offsetObject.transform, false);
            cameraObject.transform.localPosition = new Vector3(0f, 1.65f, 0f);

            Camera camera = cameraObject.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0f, 0f, 0f, 0f);
            camera.nearClipPlane = 0.05f;
            camera.farClipPlane = 50f;
            camera.allowHDR = false;
            camera.stereoTargetEye = StereoTargetEyeMask.Both;
            cameraObject.AddComponent<AudioListener>();
            cameraObject.AddComponent<ARCameraManager>();
            cameraObject.AddComponent<QuestTrackedCameraDriver>();

            origin.Camera = camera;
            return camera;
        }

        public static (RemoteParticipantView, RemoteProfileCardPresenter) CreateRemoteParticipant(
            Camera viewer,
            ProfileCardData profile,
            string objectName = "Remote Participant",
            bool stagedReady = false)
        {
            var remoteRoot = new GameObject(objectName);
            RemoteParticipantView participant = remoteRoot.AddComponent<RemoteParticipantView>();

            GameObject card = CreateProfileCard(remoteRoot.transform, viewer, profile);
            participant.Configure(remoteRoot.transform, card.transform, 0.28f);
            participant.SetSessionState(stagedReady, stagedReady, stagedReady);

            RemoteProfileCardPresenter presenter = card.GetComponent<RemoteProfileCardPresenter>();
            RemoteParticipantPresentationWiring.EnsureVisibility(participant, viewer, card);
            return (participant, presenter);
        }

        private static GameObject CreateProfileCard(
            Transform parent,
            Camera viewer,
            ProfileCardData profile)
        {
            var card = new GameObject("Profile Card", typeof(RectTransform));
            card.transform.SetParent(parent, false);

            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.sizeDelta = new Vector2(660f, 170f);
            cardRect.localScale = Vector3.one * 0.00145f;

            Canvas canvas = card.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            card.AddComponent<CanvasScaler>().dynamicPixelsPerUnit = 12f;

            Image panel = card.AddComponent<Image>();
            panel.color = new Color(0.08f, 0.1f, 0.14f, 0.94f);

            TMP_Text name = CreateText(card.transform, "Name", 42f, new Vector2(32f, -20f), new Vector2(596f, 56f));
            TMP_Text matchReason = CreateText(card.transform, "Match reason", 19f, new Vector2(32f, -84f), new Vector2(596f, 62f));

            RemoteProfileCardPresenter presenter = card.AddComponent<RemoteProfileCardPresenter>();
            presenter.Configure(name, null, null, null, matchReason, panel);
            presenter.Bind(profile);
            presenter.SetMatchState(false, string.Empty);

            YawBillboard billboard = card.AddComponent<YawBillboard>();
            billboard.Configure(viewer != null ? viewer.transform : null);
            return card;
        }

        private static ProfileCardData DemoMayaProfile() => new()
        {
            UserId = "maya",
            Name = "Maya Chen"
        };

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
            text.color = new Color(0.95f, 0.97f, 1f);
            text.alignment = TextAlignmentOptions.TopLeft;
            text.overflowMode = TextOverflowModes.Ellipsis;
            text.richText = false;
            return text;
        }
    }
}
