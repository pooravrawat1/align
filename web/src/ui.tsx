import { ArrowUpRight, LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import type { Profile } from "./types";
export function Mark({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "mark small" : "mark"}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="17" cy="17" r="11" stroke="currentColor" strokeWidth="3.3" />
      <path
        d="m24 24 9 9m-9-9v8m0-8h8"
        stroke="currentColor"
        strokeWidth="3.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Brand({
  compact = false,
  showLogo = false,
}: {
  compact?: boolean;
  showLogo?: boolean;
}) {
  return (
    <a className={`brand${compact ? " brand--compact" : ""}${showLogo ? " brand--catalyst" : ""}`} href="#/" aria-label="Catalyst home">
      {showLogo ? (
        <img className="brand-logo" src="/assets/catalyst-logo.png" alt="" />
      ) : (
        <Mark small={compact} />
      )}
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
export function Tags({ items, limit }: { items: string[]; limit?: number }) {
  return (
    <div className="tags">
      {items.slice(0, limit).map((item) => (
        <span className="tag" key={item}>
          {item}
        </span>
      ))}
    </div>
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
