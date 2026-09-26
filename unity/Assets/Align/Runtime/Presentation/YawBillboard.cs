using UnityEngine;

namespace Align.Presentation
{
    /// <summary>
    /// Rotates a world-space card around the vertical axis so it faces the viewer.
    /// </summary>
    public sealed class YawBillboard : MonoBehaviour
    {
        [SerializeField] private Transform viewer;
        [SerializeField] private bool invertForward;

        public void Configure(Transform viewerTransform)
        {
            viewer = viewerTransform;
        }

        private void LateUpdate()
        {
            if (viewer == null)
            {
                Camera mainCamera = Camera.main;
                if (mainCamera == null)
                {
                    return;
                }

                viewer = mainCamera.transform;
            }

            Vector3 direction = transform.position - viewer.position;
            direction.y = 0f;
            if (direction.sqrMagnitude < 0.0001f)
            {
                return;
            }

            if (invertForward)
            {
                direction = -direction;
            }

            transform.rotation = Quaternion.LookRotation(direction.normalized, Vector3.up);
        }
    }
}
