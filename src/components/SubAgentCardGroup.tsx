import { useState, useEffect, useCallback, useRef } from "react";
import type { SubAgentGroup } from "../lib/types";
import { SubAgentCard } from "./SubAgentCard";
import { useLanguage } from "../hooks/useLanguage";

/** Accordion-style SubAgent card group with progress bar. */
export function SubAgentCardGroup({ group }: { group: SubAgentGroup }) {
  const { t } = useLanguage();
  const total = group.tasks.length;
  const completed = group.tasks.filter((t) => t.status === "complete").length;
  const percent = total > 0 ? (completed / total) * 100 : 0;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [groupExpanded, setGroupExpanded] = useState(true);
  const manuallyToggledRef = useRef<Set<string>>(new Set());
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  // Auto-expand running cards, auto-collapse completed cards
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;

      for (const task of group.tasks) {
        const prevStatus = prevStatusRef.current.get(task.id);
        const statusChanged = prevStatus !== undefined && prevStatus !== task.status;
        prevStatusRef.current.set(task.id, task.status);

        if (manuallyToggledRef.current.has(task.id)) continue;

        if (task.status === "running" && (statusChanged || prevStatus === undefined)) {
          if (!next.has(task.id)) {
            next.add(task.id);
            changed = true;
          }
        } else if (task.status === "complete" && statusChanged) {
          if (next.has(task.id)) {
            next.delete(task.id);
            changed = true;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [group.tasks.map((t) => `${t.id}:${t.status}`).join(",")]);

  const toggleCard = useCallback((id: string) => {
    manuallyToggledRef.current.add(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="my-2 rounded-xl bg-slate-50/50 p-3">
      {/* Header */}
      <div
        className="mb-2.5 flex cursor-pointer items-center gap-2"
        onClick={() => setGroupExpanded((v) => !v)}
      >
        <svg
          className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${groupExpanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <svg className="h-3.5 w-3.5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
        <span className="text-[13px] font-medium text-slate-700">
          {t.specialistAgents}
        </span>
        <span className="text-xs text-slate-400">
          {completed}/{total} {t.completed}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-[2px] w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-teal-400 transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Cards */}
      {groupExpanded && (
        <div className="space-y-2">
          {group.tasks.map((task, idx) => (
            <SubAgentCard
              key={task.id}
              task={task}
              isOpen={expandedIds.has(task.id)}
              onToggle={() => toggleCard(task.id)}
              index={idx + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
