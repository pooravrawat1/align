import { ArrowUpRight, ChevronDown, LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, DetailsHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import type { Profile } from "./types";
export function Mark({ small = false }: { small?: boolean }) {
  return (
    <img
      className={small ? "mark small" : "mark"}
      src="/assets/catalyst-logo.png"
      alt=""
      aria-hidden="true"
    />
  );
}
export function Brand({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <a className={`brand${compact ? " brand--compact" : ""}`} href="#/" aria-label="Catalyst home">
      <Mark small={compact} />
      <span>catalyst</span>
    </a>
  );
}
export function Button({
  children,
  variant = "primary",
  busy,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "green";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      className={`button ${variant} ${className}`}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Avatar({
  profile,
  size = "normal",
}: {
  profile: Profile;
  size?: "small" | "normal" | "large";
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === profile.avatar || !profile.avatar)
    return (
      <span className={`avatar avatar-fallback ${size}`} aria-hidden="true">
        {profile.name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((s) => s[0])
          .join("")}
      </span>
    );
  return (
    <img
      className={`avatar ${size}`}
      src={profile.avatar}
      alt=""
      onError={() => setFailedSource(profile.avatar)}
    />
  );
}
export function Chip({
  children,
  className = "",
  as: Component = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: "span" | "li";
}) {
  return <Component className={`chip ${className}`.trim()}>{children}</Component>;
}
export function Tags({ items, limit }: { items: string[]; limit?: number }) {
  return (
    <div className="tags">
      {items.slice(0, limit).map((item) => (
        <Chip key={item}>
          {item}
        </Chip>
      ))}
    </div>
  );
}
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`ds-page-header ${className}`.trim()}>
      <div className="ds-page-header-copy">
        {eyebrow && <span className="ds-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="ds-page-header-action">{action}</div>}
    </header>
  );
}
export function PanelHeader({
  title,
  description,
  icon,
  action,
  headingId,
  headingClassName = "",
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  headingId?: string;
  headingClassName?: string;
  className?: string;
}) {
  const stacked = Boolean(description || icon);
  return (
    <header className={`ds-panel-header ${stacked ? "ds-panel-header--stacked" : "ds-panel-header--row"}${action ? " ds-panel-header--action" : ""} ${className}`.trim()}>
      <div className="ds-panel-header-copy">
        <div className="ds-panel-header-title">
          <h2 id={headingId} className={headingClassName}>{title}</h2>
          {icon && <span className="ds-panel-header-icon" aria-hidden="true">{icon}</span>}
        </div>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="ds-panel-header-action">{action}</div>}
    </header>
  );
}
export function Disclosure({
  title,
  description,
  children,
  className = "",
  ...props
}: DetailsHTMLAttributes<HTMLDetailsElement> & {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details {...props} className={`ds-disclosure ${className}`.trim()}>
      <summary>
        <span>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="ds-disclosure-body">{children}</div>
    </details>
  );
}
export function TextAction({
  children,
  icon,
  iconPosition = "end",
  href,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  icon?: ReactNode;
  iconPosition?: "start" | "end";
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const content = (
    <>
      {iconPosition === "start" && icon}
      <span>{children}</span>
      {iconPosition === "end" && icon}
    </>
  );
  if (href) {
    return (
      <a
        className={`text-action ${className}`}
        data-icon-position={iconPosition}
        href={href}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={`text-action ${className}`}
      data-icon-position={iconPosition}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <TextAction icon={<ArrowUpRight size={15} />} onClick={onClick}>
      {children}
    </TextAction>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <Mark />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? "on" : ""}`}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
