const clone = (value) => JSON.parse(JSON.stringify(value));

// Session profiles are shared between browser sessions for the lifetime of
// the server instance. This preserves the old cross-session demo behavior
// without carrying connection-request state.
export function createProfileStore() {
  const profiles = new Map();
  return {
    rememberProfile(profile, { overwrite = true } = {}) {
      if (overwrite || !profiles.has(profile.id)) profiles.set(profile.id, clone(profile));
    },
    profile(userId) {
      return profiles.has(userId) ? clone(profiles.get(userId)) : null;
    },
  };
}
