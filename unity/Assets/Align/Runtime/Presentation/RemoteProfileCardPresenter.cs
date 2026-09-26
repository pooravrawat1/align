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
        [SerializeField] private Color neutralColor = new(0.12f, 0.13f, 0.15f, 0.96f);
        [SerializeField] private Color matchedColor = new(0.18f, 0.56f, 0.36f, 0.96f);
        [Header("Player nameplate")]
        [SerializeField] private Color neutralNameColor = Color.black;
        [SerializeField] private Color matchedNameColor = new(0.31f, 1f, 0.47f, 1f);
        [SerializeField] private Color nameOutlineColor = new(0f, 0f, 0f, 0.9f);
        [SerializeField, Range(0f, 0.5f)] private float nameOutlineWidth = 0.16f;

        private bool _isMatched;

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
            ApplyNameplateStyle();
            ApplyNameColor();
            ApplyDetailVisibility();
        }

        public void Bind(ProfileCardData profile)
        {
            if (profile == null)
            {
                return;
            }

            SetText(nameText, profile.Name?.Trim().ToLowerInvariant());
            SetText(bioText, profile.Bio);
            SetText(interestsText, JoinLimited(profile.Interests, 3));
            SetText(socialText, JoinSocialLinks(profile.SocialLinks, 4));
        }

        public void SetMatchState(bool isMatched, string reason)
        {
            _isMatched = isMatched;

            if (panel != null)
            {
                panel.color = isMatched ? matchedColor : neutralColor;
            }

            ApplyNameColor();
            ApplyDetailVisibility();

            SetText(matchReasonText, isMatched ? reason : string.Empty);
            if (matchReasonText != null)
            {
                matchReasonText.gameObject.SetActive(isMatched && !string.IsNullOrWhiteSpace(reason));
            }
        }

        private void Awake()
        {
            ResolveBrandText();
            DisableRichText();
            ApplyNameplateStyle();
            SetMatchState(false, string.Empty);
        }

        private void OnValidate()
        {
            nameOutlineWidth = Mathf.Clamp(nameOutlineWidth, 0f, 0.5f);
            ResolveBrandText();
            ApplyNameplateStyle();
            ApplyNameColor();
            ApplyDetailVisibility();
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

        private void ApplyDetailVisibility()
        {
            if (panel != null)
            {
                panel.enabled = _isMatched;
            }

            SetActive(bioText, _isMatched);
            SetActive(interestsText, _isMatched);
            SetActive(socialText, _isMatched);

            // The overhead label should read like an in-game player marker.
            // Product branding belongs in menus, not above a participant.
            SetActive(brandText, false);
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

        private void ApplyNameColor()
        {
            if (nameText != null)
            {
                nameText.color = _isMatched ? matchedNameColor : neutralNameColor;
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

        private static string JoinLimited(string[] values, int limit)
        {
            if (values == null || values.Length == 0 || limit <= 0)
            {
                return string.Empty;
            }

            string result = string.Empty;
            int included = 0;
            for (int index = 0; index < values.Length && included < limit; index++)
            {
                string value = values[index]?.Trim();
                if (string.IsNullOrEmpty(value))
                {
                    continue;
                }

                result = included == 0 ? value : $"{result} · {value}";
                included++;
            }

            return result;
        }

        private static string JoinSocialLinks(SocialLinkData[] links, int limit)
        {
            if (links == null || links.Length == 0 || limit <= 0)
            {
                return string.Empty;
            }

            string result = string.Empty;
            int included = 0;
            for (int index = 0; index < links.Length && included < limit; index++)
            {
                SocialLinkData link = links[index];
                string platform = link?.Platform?.Trim();
                string handle = link?.UrlOrHandle?.Trim();
                if (string.IsNullOrEmpty(platform) || string.IsNullOrEmpty(handle))
                {
                    continue;
                }

                string label = $"{platform}: {handle}";
                result = included == 0 ? label : $"{result}  ·  {label}";
                included++;
            }

            return result;
        }
    }
}
