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
        [SerializeField] private Color discoveryTransparentColor = new(0.12f, 0.13f, 0.15f, 0f);
        [SerializeField] private Color positiveMatchColor = new(0.24f, 0.55f, 0.34f, 0.78f);
        [SerializeField, Min(0.01f)] private float transitionSeconds = 0.2f;
        [Header("Player nameplate")]
        [SerializeField] private Color readableNeutralNameColor = Color.white;
        [SerializeField] private Color matchedNameColor = new(0.31f, 1f, 0.47f, 1f);
        [SerializeField] private Color nameOutlineColor = new(0f, 0f, 0f, 0.9f);
        [SerializeField, Range(0f, 0.5f)] private float nameOutlineWidth = 0.16f;

        private bool _isMatched;
        private string _matchReason = string.Empty;
        private Color _targetPanelColor;

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
            ResolveBrandText();
            DisableRichText();
            ApplyCompactLayout();
            ApplyNameplateStyle();
            ApplyPresentation(immediate: true);
        }

        public void Bind(ProfileCardData profile)
        {
            if (profile == null)
            {
                return;
            }

            SetText(nameText, profile.Name?.Trim().ToLowerInvariant());
            // Match inputs and contact data are not attendee-facing headset content.
            SetText(bioText, string.Empty);
            SetText(interestsText, string.Empty);
            SetText(socialText, string.Empty);
        }

        public void SetMatchState(bool isMatched, string reason)
        {
            _isMatched = isMatched;
            _matchReason = RemotePresentationStatePolicy.LimitReason(reason);
            if (PresentationState != RemotePresentationState.Conversation)
            {
                PresentationState = RemotePresentationStatePolicy.DiscoveryState(CanPresentMatch);
            }
            ApplyPresentation(immediate: !isActiveAndEnabled);
        }

        public void SetConversationState(bool isInConversation)
        {
            PresentationState = isInConversation
                ? RemotePresentationState.Conversation
                : RemotePresentationStatePolicy.DiscoveryState(CanPresentMatch);
            ApplyPresentation(immediate: !isActiveAndEnabled);
        }

        private void Awake()
        {
            ResolveBrandText();
            DisableRichText();
            ApplyCompactLayout();
            ApplyNameplateStyle();
            PresentationState = RemotePresentationState.DiscoveryNeutral;
            SetMatchState(false, string.Empty);
        }

        private void OnValidate()
        {
            nameOutlineWidth = Mathf.Clamp(nameOutlineWidth, 0f, 0.5f);
            ResolveBrandText();
            ApplyNameplateStyle();
            ApplyPresentation(immediate: true);
        }

        private void OnEnable()
        {
            ApplyPresentation(immediate: true);
        }

        private void Update()
        {
            if (panel == null || panel.color == _targetPanelColor)
            {
                return;
            }

            float blend = 1f - Mathf.Exp(-Time.unscaledDeltaTime / Mathf.Max(0.01f, transitionSeconds));
            panel.color = Color.Lerp(panel.color, _targetPanelColor, blend);
            Color delta = panel.color - _targetPanelColor;
            float maximumDelta = Mathf.Max(
                Mathf.Abs(delta.r), Mathf.Abs(delta.g), Mathf.Abs(delta.b), Mathf.Abs(delta.a));
            if (maximumDelta < 0.005f)
            {
                panel.color = _targetPanelColor;
            }
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

        private void ResolveBrandText()
        {
            if (brandText == null)
            {
                Transform brand = transform.Find("Brand");
                if (brand != null)
                {
                    brandText = brand.GetComponent<TMP_Text>();
                }
            }
        }

        private void ApplyPresentation(bool immediate)
        {
            bool showMatch = PresentationState == RemotePresentationState.DiscoveryMatched && CanPresentMatch;
            _targetPanelColor = showMatch ? positiveMatchColor : discoveryTransparentColor;
            if (panel != null)
            {
                panel.enabled = true;
                if (immediate)
                {
                    panel.color = _targetPanelColor;
                }
            }

            SetActive(bioText, false);
            SetActive(interestsText, false);
            SetActive(socialText, false);
            SetText(matchReasonText, showMatch ? _matchReason : string.Empty);
            SetActive(matchReasonText, showMatch);

            SetActive(brandText, false);
            ApplyNameColor();
        }

        private void ApplyNameplateStyle()
        {
            if (nameText == null)
            {
                return;
            }

            // EAFC-style overhead labels are compact, centered, bold and kept
            // legible over a moving background with a strong dark edge.
            nameText.fontStyle = FontStyles.Bold;
            nameText.alignment = TextAlignmentOptions.Center;
            nameText.characterSpacing = 1.5f;
            nameText.outlineColor = nameOutlineColor;
            nameText.outlineWidth = nameOutlineWidth;
            nameText.text = nameText.text?.Trim().ToLowerInvariant() ?? string.Empty;
        }

        private void ApplyCompactLayout()
        {
            if (transform is RectTransform cardRect)
            {
                cardRect.sizeDelta = new Vector2(660f, 170f);
            }

            ConfigureTextRect(nameText, new Vector2(32f, -20f), new Vector2(596f, 56f));
            ConfigureTextRect(matchReasonText, new Vector2(32f, -84f), new Vector2(596f, 62f));
        }

        private static void ConfigureTextRect(TMP_Text text, Vector2 position, Vector2 size)
        {
            if (text != null && text.transform is RectTransform rect)
            {
                rect.anchoredPosition = position;
                rect.sizeDelta = size;
            }
        }

        private void ApplyNameColor()
        {
            if (nameText != null)
            {
                nameText.color = PresentationState == RemotePresentationState.DiscoveryMatched
                    ? matchedNameColor
                    : readableNeutralNameColor;
            }
        }

        private static void SetText(TMP_Text target, string value)
        {
            if (target != null)
            {
                target.text = value ?? string.Empty;
            }
        }

        private static void SetActive(TMP_Text target, bool active)
        {
            if (target != null && target.gameObject.activeSelf != active)
            {
                target.gameObject.SetActive(active);
            }
        }

    }
}
