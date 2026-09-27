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
                CreateDemoParticipant(viewer);

            QuestHeadPoseProvider poseProvider = viewer.gameObject.AddComponent<QuestHeadPoseProvider>();
            var transportObject = new GameObject("HTTP Room Transport");
            HttpRoomTransport transport = transportObject.AddComponent<HttpRoomTransport>();
            transport.Configure(ResolveMatcherUrl(), "DEMO");

            var controllerObject = new GameObject("Two Headset Demo Controller");
            TwoHeadsetDemoController controller =
                controllerObject.AddComponent<TwoHeadsetDemoController>();
            controller.Configure(
                poseProvider,
                transport,
                participant,
                presenter);

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
                "A/X calibrates once, then hides/shows the card; B/Y switches Maya/Sam; Menu resets the room.");
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

        private static (RemoteParticipantView, RemoteProfileCardPresenter) CreateDemoParticipant(Camera viewer)
        {
            var remoteRoot = new GameObject("Remote Participant");
            RemoteParticipantView participant = remoteRoot.AddComponent<RemoteParticipantView>();

            GameObject card = CreateProfileCard(viewer.transform, viewer.transform);
            card.transform.localPosition = new Vector3(0f, -0.06f, 1.35f);
            // The peer still owns its network pose; the readable card follows the viewer.
            participant.Configure(remoteRoot.transform, null);
            participant.SetSessionState(false, false, false);
            RemoteCardVisibility visibility = remoteRoot.AddComponent<RemoteCardVisibility>();
            visibility.Configure(participant, viewer, card, viewerFixed: true);

            RemoteProfileCardPresenter presenter = card.GetComponent<RemoteProfileCardPresenter>();
            return (participant, presenter);
        }

        internal static GameObject CreateProfileCard(Transform parent, Transform viewer)
        {
            var card = new GameObject("Profile Card", typeof(RectTransform));
            card.transform.SetParent(parent, false);

            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.sizeDelta = new Vector2(660f, 380f);
            cardRect.localScale = Vector3.one * 0.00145f;

            Canvas canvas = card.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            card.AddComponent<CanvasScaler>().dynamicPixelsPerUnit = 12f;

            Image panel = card.AddComponent<Image>();
            panel.color = new Color(0.08f, 0.1f, 0.14f, 0.94f);

            TMP_Text brand = CreateText(card.transform, "Brand", 18f, new Vector2(32f, -22f), new Vector2(596f, 30f));
            brand.text = "ALIGN  ·  DEMO PROFILE";
            brand.color = new Color(0.45f, 0.84f, 1f);

            TMP_Text name = CreateText(card.transform, "Name", 42f, new Vector2(32f, -58f), new Vector2(596f, 62f));
            TMP_Text bio = CreateText(card.transform, "Bio", 23f, new Vector2(32f, -126f), new Vector2(596f, 92f));
            TMP_Text interests = CreateText(card.transform, "Interests", 20f, new Vector2(32f, -224f), new Vector2(596f, 40f));
            TMP_Text social = CreateText(card.transform, "Social", 18f, new Vector2(32f, -270f), new Vector2(596f, 36f));
            TMP_Text matchReason = CreateText(card.transform, "Match reason", 19f, new Vector2(32f, -314f), new Vector2(596f, 50f));

            RemoteProfileCardPresenter presenter = card.AddComponent<RemoteProfileCardPresenter>();
            presenter.Configure(name, bio, interests, social, matchReason, panel, brand);
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

            return card;
        }

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
