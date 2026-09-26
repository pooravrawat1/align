using System;

namespace Align.Profiles
{
    [Serializable]
    public sealed class SocialLinkData
    {
        public string Platform = string.Empty;
        public string UrlOrHandle = string.Empty;
    }

    [Serializable]
    public sealed class ProfileCardData
    {
        public string UserId = string.Empty;
        public string Name = string.Empty;
        public string Bio = string.Empty;
        public string[] Interests = Array.Empty<string>();
        public SocialLinkData[] SocialLinks = Array.Empty<SocialLinkData>();
    }
}
