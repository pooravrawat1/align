using Align.Profiles;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Align.Presentation
{
    public sealed class RemoteProfileCardPresenter : MonoBehaviour
    {
        [SerializeField] private TMP_Text nameText;
        [SerializeField] private TMP_Text bioText;
        [SerializeField] private TMP_Text interestsText;
        [SerializeField] private TMP_Text socialText;
        [SerializeField] private TMP_Text matchReasonText;
        [SerializeField] private TMP_Text brandText;
        [SerializeField] private Graphic panel;
        [SerializeField] private Graphic nameGlass;
        [SerializeField] private Graphic matchGlass;
        [SerializeField] private RoundedGlassPanel glassSurface;

        private const float Width = 560f;
        private const float Padding = 36f;
        private const float ContentWidth = Width - Padding * 2f;
        private static readonly Color Ink = new(0.035f, 0.045f, 0.045f, 1f);
        private static readonly Color NeutralGlass = new(0.89f, 0.93f, 0.93f, 0.94f);
        private static readonly Color MatchGlass = new(0.66f, 0.94f, 0.76f, 0.94f);
        private static readonly Color TransparentPanel = new(0f, 0f, 0f, 0f);

        private bool _isMatched;
        private string _matchReason = string.Empty;

        public RemotePresentationState PresentationState { get; private set; }
        private bool CanPresentMatch => _isMatched && !string.IsNullOrWhiteSpace(_matchReason);

        public void Configure(
            TMP_Text profileName,
            TMP_Text profileBio,
            TMP_Text profileInterests,
            TMP_Text profileSocial,
            TMP_Text matchReason,
            Graphic background,
            TMP_Text profileBrand = null)
        {
            nameText = profileName;
            bioText = profileBio;
            interestsText = profileInterests;
            socialText = profileSocial;
            matchReasonText = matchReason;
            brandText = profileBrand;
            panel = background;
            EnsureSurface();
            DisableRichText();
            ApplyPresentation();
        }

        public void Bind(ProfileCardData profile)
        {
            if (profile == null)
            {
                return;
            }

            SetText(nameText, profile.Name?.Trim().ToLowerInvariant());
            // Match inputs and contact data are never attendee-facing headset content.
            SetText(bioText, string.Empty);
            SetText(interestsText, string.Empty);
            SetText(socialText, string.Empty);
            ApplyPresentation();
        }

        public void SetMatchState(bool isMatched, string reason)
        {
            _isMatched = isMatched;
            _matchReason = isMatched
                ? RemotePresentationStatePolicy.LimitReason(reason)
                : string.Empty;
            if (PresentationState != RemotePresentationState.Conversation)
            {
                PresentationState = RemotePresentationStatePolicy.DiscoveryState(CanPresentMatch);
            }
            ApplyPresentation();
        }

        public void SetConversationState(bool isInConversation)
        {
            PresentationState = isInConversation
                ? RemotePresentationState.Conversation
                : RemotePresentationStatePolicy.DiscoveryState(CanPresentMatch);
            ApplyPresentation();
        }

        private void Awake()
        {
            PresentationState = RemotePresentationState.DiscoveryNeutral;
            EnsureSurface();
            DisableRichText();
            ApplyPresentation();
        }

        private void OnEnable()
        {
            // Room snapshots can arrive while the card is hidden. Snap to the
            // latest synchronized state before the card is rendered again.
            ApplyPresentation();
        }

        private void OnValidate()
        {
            EnsureSurface();
            DisableRichText();
            ApplyPresentation();
        }

        private void EnsureSurface()
        {
            if (glassSurface == null)
            {
                glassSurface = GetComponentInChildren<RoundedGlassPanel>(true);
            }
            if (glassSurface == null)
            {
                var surface = new GameObject("Profile Glass", typeof(RectTransform));
                surface.transform.SetParent(transform, false);
                glassSurface = surface.AddComponent<RoundedGlassPanel>();
            }
            glassSurface.raycastTarget = false;
            glassSurface.transform.SetAsFirstSibling();
        }

        private void DisableRichText()
        {
            if (nameText != null) nameText.richText = false;
            if (bioText != null) bioText.richText = false;
            if (interestsText != null) interestsText.richText = false;
            if (socialText != null) socialText.richText = false;
            if (matchReasonText != null) matchReasonText.richText = false;
            if (brandText != null) brandText.richText = false;
        }

        private void ApplyPresentation()
        {
            if (glassSurface == null)
            {
                return;
            }

            bool showMatch = PresentationState == RemotePresentationState.DiscoveryMatched && CanPresentMatch;

            // The legacy Image remains serialized in existing scenes, but the
            // rounded mesh owns the visible surface. Its color still mirrors
            // match state for editor tooling and tests.
            if (panel != null)
            {
                panel.enabled = false;
                panel.color = showMatch ? MatchGlass : TransparentPanel;
            }
            SetActive(nameGlass, false);
            SetActive(matchGlass, false);
            SetActive(bioText, false);
            SetActive(interestsText, false);
            SetActive(socialText, false);
            SetActive(brandText, false);

            if (nameText != null)
            {
                SetActive(nameText, true);
                StyleText(nameText, 46f, FontStyles.Bold);
                nameText.enableAutoSizing = true;
                nameText.fontSizeMin = 34f;
                nameText.fontSizeMax = 46f;
                nameText.textWrappingMode = TextWrappingModes.NoWrap;
                Layout(nameText.rectTransform, new Vector2(Padding, -32f), new Vector2(ContentWidth, 64f));
            }

            float reasonHeight = 0f;
            if (matchReasonText != null)
            {
                SetText(matchReasonText, showMatch ? _matchReason : string.Empty);
                StyleText(matchReasonText, 27f, FontStyles.Normal);
                matchReasonText.textWrappingMode = TextWrappingModes.Normal;
                reasonHeight = showMatch
                    ? Mathf.Max(40f, matchReasonText.GetPreferredValues(_matchReason, ContentWidth, Mathf.Infinity).y)
                    : 0f;
                Layout(matchReasonText.rectTransform, new Vector2(Padding, -102f),
                    new Vector2(ContentWidth, reasonHeight));
                SetActive(matchReasonText, showMatch);
            }

            float height = showMatch ? 134f + reasonHeight : 112f;
            if (transform is RectTransform card)
            {
                card.pivot = new Vector2(0.5f, 1f);
                card.sizeDelta = new Vector2(Width, height);
                card.localScale = Vector3.one * 0.00115f;
            }

            RectTransform surfaceRect = glassSurface.rectTransform;
            surfaceRect.anchorMin = Vector2.zero;
            surfaceRect.anchorMax = Vector2.one;
            surfaceRect.offsetMin = Vector2.zero;
            surfaceRect.offsetMax = Vector2.zero;
            glassSurface.color = showMatch ? MatchGlass : NeutralGlass;
        }

        private static void StyleText(TMP_Text text, float size, FontStyles style)
        {
            text.richText = false;
            text.raycastTarget = false;
            text.fontSize = size;
            text.fontStyle = style;
            text.color = Ink;
            text.alignment = TextAlignmentOptions.TopLeft;
            text.characterSpacing = 0f;
            text.outlineWidth = 0f;
            text.outlineColor = Color.clear;
            text.overflowMode = TextOverflowModes.Ellipsis;
        }

        private static void Layout(RectTransform rect, Vector2 position, Vector2 size)
        {
            rect.anchorMin = rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
        }

        private static void SetText(TMP_Text target, string value)
        {
            if (target != null)
            {
                target.text = value ?? string.Empty;
            }
        }

        private static void SetActive(Graphic graphic, bool active)
        {
            if (graphic != null && graphic.gameObject.activeSelf != active)
            {
                graphic.gameObject.SetActive(active);
            }
        }
    }
}
