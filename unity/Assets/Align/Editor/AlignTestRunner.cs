using UnityEditor;
using UnityEditor.TestTools.TestRunner.Api;
using UnityEngine;

namespace Align.Editor
{
    public static class AlignTestRunner
    {
        [MenuItem("Align/Tests/Run EditMode Tests")]
        public static void RunEditModeTests()
        {
            TestRunnerApi api = ScriptableObject.CreateInstance<TestRunnerApi>();
            api.RegisterCallbacks(new TestCallbacks());
            api.Execute(new ExecutionSettings(new Filter
            {
                testMode = TestMode.EditMode,
                assemblyNames = new[] { "Align.Tests.EditMode" }
            }));
        }

        private sealed class TestCallbacks : ICallbacks
        {
            private int _passed;
            private int _failed;

            public void RunStarted(ITestAdaptor testsToRun)
            {
                Debug.Log($"[Align Tests] Starting {testsToRun.TestCaseCount} EditMode tests.");
            }

            public void RunFinished(ITestResultAdaptor result)
            {
                Debug.Log(
                    $"[Align Tests] Finished status={result.TestStatus} " +
                    $"passed={_passed} failed={_failed}.");
            }

            public void TestStarted(ITestAdaptor test)
            {
            }

            public void TestFinished(ITestResultAdaptor result)
            {
                if (result.HasChildren)
                {
                    return;
                }
                if (result.TestStatus == TestStatus.Passed)
                {
                    _passed += 1;
                }
                else if (result.TestStatus == TestStatus.Failed)
                {
                    _failed += 1;
                    Debug.LogError($"[Align Tests] {result.FullName}: {result.Message}");
                }
            }
        }
    }
}
