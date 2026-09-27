using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEditor.XR.OpenXR.Features;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.XR.Management;
using UnityEngine.XR.OpenXR.Features;

namespace Align.Editor
{
    public static class QuestProjectConfigurator
    {
        private const string OpenXrLoaderType = "UnityEngine.XR.OpenXR.OpenXRLoader";
        private const string XrGeneralSettingsPath =
            "Assets/XR/Settings/XRGeneralSettingsPerBuildTarget.asset";
        private const string MetaQuestFeatureId = "com.unity.openxr.feature.metaquest";
        private const string PassthroughFeatureId = "com.unity.openxr.feature.arfoundation-meta-camera";
        private const string MetaSessionFeatureId = "com.unity.openxr.feature.arfoundation-meta-session";
        private const string CompositionLayersFeatureId = "com.unity.openxr.feature.compositionlayers";
        private const string TouchControllerFeatureId = "com.unity.openxr.feature.input.oculustouch";

        [MenuItem("Align/Setup/Configure Quest Project")]
        public static void Configure()
        {
            if (EditorApplication.isPlaying)
            {
                Debug.LogWarning("Exit Play Mode before configuring the Quest project.");
                return;
            }

            ConfigurePlayerSettings();
            EnsureOpenXrLoader();
            EnableRequiredOpenXrFeatures();
            AssetDatabase.SaveAssets();
            Debug.Log("Align Quest configuration complete: Android/OpenXR, Quest support, passthrough, and Touch controllers are enabled.");
        }

        private static void ConfigurePlayerSettings()
        {
            PlayerSettings.companyName = "Align";
            PlayerSettings.productName = "Align";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.align.hackathon");
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel32;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.MTRendering = true;
            // The private demo LAN relay intentionally uses plain HTTP. Never
            // expose the unauthenticated room endpoint on a public network.
            PlayerSettings.insecureHttpOption = InsecureHttpOption.AlwaysAllowed;
            SetInputSystemOnly();

            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(
                BuildTarget.Android,
                new[] { GraphicsDeviceType.Vulkan, GraphicsDeviceType.OpenGLES3 });
        }

        private static void SetInputSystemOnly()
        {
            UnityEngine.Object[] projectSettingsAssets =
                AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset");
            if (projectSettingsAssets.Length == 0)
            {
                throw new InvalidOperationException("Unity PlayerSettings asset could not be loaded.");
            }

            var serializedSettings = new SerializedObject(projectSettingsAssets[0]);
            SerializedProperty inputHandler = serializedSettings.FindProperty("activeInputHandler");
            if (inputHandler == null)
            {
                throw new InvalidOperationException("Unity activeInputHandler setting could not be found.");
            }

            // 0 = legacy, 1 = Input System, 2 = both. Android rejects Both.
            inputHandler.intValue = 1;
            serializedSettings.ApplyModifiedPropertiesWithoutUndo();
        }

        private static void EnsureOpenXrLoader()
        {
            XRGeneralSettingsPerBuildTarget perBuildTarget = FindPerBuildTargetSettings();
            if (!perBuildTarget.HasManagerSettingsForBuildTarget(BuildTargetGroup.Android))
            {
                perBuildTarget.CreateDefaultManagerSettingsForBuildTarget(BuildTargetGroup.Android);
            }

            XRManagerSettings manager = perBuildTarget.ManagerSettingsForBuildTarget(BuildTargetGroup.Android);
            manager.automaticLoading = true;
            manager.automaticRunning = true;
            if (!XRPackageMetadataStore.AssignLoader(manager, OpenXrLoaderType, BuildTargetGroup.Android))
            {
                throw new InvalidOperationException("Unity could not assign the OpenXR loader for Android.");
            }

            EditorUtility.SetDirty(perBuildTarget);
            EditorUtility.SetDirty(manager);
        }

