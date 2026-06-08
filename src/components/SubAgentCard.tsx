import { useRef, useEffect, useCallback, useState } from "react";
import type { SubAgentTask } from "../lib/types";
import { StatusBadge } from "./StatusBadge";
import { DurationDisplay } from "./DurationDisplay";
import { Markdown } from "./Markdown";
import { useLanguage } from "../hooks/useLanguage";

/** Strip common Markdown syntax for clean plain-text display. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/`(.+?)`/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.+?)\]\(.*?\)/g, "$1")
    .trim();
}

/** Animated title that slides up on text change. */
function AnimatedTitle({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState(text);
  const [animating, setAnimating] = useState(false);
  const prevTextRef = useRef(text);

  useEffect(() => {
    if (text !== prevTextRef.current) {
      prevTextRef.current = text;
      setAnimating(true);
      // Wait for exit animation, then swap text and enter
      const timer = setTimeout(() => {
        setDisplayText(text);
        setAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [text]);

  return (
    <span
      className="flex-1 truncate text-[13px] font-medium text-slate-700 inline-block transition-all duration-300 ease-out"
      style={{
        transform: animating ? "translateY(-8px)" : "translateY(0)",
        opacity: animating ? 0 : 1,
      }}
      title={displayText}
    >
      {displayText}
    </span>
  );
}

/** A single collapsible SubAgent card. */
export function SubAgentCard({
  task,
  isOpen,
  onToggle,
  index,
}: {
  task: SubAgentTask;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  const { t } = useLanguage();
  const contentRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);

  const checkIsAtBottom = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    const el = contentRef.current;
    if (!el) return;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 30;
  }, []);

  useEffect(() => {
    if (task.status === "running" && isOpen && contentRef.current && isAtBottomRef.current) {
      isProgrammaticScrollRef.current = true;
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    }
  }, [task.content, task.status, isOpen]);

  // Resolve description: replace special markers with i18n text
  function resolveDescription(desc: string): string {
    if (desc === "__PENDING__") return t.taskPending;
    if (desc === "__SUMMARIZING__") return t.taskSummarizing;
    if (!desc) return `${task.subagentType || "researcher"} agent`;
    return stripMarkdown(desc);
  }

  const borderColor = {
    pending: "border-[#e2e8f0]",
    running: "border-slate-200",
    complete: "border-emerald-200/60",
    error: "border-red-200/60",
    cancelled: "border-slate-200/60",
  }[task.status];

  return (
    <div
      className={`rounded-xl border ${borderColor} bg-white overflow-hidden transition-all duration-200`}
    >
      {/* Card Header */}
      <button
        onClick={onToggle}
        className="cursor-pointer flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-50"
      >
        <svg
          className={`h-3 w-3 shrink-0 text-slate-300 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#f1f5f9] text-[10px] font-semibold text-slate-500">
          {index}
        </span>

        {/* Phase-based icon */}
        {task.description === "__PENDING__" ? (
          <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-slate-200 border-t-teal-400" />
        ) : task.description === "__SUMMARIZING__" ? (
          <svg className="h-3.5 w-3.5 shrink-0 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        ) : task.status === "complete" ? (
          <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        )}

        <AnimatedTitle
          text={resolveDescription(task.description)}
        />

        <DurationDisplay startedAt={task.startedAt} duration={task.duration} />
        <StatusBadge status={task.status} />
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="border-t border-slate-100">
          {/* Tool calls — one bordered chip per row */}
          {task.toolCalls.length > 0 && (
            <ul className="flex flex-col gap-1.5 px-3 py-2 border-b border-slate-100 max-h-[88px] overflow-y-auto overscroll-contain">
              {task.toolCalls.map((tc) => (
                <li
                  key={tc.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs transition-colors hover:bg-slate-50/60"
                >
                  {/* Status icon */}
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {tc.status === "pending" ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-slate-200 border-t-teal-400" />
                    ) : tc.status === "completed" ? (
                      <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </span>

                  {/* Tool name pill */}
                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                    {tc.name}
                  </span>

                  {/* Args summary fills remaining space */}
                  {tc.argSummary ? (
                    <span
                      className="min-w-0 flex-1 truncate text-slate-400"
                      title={tc.argSummary}
                    >
                      {tc.argSummary}
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1" />
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Content */}
          <div
            ref={contentRef}
            onScroll={checkIsAtBottom}
            className="max-h-64 overflow-y-auto overscroll-contain px-4 py-3 text-[13px] leading-relaxed text-slate-600"
          >
            {task.content ? (
              <>
                <Markdown content={task.content} />
                {task.status === "running" && (
                  <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-teal-400 align-middle" />
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 py-2 text-slate-300">
                {(task.status === "running" || task.status === "pending") ? (
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="inline-block h-1.5 w-1.5 rounded-full bg-teal-300"
                        style={{
                          animation: "bounce 1.4s infinite ease-in-out both",
                          animationDelay: `${i * 0.16}s`,
                        }}
                      />
                    ))}
                  </span>
                ) : task.status === "cancelled" ? (
                  <span className="text-xs text-slate-400">{t.taskCancelled}</span>
                ) : (
                  <span className="text-xs">{t.noContentYet}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
