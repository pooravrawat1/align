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
        [SerializeField] private Graphic panel;
        [SerializeField] private Color neutralColor = new(0.12f, 0.13f, 0.15f, 0.96f);
        [SerializeField] private Color matchedColor = new(0.18f, 0.56f, 0.36f, 0.96f);

        public void Configure(
            TMP_Text profileName,
            TMP_Text profileBio,
            TMP_Text profileInterests,
            TMP_Text profileSocial,
            TMP_Text matchReason,
            Graphic background)
        {
            nameText = profileName;
            bioText = profileBio;
            interestsText = profileInterests;
            socialText = profileSocial;
            matchReasonText = matchReason;
            panel = background;
            DisableRichText();
        }

        public void Bind(ProfileCardData profile)
        {
            if (profile == null)
            {
                return;
            }

            SetText(nameText, profile.Name);
            SetText(bioText, profile.Bio);
            SetText(interestsText, JoinLimited(profile.Interests, 3));
            SetText(socialText, JoinSocialLinks(profile.SocialLinks, 4));
        }

        public void SetMatchState(bool isMatched, string reason)
        {
            if (panel != null)
            {
                panel.color = isMatched ? matchedColor : neutralColor;
            }

            SetText(matchReasonText, isMatched ? reason : string.Empty);
            if (matchReasonText != null)
            {
                matchReasonText.gameObject.SetActive(isMatched && !string.IsNullOrWhiteSpace(reason));
            }
        }

        private void Awake()
        {
            DisableRichText();
            SetMatchState(false, string.Empty);
        }

        private void DisableRichText()
        {
            if (nameText != null) nameText.richText = false;
            if (bioText != null) bioText.richText = false;
            if (interestsText != null) interestsText.richText = false;
            if (socialText != null) socialText.richText = false;
            if (matchReasonText != null) matchReasonText.richText = false;
        }

        private static void SetText(TMP_Text target, string value)
        {
            if (target != null)
            {
                target.text = value ?? string.Empty;
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