        private static XRGeneralSettingsPerBuildTarget FindPerBuildTargetSettings()
        {
            if (EditorBuildSettings.TryGetConfigObject(
                XRGeneralSettings.k_SettingsKey,
                out XRGeneralSettingsPerBuildTarget settings) && settings != null)
            {
                return settings;
            }

            string guid = AssetDatabase.FindAssets("t:XRGeneralSettingsPerBuildTarget").FirstOrDefault();
            if (string.IsNullOrEmpty(guid))
            {
                Directory.CreateDirectory("Assets/XR/Settings");
                settings = ScriptableObject.CreateInstance<XRGeneralSettingsPerBuildTarget>();
                settings.name = "XRGeneralSettingsPerBuildTarget";
                AssetDatabase.CreateAsset(settings, XrGeneralSettingsPath);
                EditorBuildSettings.AddConfigObject(XRGeneralSettings.k_SettingsKey, settings, true);
                AssetDatabase.SaveAssets();
                return settings;
            }

            string path = AssetDatabase.GUIDToAssetPath(guid);
            settings = AssetDatabase.LoadAssetAtPath<XRGeneralSettingsPerBuildTarget>(path);
            EditorBuildSettings.AddConfigObject(XRGeneralSettings.k_SettingsKey, settings, true);
            return settings;
        }

        private static void EnableRequiredOpenXrFeatures()
        {
            FeatureHelpers.RefreshFeatures(BuildTargetGroup.Android);
            OpenXRFeature metaQuestFeature = EnableFeature(
                BuildTargetGroup.Android,
                MetaQuestFeatureId,
                "Meta Quest Support");
            ConfigureQuest2Only(metaQuestFeature);
            EnableFeature(BuildTargetGroup.Android, MetaSessionFeatureId, "Meta Quest: Session");
            EnableFeature(BuildTargetGroup.Android, PassthroughFeatureId, "Meta Quest Camera (Passthrough)");
            EnableFeature(BuildTargetGroup.Android, CompositionLayersFeatureId, "Composition Layers Support");
            EnableFeature(BuildTargetGroup.Android, TouchControllerFeatureId, "Oculus Touch Controller Profile");

            // Unity 6's classic build pipeline still validates a few generic
            // rules against selectedBuildTargetGroup (often Standalone) even
            // while Android is active. Keep those two generic features enabled
            // there as well so validation reflects the intended Quest setup.
            FeatureHelpers.RefreshFeatures(BuildTargetGroup.Standalone);
            EnableFeature(BuildTargetGroup.Standalone, CompositionLayersFeatureId, "Composition Layers Support");
            EnableFeature(BuildTargetGroup.Standalone, TouchControllerFeatureId, "Oculus Touch Controller Profile");
        }

        private static OpenXRFeature EnableFeature(
            BuildTargetGroup buildTargetGroup,
            string featureId,
            string displayName)
        {
            OpenXRFeature feature = FeatureHelpers.GetFeatureWithIdForBuildTarget(
                buildTargetGroup,
                featureId);
            if (feature == null)
            {
                throw new InvalidOperationException(
                    $"Required OpenXR feature was not found for {buildTargetGroup}: {displayName} ({featureId}).");
            }

            feature.enabled = true;
            EditorUtility.SetDirty(feature);
            return feature;
        }

        private static void ConfigureQuest2Only(OpenXRFeature metaQuestFeature)
        {
            var serializedFeature = new SerializedObject(metaQuestFeature);
            SerializedProperty targetDevices = serializedFeature.FindProperty("targetDevices");
            if (targetDevices == null || !targetDevices.isArray)
            {
                throw new InvalidOperationException(
                    "Meta Quest target-device settings could not be found. The OpenXR package may have changed.");
            }

            bool foundQuest2 = false;
            for (int i = 0; i < targetDevices.arraySize; i++)
            {
                SerializedProperty device = targetDevices.GetArrayElementAtIndex(i);
                SerializedProperty manifestName = device.FindPropertyRelative("manifestName");
                SerializedProperty enabled = device.FindPropertyRelative("enabled");
                if (manifestName == null || enabled == null)
                {
                    continue;
                }

                bool isQuest2 = manifestName.stringValue == "quest2";
                enabled.boolValue = isQuest2;
                foundQuest2 |= isQuest2;
            }

            if (!foundQuest2)
            {
                throw new InvalidOperationException(
                    "Meta Quest Support does not expose a Quest 2 target in this OpenXR package.");
            }

            serializedFeature.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(metaQuestFeature);
        }
    }
}
