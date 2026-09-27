using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using Align.Integration;
using Align.Networking;
using Align.Pose;
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
                CreateLiveParticipant(viewer);

            QuestHeadPoseProvider poseProvider = viewer.gameObject.AddComponent<QuestHeadPoseProvider>();
            var transportObject = new GameObject("HTTP Room Transport");
            HttpRoomTransport transport = transportObject.AddComponent<HttpRoomTransport>();
            transport.Configure(ResolveMatcherUrl(), "DEMO");

            var controllerObject = new GameObject("Two Headset Demo Controller");
            TwoHeadsetDemoController controller =
                controllerObject.AddComponent<TwoHeadsetDemoController>();
            controller.Configure(poseProvider, transport, participant, presenter);

            Directory.CreateDirectory(SceneDirectory);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(ScenePath, true),
                new EditorBuildSettingsScene("Assets/Align/Scenes/Person1Simulation.unity", true)
            };
            AssetDatabase.SaveAssets();

            Selection.activeGameObject = controllerObject;
            Debug.Log(
                $"Created two-headset QuestDemo. Matcher={ResolveMatcherUrl()}. " +
                "A/X calibrates once; a later A/X press reveals the introduction for both. After speech, A/X hides/shows your card. B/Y switches Maya/Sam; Menu resets the room.");
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

        private static (RemoteParticipantView, RemoteProfileCardPresenter) CreateLiveParticipant(Camera viewer)
        {
            var remoteRoot = new GameObject("Remote Participant");
            RemoteParticipantView participant = remoteRoot.AddComponent<RemoteParticipantView>();

            GameObject card = CreateProfileCard(viewer.transform, viewer.transform, DemoMayaProfile());
            card.transform.localPosition = new Vector3(0f, -0.06f, 1.35f);
            // The peer still owns its network pose; the readable card follows the viewer.
            participant.Configure(remoteRoot.transform, null);
            participant.SetSessionState(false, false, false);
            RemoteCardVisibility visibility = remoteRoot.AddComponent<RemoteCardVisibility>();
            visibility.Configure(participant, viewer, card, viewerFixed: true);

            return (participant, card.GetComponent<RemoteProfileCardPresenter>());
        }

        public static (RemoteParticipantView, RemoteProfileCardPresenter) CreateRemoteParticipant(
            Camera viewer,
            ProfileCardData profile,
            string objectName = "Remote Participant",
            bool stagedReady = false)
        {
            var remoteRoot = new GameObject(objectName);
            RemoteParticipantView participant = remoteRoot.AddComponent<RemoteParticipantView>();

            Transform viewerTransform = viewer != null ? viewer.transform : null;
            GameObject card = CreateProfileCard(remoteRoot.transform, viewerTransform, profile);
            participant.Configure(remoteRoot.transform, card.transform, 0.28f);
            participant.SetSessionState(stagedReady, stagedReady, stagedReady);

            RemoteProfileCardPresenter presenter = card.GetComponent<RemoteProfileCardPresenter>();
            RemoteParticipantPresentationWiring.EnsureVisibility(participant, viewer, card);
            return (participant, presenter);
        }

        internal static GameObject CreateProfileCard(Transform parent, Transform viewer) =>
            CreateProfileCard(parent, viewer, DemoMayaProfile());

        private static GameObject CreateProfileCard(
            Transform parent,
            Transform viewer,
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

            TMP_Text name = CreateText(card.transform, "Name", 42f,
                new Vector2(32f, -20f), new Vector2(596f, 56f));
            TMP_Text matchReason = CreateText(card.transform, "Match reason", 19f,
                new Vector2(32f, -84f), new Vector2(596f, 62f));

            RemoteProfileCardPresenter presenter = card.AddComponent<RemoteProfileCardPresenter>();
            presenter.Configure(name, null, null, null, matchReason, panel);
            presenter.Bind(profile);
            presenter.SetMatchState(false, string.Empty);

            if (viewer != null && parent != viewer)
            {
                YawBillboard billboard = card.AddComponent<YawBillboard>();
                billboard.Configure(viewer);
            }
            return card;
        }

        private static ProfileCardData DemoMayaProfile() => new()
        {
            UserId = "maya",
            Name = "Maya Chen"
        };

        private static string ResolveMatcherUrl()
        {
            string configured = System.Environment.GetEnvironmentVariable("ALIGN_MATCHER_URL");
            if (!string.IsNullOrWhiteSpace(configured))
            {
                return configured.Trim().TrimEnd('/');
            }

            IPAddress address = Dns.GetHostEntry(Dns.GetHostName()).AddressList
                .FirstOrDefault(candidate =>
                    candidate.AddressFamily == AddressFamily.InterNetwork &&
                    !IPAddress.IsLoopback(candidate));
            return address == null
                ? "http://192.168.1.2:4323"
                : $"http://{address}:4323";
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
            text.color = new Color(0.95f, 0.97f, 1f);
            text.alignment = TextAlignmentOptions.TopLeft;
            text.overflowMode = TextOverflowModes.Ellipsis;
            text.richText = false;
            return text;
        }
    }
}
