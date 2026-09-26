using Align.Pose;
using Align.Presentation;
using UnityEngine;

namespace Align.Simulation
{
    /// <summary>
    /// Development-only bridge that mimics delivery of a network pose. Replace
    /// this component with the Photon adapter when Person 2 networking begins.
    /// </summary>
    public sealed class PoseLoopbackDriver : MonoBehaviour
    {
        [SerializeField] private MonoBehaviour sourceBehaviour;
        [SerializeField] private RemoteParticipantView target;

        private IHeadPoseProvider _source;

        public void Configure(MonoBehaviour provider, RemoteParticipantView remoteTarget)
        {
            sourceBehaviour = provider;
            target = remoteTarget;
            _source = provider as IHeadPoseProvider;
        }

        private void Awake()
        {
            _source = sourceBehaviour as IHeadPoseProvider;
            if (sourceBehaviour != null && _source == null)
            {
                Debug.LogError(
                    $"{sourceBehaviour.GetType().Name} does not implement {nameof(IHeadPoseProvider)}.",
                    this);
            }
        }

        private void Update()
        {
            if (_source != null && target != null)
            {
                target.ApplyPose(_source.CurrentPose);
            }
        }
    }
}
