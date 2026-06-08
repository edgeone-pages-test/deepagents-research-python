import type { ReactNode } from "react";
import type { SubAgentStatus } from "../lib/types";

const statusConfig: Record<
  SubAgentStatus,
  { color: string; label: string; pulse?: boolean }
> = {
  pending: { color: "text-slate-400 bg-slate-100", label: "pending" },
  running: { color: "text-teal-600 bg-teal-50", label: "running", pulse: true },
  complete: { color: "text-emerald-500 bg-emerald-50", label: "complete" },
  error: { color: "text-red-500 bg-red-50", label: "error" },
  cancelled: { color: "text-slate-500 bg-slate-100", label: "cancelled" },
};

const statusIcons: Record<SubAgentStatus, ReactNode> = {
  pending: (
    <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 8 8">
      <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  running: (
    <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 8 8">
      <circle cx="4" cy="4" r="3" />
    </svg>
  ),
  complete: (
    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  error: (
    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  cancelled: (
    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
};

export function StatusBadge({ status }: { status: SubAgentStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${cfg.color} ${cfg.pulse ? "animate-pulse" : ""}`}
    >
      {statusIcons[status]}
      {cfg.label}
    </span>
  );
}
