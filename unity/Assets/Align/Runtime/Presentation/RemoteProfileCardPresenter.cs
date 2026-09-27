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

        private bool _isMatched;
        private string _reason = string.Empty;

        public void Configure(TMP_Text profileName, TMP_Text profileBio,
            TMP_Text profileInterests, TMP_Text profileSocial, TMP_Text matchReason,
            Graphic background, TMP_Text profileBrand = null)
        {
            nameText = profileName;
            bioText = profileBio;
            interestsText = profileInterests;
            socialText = profileSocial;
            matchReasonText = matchReason;
            brandText = profileBrand;
            panel = background;
            EnsureSurface();
            ApplyPresentation();
        }

        public void Bind(ProfileCardData profile)
        {
            if (profile == null) return;
            string name = profile.Name?.Trim() ?? string.Empty;
            int space = name.IndexOf(' ');
            if (nameText != null)
                nameText.text = space > 0 ? name.Substring(0, space) : name;
            ApplyPresentation();
        }

        public void SetMatchState(bool isMatched, string reason)
        {
            string nextReason = isMatched ? reason?.Trim() ?? string.Empty : string.Empty;
            if (_isMatched == isMatched && _reason == nextReason) return;
            _isMatched = isMatched;
            _reason = nextReason;
            ApplyPresentation();
        }

        private void Awake()
        {
            EnsureSurface();
            // Room snapshots can arrive while the card is hidden. Preserve that
            // result when the card becomes visible for the first time.
            ApplyPresentation();
        }

        private void EnsureSurface()
        {
            if (glassSurface == null)
                glassSurface = GetComponentInChildren<RoundedGlassPanel>(true);
            if (glassSurface == null)
            {
                var surface = new GameObject("Profile Glass", typeof(RectTransform));
                surface.transform.SetParent(transform, false);
                glassSurface = surface.AddComponent<RoundedGlassPanel>();
            }
            glassSurface.raycastTarget = false;
            glassSurface.transform.SetAsFirstSibling();

            if (brandText == null)
            {
                Transform existing = transform.Find("Brand");
                brandText = existing != null ? existing.GetComponent<TMP_Text>() : null;
            }
            if (brandText == null)
            {
                var label = new GameObject("Brand", typeof(RectTransform));
                label.transform.SetParent(transform, false);
                brandText = label.AddComponent<TextMeshProUGUI>();
                if (nameText != null) brandText.font = nameText.font;
            }
        }

        private void ApplyPresentation()
        {
            if (nameText == null || glassSurface == null) return;

            if (panel != null) panel.enabled = false;
            SetActive(nameGlass, false);
            SetActive(matchGlass, false);
            SetActive(bioText, false);
            SetActive(interestsText, false);
            SetActive(socialText, false);

            bool showReason = _isMatched && !string.IsNullOrWhiteSpace(_reason);
            StyleText(nameText, 46f, FontStyles.Bold);
            nameText.enableAutoSizing = true;
            nameText.fontSizeMin = 34f;
            nameText.fontSizeMax = 46f;
            nameText.textWrappingMode = TextWrappingModes.NoWrap;
            Layout(nameText.rectTransform, new Vector2(Padding, -52f), new Vector2(ContentWidth, 64f));

            if (brandText != null)
            {
                SetActive(brandText, true);
                brandText.text = _isMatched ? "IT'S A MATCH" : "IN YOUR ROOM";
                StyleText(brandText, 16f, FontStyles.Bold);
                brandText.characterSpacing = 2f;
                Layout(brandText.rectTransform, new Vector2(Padding, -25f), new Vector2(ContentWidth, 22f));
            }

            float reasonHeight = 0f;
            if (matchReasonText != null)
            {
                matchReasonText.text = _reason;
                StyleText(matchReasonText, 27f, FontStyles.Normal);
                matchReasonText.textWrappingMode = TextWrappingModes.Normal;
                reasonHeight = showReason
                    ? Mathf.Max(40f, matchReasonText.GetPreferredValues(_reason, ContentWidth, Mathf.Infinity).y)
                    : 0f;
                Layout(matchReasonText.rectTransform, new Vector2(Padding, -126f),
                    new Vector2(ContentWidth, reasonHeight));
                SetActive(matchReasonText, showReason);
            }

            float height = showReason ? 158f + reasonHeight : 142f;
            if (transform is RectTransform card)
            {
                // Keep the top edge stable as the explanation expands downward.
                card.pivot = new Vector2(0.5f, 1f);
                card.sizeDelta = new Vector2(Width, height);
                card.localScale = Vector3.one * 0.00115f;
            }
            RectTransform surfaceRect = glassSurface.rectTransform;
            surfaceRect.anchorMin = Vector2.zero;
            surfaceRect.anchorMax = Vector2.one;
            surfaceRect.offsetMin = Vector2.zero;
            surfaceRect.offsetMax = Vector2.zero;
            glassSurface.color = _isMatched ? MatchGlass : NeutralGlass;
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

        private static void SetActive(Graphic graphic, bool active)
        {
            if (graphic != null && graphic.gameObject.activeSelf != active)
                graphic.gameObject.SetActive(active);
        }
    }
}
