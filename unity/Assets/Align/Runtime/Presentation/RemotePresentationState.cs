namespace Align.Presentation
{
    public enum RemotePresentationState
    {
        DiscoveryNeutral,
        DiscoveryMatched,
        Conversation
    }

    public static class RemotePresentationStatePolicy
    {
        public const int MaximumReasonWords = 30;

        public static RemotePresentationState DiscoveryState(bool isMatched) =>
            isMatched ? RemotePresentationState.DiscoveryMatched : RemotePresentationState.DiscoveryNeutral;

        public static string LimitReason(string reason)
        {
            if (string.IsNullOrWhiteSpace(reason))
            {
                return string.Empty;
            }

            string[] words = reason.Split((char[])null, System.StringSplitOptions.RemoveEmptyEntries);
            if (words.Length <= MaximumReasonWords)
            {
                return string.Join(" ", words);
            }

            return string.Join(" ", words, 0, MaximumReasonWords) + "…";
        }
    }
}
