import { Globe, Linkedin, Mail } from "lucide-react";
import type { Profile } from "./types";
import { sharedContactLinks } from "./contactDestinations";
import "./ContactLinks.css";

const icons = { linkedin: Linkedin, website: Globe, email: Mail };

export function ContactLinks({ profile, showLabels = false }: { profile: Profile; showLabels?: boolean }) {
  const links = sharedContactLinks(profile);
  if (!links.length) return null;
  return (
    <div className="contact-links" aria-label={`Shared contact links for ${profile.name}`}>
      {links.map(({ kind, label, href }) => {
        const Icon = icons[kind];
        return (
          <a key={kind} href={href} target={kind === "email" ? undefined : "_blank"}
            rel={kind === "email" ? undefined : "noopener noreferrer"}
            className="contact-link" aria-label={`${label} for ${profile.name}`} title={label}>
            <Icon size={17} aria-hidden="true" />
            {showLabels && <span>{label}</span>}
          </a>
        );
      })}
    </div>
  );
}
