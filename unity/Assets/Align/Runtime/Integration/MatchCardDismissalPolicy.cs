namespace Align.Integration
{
    public enum NarrationPlaybackState
    {
        Idle,
        Loading,
        Speaking,
        Completed,
        Failed
    }

    public static class MatchCardDismissalPolicy
    {
        public static bool CanDismiss(bool hasMatchIntroduction, bool narrationEnabled, NarrationPlaybackState playback)
        {
            if (!hasMatchIntroduction) return false;
            // A failed/disabled optional voice must not trap a finished visual card.
            return !narrationEnabled || playback == NarrationPlaybackState.Completed ||
                playback == NarrationPlaybackState.Failed;
        }
    }
}
