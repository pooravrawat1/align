using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Align.Editor
{
    public static class QuestBuild
    {
        private const string OutputDirectory = "Builds/Quest";
        private const string OutputPath = OutputDirectory + "/Align.apk";

        [MenuItem("Align/Build/Build Quest APK")]
        public static void BuildApk()
        {
            QuestProjectConfigurator.Configure();
            // QuestDemo is generated code. Recreate it on every build so scene
            // fixes cannot be omitted by a stale checked-in .unity file.
            QuestDemoSceneFactory.CreateScene();

            Directory.CreateDirectory(OutputDirectory);
            if (!EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android))
            {
                throw new BuildFailedException("Unity could not switch the active platform to Android.");
            }

            var options = new BuildPlayerOptions
            {
                scenes = new[] { QuestDemoSceneFactory.ScenePath },
                locationPathName = OutputPath,
                target = BuildTarget.Android,
                options = BuildOptions.Development
            };

            BuildReport report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != BuildResult.Succeeded || !File.Exists(OutputPath))
            {
                throw new BuildFailedException(
                    $"Quest APK build did not produce {OutputPath}. " +
                    $"Unity reported {report.summary.result} with {report.summary.totalErrors} errors. " +
                    "See the Console for details.");
            }

            Debug.Log($"Built Align Quest APK: {Path.GetFullPath(OutputPath)}");
        }
    }
}
