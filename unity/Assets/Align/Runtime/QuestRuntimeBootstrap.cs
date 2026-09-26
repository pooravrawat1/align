using UnityEngine;

namespace Align.Quest
{
    /// <summary>Small Quest defaults that are safe for the hackathon build.</summary>
    [DefaultExecutionOrder(-300)]
    public sealed class QuestRuntimeBootstrap : MonoBehaviour
    {
        private void Awake()
        {
            Application.targetFrameRate = 72;
            QualitySettings.vSyncCount = 0;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
        }
    }
}
