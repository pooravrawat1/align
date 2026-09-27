using System.IO;
using Align.Presentation;
using Align.Profiles;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Align.Editor
{
    public static class ProfileCardPreview
    {
        // Renders the actual Unity UI, including its transparent mesh and TMP text.
        [MenuItem("Align/Preview/Render Glass Cards")]
        public static void Render()
        {
            QuestDemoSceneFactory.CreateScene();
            Camera generatedViewer = Camera.main;
            RemoteProfileCardPresenter generatedCard =
                Object.FindFirstObjectByType<RemoteProfileCardPresenter>();
            if (generatedCard.transform.parent != generatedViewer.transform ||
                generatedCard.GetComponent<YawBillboard>() != null)
                throw new System.InvalidOperationException("Quest card must stay in viewer space.");
            var visibility = new SerializedObject(Object.FindFirstObjectByType<RemoteCardVisibility>());
            if (!visibility.FindProperty("fixedInViewerSpace").boolValue)
                throw new System.InvalidOperationException("Quest card must use viewer-panel visibility.");

            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var cameraObject = new GameObject("Preview Camera");
            Camera camera = cameraObject.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.fieldOfView = 46f;
            camera.nearClipPlane = 0.05f;
            camera.farClipPlane = 5f;
            camera.stereoTargetEye = StereoTargetEyeMask.None;

            GameObject card = QuestDemoSceneFactory.CreateProfileCard(camera.transform, camera.transform);
            card.transform.localPosition = new Vector3(0f, 0.08f, 1.35f);
            RemoteProfileCardPresenter presenter = card.GetComponent<RemoteProfileCardPresenter>();
            presenter.Bind(DemoProfileCatalog.Get("maya"));

            string output = Path.Combine(Path.GetTempPath(), "catalyst-glass-preview");
            Directory.CreateDirectory(output);
            var target = new RenderTexture(1400, 900, 24, RenderTextureFormat.ARGB32);
            target.antiAliasing = 4;
            camera.targetTexture = target;
            try
            {
                for (int state = 0; state < 2; state++)
                {
                    bool matched = state == 1;
                    presenter.SetMatchState(matched,
                        "You both build assistive technology. Ask Maya about her latest computer vision project.");
                    foreach (TMP_Text text in card.GetComponentsInChildren<TMP_Text>())
                        text.ForceMeshUpdate();
                    Canvas.ForceUpdateCanvases();

                    foreach (bool light in new[] { false, true })
                    {
                        camera.backgroundColor = light
                            ? new Color(0.83f, 0.8f, 0.73f)
                            : new Color(0.09f, 0.13f, 0.14f);
                        camera.Render();
                        RenderTexture previous = RenderTexture.active;
                        RenderTexture.active = target;
                        var capture = new Texture2D(target.width, target.height, TextureFormat.RGB24, false);
                        capture.ReadPixels(new Rect(0, 0, target.width, target.height), 0, 0);
                        capture.Apply();
                        File.WriteAllBytes(Path.Combine(output,
                            (matched ? "match" : "name") + (light ? "-light.png" : "-dark.png")),
                            capture.EncodeToPNG());
                        Object.DestroyImmediate(capture);
                        RenderTexture.active = previous;
                    }
                }
                Debug.Log("[Align Preview] Rendered glass cards to " + output);
            }
            finally
            {
                camera.targetTexture = null;
                target.Release();
                Object.DestroyImmediate(target);
            }
        }
    }
}
