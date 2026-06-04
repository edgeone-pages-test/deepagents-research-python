import { useEffect, useRef, useCallback } from "react";
import type { FlowItem } from "../lib/types";
import { Markdown } from "./Markdown";
import { SubAgentCardGroup } from "./SubAgentCardGroup";
import { TypingIndicator } from "./TypingIndicator";
import { useLanguage } from "../hooks/useLanguage";

interface MessageFlowProps {
  items: FlowItem[];
  isStreaming: boolean;
  phase?: string;
}

/** Renders the vertical message flow with auto-scroll. */
export function MessageFlow({ items, isStreaming, phase }: MessageFlowProps) {
  const { t } = useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);

  const checkIsAtBottom = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current && bottomRef.current) {
      isProgrammaticScrollRef.current = true;
      bottomRef.current.scrollIntoView({ behavior: "instant" });
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    }
  }, [items, isStreaming]);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={checkIsAtBottom}
      className="flex-1 overflow-y-auto"
    >
      <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
        {items.map((item, idx) => {
          switch (item.type) {
            case "user_message":
              return (
                <div
                  key={item.message.id}
                  className="flex justify-end"
                  style={{ animation: "fadeIn 0.2s ease" }}
                >
                  <div className="max-w-[80%] rounded-2xl rounded-br-md border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[13px] leading-relaxed text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    {item.message.content}
                  </div>
                </div>
              );

            case "ai_message":
              if (item.message.content === "__STOPPED__") {
                return (
                  <div
                    key={item.message.id}
                    className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-200/60 px-4 py-3 text-[13px] text-slate-500"
                    style={{ animation: "fadeIn 0.2s ease" }}
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    {t.researchStopped}
                  </div>
                );
              }
              return (
                <div
                  key={item.message.id}
                  className="flex justify-start"
                  style={{ animation: "fadeIn 0.2s ease" }}
                >
                  <div className="max-w-[90%]">
                    {/* Avatar + label */}
                    <div className="mb-1.5 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-50">
                        <svg
                          className="h-3.5 w-3.5 text-teal-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-teal-700">
                        {t.coordinator}
                      </span>
                    </div>
                    {/* Content with left accent line */}
                    <div className="relative pl-4 text-[13px] leading-relaxed text-slate-700">
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-teal-400 ${
                          isStreaming && idx === items.length - 1
                            ? "animate-pulse"
                            : "opacity-50"
                        }`}
                      />
                      {item.message.content ? (
                        <>
                          <Markdown content={item.message.content} />
                          {isStreaming &&
                            idx === items.length - 1 &&
                            !item.message.hasSubAgents && (
                              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-teal-400 align-middle" />
                            )}
                        </>
                      ) : (
                        <TypingIndicator />
                      )}
                    </div>
                  </div>
                </div>
              );

            case "subagent_group":
              return (
                <div
                  key={item.group.id}
                  className="mx-auto max-w-full"
                  style={{ animation: "slideUp 0.3s ease" }}
                >
                  <SubAgentCardGroup group={item.group} />
                </div>
              );

            case "synthesizing":
              return (
                <div
                  key={`synth-${idx}`}
                  className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3 text-[13px] text-amber-600"
                  style={{ animation: "fadeIn 0.2s ease" }}
                >
                  <svg className="h-4 w-4 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t.synthesizingResults}
                </div>
              );

            case "typing":
              return (
                <div key={`typing-${idx}`} className="flex justify-start">
                  <TypingIndicator />
                </div>
              );

            default:
              return null;
          }
        })}
        {/* Thinking indicator: shown when streaming but no AI response yet */}
        {isStreaming &&
          items.length > 0 &&
          items[items.length - 1].type === "user_message" && (
            <div
              className="flex justify-start"
              style={{ animation: "fadeIn 0.2s ease" }}
            >
              <div className="max-w-[90%]">
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-50">
                    <svg
                      className="h-3.5 w-3.5 text-teal-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-teal-700">
                    {t.coordinator}
                  </span>
                </div>
                <div className="relative pl-4 text-[13px] leading-relaxed text-slate-500">
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-teal-400 animate-pulse" />
                  <TypingIndicator />
                </div>
              </div>
            </div>
          )}
        {/* Synthesizing indicator: shown when all subagents complete but main agent hasn't started writing yet */}
        {isStreaming &&
          phase === "synthesizing" &&
          items.length > 0 &&
          items[items.length - 1].type !== "ai_message" && (
            <div
              className="flex justify-start"
              style={{ animation: "fadeIn 0.2s ease" }}
            >
              <div className="max-w-[90%]">
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-50">
                    <svg
                      className="h-3.5 w-3.5 text-teal-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-teal-700">
                    {t.coordinator}
                  </span>
                </div>
                <div className="relative pl-4 text-[13px] leading-relaxed text-slate-500">
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-teal-400 animate-pulse" />
                  <TypingIndicator />
                </div>
              </div>
            </div>
          )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
