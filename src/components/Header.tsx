import { useLanguage } from "../hooks/useLanguage";
import type { ResearchPhase } from "../lib/types";

interface HeaderProps {
  phase: ResearchPhase;
  hasMessages: boolean;
  onNewChat: () => void;
  isStreaming: boolean;
}

export function Header({ phase, hasMessages, onNewChat, isStreaming }: HeaderProps) {
  const { t, locale, toggleLocale } = useLanguage();

  const phaseLabel: Record<ResearchPhase, string> = {
    idle: t.phaseIdle,
    planning: t.phasePlanning,
    researching: t.phaseResearching,
    synthesizing: t.phaseSynthesizing,
    complete: t.phaseComplete,
  };

  const phaseColor: Record<ResearchPhase, string> = {
    idle: "text-slate-400",
    planning: "text-teal-600",
    researching: "text-teal-600",
    synthesizing: "text-amber-600",
    complete: "text-emerald-600",
  };

  const phaseDotColor: Record<ResearchPhase, string> = {
    idle: "bg-slate-300",
    planning: "bg-teal-500",
    researching: "bg-teal-500",
    synthesizing: "bg-amber-500",
    complete: "bg-emerald-500",
  };

  return (
    <header className="flex items-center gap-3 border-b border-[#e2e8f0] bg-white/85 backdrop-blur-md px-6 py-3.5">
      {/* Logo + Title */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50">
          <svg
            className="h-4 w-4 text-teal-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
        </div>
        <h1 className="text-[15px] font-semibold tracking-tight text-slate-800">
          {t.appTitle}
        </h1>
      </div>

      {/* Phase indicator */}
      {phase !== "idle" && (
        <div className="ml-1 flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${phaseDotColor[phase]} ${
              phase === "researching" || phase === "planning" || phase === "synthesizing"
                ? "animate-pulse"
                : ""
            }`}
          />
          <span className={`text-xs font-medium ${phaseColor[phase]}`}>
            {phaseLabel[phase]}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* Language toggle — only on welcome screen */}
      {!hasMessages && (
        <button
          onClick={toggleLocale}
          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-all duration-200 hover:bg-[#f1f5f9] hover:text-slate-600"
        >
          {locale === "en" ? "中文" : "EN"}
        </button>
      )}

      {/* New chat */}
      {hasMessages && (
        <button
          onClick={onNewChat}
          disabled={isStreaming}
          className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-all duration-200 hover:bg-[#f1f5f9] hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          {t.newChatButton}
        </button>
      )}
    </header>
  );
}
