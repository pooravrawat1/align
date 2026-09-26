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
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand" href="#/" aria-label="Align home">
      <Mark small={compact} />
      <span>
        align<span className="brand-dot">.</span>
      </span>
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
  const [failed, setFailed] = useState(false);
  if (failed || !profile.avatar)
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
      onError={() => setFailed(true)}
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
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
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
