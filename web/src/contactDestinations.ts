import type { Profile } from "./types";

export type ContactKind = "linkedin" | "website" | "email";
export type ContactLink = { kind: ContactKind; label: string; href: string };

export function contactHref(kind: ContactKind, value: string | undefined): string | null {
  const text = value?.trim();
  if (!text || /[\u0000-\u001f\u007f]/u.test(text)) return null;
  if (kind === "email") {
    return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/u.test(text)
      ? `mailto:${encodeURIComponent(text)}`
      : null;
  }
  try {
    const url = new URL(text);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    if (kind === "linkedin" && url.hostname !== "linkedin.com" && !url.hostname.endsWith(".linkedin.com")) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function sharedContactLinks(profile: Profile): ContactLink[] {
  if (profile.visibility?.previousConnections === false) return [];
  const fields = [["linkedin", "LinkedIn"], ["website", "Website"], ["email", "Email"]] as const;
  return fields.flatMap(([kind, label]) => {
    const href = contactHref(kind, profile[kind]);
    return href ? [{ kind, label, href }] : [];
  });
}
