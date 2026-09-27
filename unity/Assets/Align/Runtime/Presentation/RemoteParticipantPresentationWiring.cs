using UnityEngine;

namespace Align.Presentation
{
    public static class RemoteParticipantPresentationWiring
    {
        public static RemoteCardVisibility EnsureVisibility(
            RemoteParticipantView participant,
            Camera viewerCamera,
            GameObject cardRoot)
        {
            if (participant == null || cardRoot == null)
            {
                return null;
            }

            RemoteCardVisibility visibility = participant.GetComponent<RemoteCardVisibility>();
            if (visibility == null)
            {
                visibility = participant.gameObject.AddComponent<RemoteCardVisibility>();
            }

            visibility.Configure(participant, viewerCamera, cardRoot);
            return visibility;
        }
    }
}
