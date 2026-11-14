import type { ReactNode } from "react";
import type { AqiCategory } from "@/lib/types";

/** AQI category colours (CPCB). Used only for data, always next to the number and name. */
export const AQI_COLORS: Record<AqiCategory, { bg: string; fg: string }> = {
  Good: { bg: "#00b050", fg: "#16242b" },
  Satisfactory: { bg: "#92d050", fg: "#16242b" },
  Moderate: { bg: "#ffff00", fg: "#16242b" },
  Poor: { bg: "#ff9900", fg: "#16242b" },
  "Very Poor": { bg: "#ff0000", fg: "#ffffff" },
  Severe: { bg: "#c00000", fg: "#ffffff" },
};

/** Logo: a magnifying glass with a small air swirl in the lens. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Inspector Pawan logo" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
      <circle cx="27" cy="27" r="18" />
      <path d="M40 40 L57 57" />
      <path d="M18 24c5-5 11-3 12 1s-4 6-6 3M16 31c6 3 13 1 15-4" strokeWidth="3" />
    </svg>
  );
}

/** A bordered panel. */
export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[14px] border border-line bg-surface p-4 ${className}`}>
      {title ? <h2 className="mb-3 text-[22px] font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

/** A button. `kind` picks the emphasis. */
export function Button({
  children,
  onClick,
  kind = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "quiet";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const style =
    kind === "primary" ? "bg-accent text-accent-ink" : "border border-line bg-surface text-ink";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-[10px] px-4 py-2 font-medium disabled:opacity-50 ${style}`}>
      {children}
    </button>
  );
}

/** Row chips: each cited row number. Pressing one highlights that row. */
export function RowChips({ rows, onPick }: { rows: number[]; onPick?: (rows: number[]) => void }) {
  if (rows.length === 0) return null;
  const shown = rows.slice(0, 12);
  return (
    <ul className="mt-2 flex flex-wrap gap-1" aria-label="Cited rows">
      {shown.map((row) => (
        <li key={row}>
          <button type="button" onClick={() => onPick?.([row])} className="rounded-full border border-line px-2 py-0.5 text-sm text-muted">
            Row {row}
          </button>
        </li>
      ))}
      {rows.length > shown.length ? <li className="px-1 text-sm text-muted">+{rows.length - shown.length} more</li> : null}
    </ul>
  );
}

/** An AQI badge with the category name and number. */
export function AqiBadge({ category, value }: { category: AqiCategory; value: number | null }) {
  const colors = AQI_COLORS[category];
  return (
    <span className="inline-block rounded-full px-3 py-1 text-sm font-semibold" style={{ background: colors.bg, color: colors.fg }}>
      {category}
      {value === null ? "" : ` ${Math.round(value)}`}
    </span>
  );
}

/** A warning line for unverified claims and data problems. */
export function Warning({ children }: { children: ReactNode }) {
  return <p className="mt-2 rounded-[10px] bg-warn-bg px-3 py-2 text-sm text-warn">{children}</p>;
}
