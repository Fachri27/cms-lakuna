"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ── Kicker — mono eyebrow label with a leading tick ── */
export function Kicker({
  children,
  className,
  tone = "ash",
}: {
  children: ReactNode;
  className?: string;
  tone?: "ash" | "safelight" | "paper";
}) {
  const toneCls =
    tone === "safelight"
      ? "text-safelight"
      : tone === "paper"
        ? "text-paper/50"
        : "text-ash";
  return (
    <p
      className={cn(
        "font-mono text-[10.5px] uppercase tracking-[0.22em] flex items-center gap-2",
        toneCls,
        className,
      )}
    >
      <span aria-hidden className="text-safelight">
        ▍
      </span>
      {children}
    </p>
  );
}

/* ── Panel — cream card with a hairline border ── */
export function Panel({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: any;
}) {
  return (
    <Tag
      className={cn(
        "bg-card border hairline rounded-[3px] shadow-[0_1px_0_rgba(16,15,13,0.04)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ── SectionHeader — kicker + display title, optional action ── */
export function SectionHeader({
  index,
  kicker,
  title,
  action,
  className,
}: {
  index?: string;
  kicker?: string;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-6", className)}>
      <div>
        {kicker && (
          <Kicker className="mb-2">
            {index ? `${index} — ${kicker}` : kicker}
          </Kicker>
        )}
        <h1 className="font-display text-[2.1rem] leading-[1.05] tracking-[-0.01em]">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Stat — oversized editorial numeral ── */
export function Stat({
  index,
  label,
  value,
  unit,
  hint,
  tone = "ink",
  className,
}: {
  index?: string;
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: "ink" | "safelight";
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {index && (
        <span className="absolute top-0 right-0 font-mono text-[10px] text-ash-2">
          {index}
        </span>
      )}
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ash mb-3">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-display text-[2.6rem] leading-[0.9] tracking-[-0.02em] tnum",
            tone === "safelight" ? "text-safelight" : "text-ink",
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-ash-2 uppercase tracking-wider">
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <div className="mt-3 font-mono text-[10.5px] text-ash-2">{hint}</div>
      )}
    </div>
  );
}

/* ── Dot — status pip ── */
const DOT: Record<string, string> = {
  PAID: "bg-safelight",
  APPROVED: "bg-safelight",
  COMPLETED: "bg-safelight",
  ACTIVE: "bg-safelight",
  PENDING: "bg-ash",
  REJECTED: "bg-ink",
  CANCELLED: "bg-ink/30",
  EXPIRED: "bg-ink/30",
};

export function Badge({
  status,
  children,
  className,
}: {
  status: string;
  children?: ReactNode;
  className?: string;
}) {
  const dot = DOT[status] ?? "bg-ash-2";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/70",
        className,
      )}
    >
      <span className={cn("inline-block w-1.5 h-1.5 rounded-full", dot)} />
      {children ?? status}
    </span>
  );
}

/* ── Btn — variants ── */
export function Btn({
  children,
  onClick,
  type = "button",
  variant = "ghost",
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "dark" | "danger";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] px-4 py-2.5 rounded-[3px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const v =
    variant === "primary"
      ? "bg-safelight text-white hover:bg-safelight-dim"
      : variant === "dark"
        ? "bg-ink text-paper hover:bg-ink-3"
        : variant === "danger"
          ? "border border-safelight/30 text-safelight-dim hover:bg-safelight/[0.06]"
          : "border hairline text-ink hover:bg-ink/[0.04]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(base, v, className)}
    >
      {children}
    </button>
  );
}

/* ── Shared form styles ── */
export const inputCls =
  "w-full border hairline border-solid rounded-[3px] bg-card-2 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-safelight focus:ring-2 focus:ring-safelight/15 placeholder:text-ash-2";
export const labelCls =
  "block font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2";

/* ── Field — label + control + error ── */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelCls}>
        {label}
        {hint && <span className="text-ash-2 normal-case tracking-normal"> {hint}</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-safelight-dim text-xs font-mono">{error}</p>
      )}
    </div>
  );
}

/* ── Modal — darkroom overlay + paper panel ── */
export function Modal({
  kicker,
  title,
  onClose,
  children,
  className,
}: {
  kicker?: string;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm fade"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-md bg-paper rounded-[3px] border hairline border-solid p-7 rise",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {kicker && <Kicker className="mb-3">{kicker}</Kicker>}
        <h2 className="font-display text-2xl tracking-[-0.01em] mb-5">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* ── SearchInput ── */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-ash-2"
      >
        ⌕
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputCls, "pl-8")}
      />
    </div>
  );
}

/* ── Pagination ── */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-ash">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 border hairline border-solid rounded-[3px] disabled:opacity-30 hover:bg-ink/[0.04] transition-colors"
      >
        ← Prev
      </button>
      <span className="tnum text-ink">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 border hairline border-solid rounded-[3px] disabled:opacity-30 hover:bg-ink/[0.04] transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

/* ── Chip — selected tag with remove ── */
export function Chip({
  label,
  onRemove,
}: {
  label: ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-ink/[0.06] px-2 py-1 rounded-[3px] text-xs">
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-ash-2 hover:text-safelight-dim"
          aria-label="Hapus"
        >
          ✕
        </button>
      )}
    </span>
  );
}

/* ── Table helpers ── */
export function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-7 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2 font-normal border-b hairline border-solid",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-7 py-4 border-b hairline border-solid last:border-b-0",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ── Rule — horizontal hairline ── */
export function Rule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full hairline border-t", className)} />;
}

/* ── EmptyState ── */
export function EmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "py-16 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ash-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Spinner ── */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block w-3.5 h-3.5 border border-ink/30 border-t-safelight rounded-full animate-spin",
        className,
      )}
      aria-hidden
    />
  );
}

/* ── Skeleton block ── */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-ink/[0.06] rounded-[3px] animate-pulse",
        className,
      )}
    />
  );
}