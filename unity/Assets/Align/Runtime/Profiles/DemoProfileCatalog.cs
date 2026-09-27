namespace Align.Profiles
{
    public static class DemoProfileCatalog
    {
        public static ProfileCardData Get(string profileId)
        {
            return profileId switch
            {
                "alex" => new ProfileCardData
                {
                    UserId = "alex",
                    Name = "Alex Morgan",
                    Bio = string.Empty,
                    Interests = System.Array.Empty<string>(),
                    SocialLinks = System.Array.Empty<SocialLinkData>()
                },
                "sam" => new ProfileCardData
                {
                    UserId = "sam",
                    Name = "Sam Rivera",
                    Bio = string.Empty,
                    Interests = System.Array.Empty<string>(),
                    SocialLinks = System.Array.Empty<SocialLinkData>()
                },
                _ => new ProfileCardData
                {
                    UserId = "maya",
                    Name = "Maya Chen",
                    Bio = string.Empty,
                    Interests = System.Array.Empty<string>(),
                    SocialLinks = System.Array.Empty<SocialLinkData>()
                }
            };
        }
    }
}
