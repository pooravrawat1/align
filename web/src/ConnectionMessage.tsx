import { useId, useState } from "react";
import { Copy } from "lucide-react";
import { Avatar, Button } from "./ui";
import type { Profile } from "./types";
import "./ConnectionMessage.css";

function suggestedMessage(user: Profile, person: Profile) {
  const shared = person.visibility?.previousConnections !== false && person.visibility?.interests !== false
    ? user.interests.filter(interest => person.interests.some(value => value.trim().toLowerCase() === interest.trim().toLowerCase())).slice(0, 2)
    : [];
  const firstName = person.name.trim().split(/\s+/u)[0] || person.name;
  return shared.length
    ? `Hi ${firstName}—I'd love to compare notes on ${shared.join(" and ")}.`
    : `Hi ${firstName}—I'd love to keep in touch.`;
}

export function ConnectionMessage({ user, person, notify }: {
  user: Profile;
  person: Profile;
  notify: (message: string) => void;
}) {
  const initialMessage = suggestedMessage(user, person);
  return <MessageDraft key={`${user.id}:${person.id}:${initialMessage}`} person={person} initialMessage={initialMessage} notify={notify} />;
}

function MessageDraft({ person, initialMessage, notify }: {
  person: Profile;
  initialMessage: string;
  notify: (message: string) => void;
}) {
  const fieldId = useId();
  const [message, setMessage] = useState(initialMessage);
  const [copying, setCopying] = useState(false);
  async function copyMessage() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(message);
      notify("Message copied.");
    } catch {
      notify("Couldn’t copy. Select the message and copy it manually.");
    } finally {
      setCopying(false);
    }
  }
  return (
    <section className="connection-message-card" aria-label={`Keep in touch with ${person.name}`}>
      <div className="card-header"><h2>Keep in touch</h2></div>
      <div className="connection-message-person">
        <Avatar profile={person} size="large" />
        <div><h3>{person.name}</h3><p>{person.role}</p></div>
      </div>
      <label htmlFor={fieldId}>Message draft</label>
      <textarea id={fieldId} value={message} onChange={event => setMessage(event.target.value)} rows={3} />
      <Button busy={copying} disabled={!message.trim()} onClick={copyMessage}>
        Copy message <Copy size={16} />
      </Button>
    </section>
  );
}
