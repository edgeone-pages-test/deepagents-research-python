import { useLanguage } from "../hooks/useLanguage";
import type { ResearchPhase } from "../lib/types";

interface HeaderProps {
  phase: ResearchPhase;
  hasMessages: boolean;
  onNewChat: () => void;
}

export function Header({ phase, hasMessages, onNewChat }: HeaderProps) {
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
        <a
          href="https://github.com/TencentEdgeOne/deepagents-research-python"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-md p-1 text-slate-300 transition-colors hover:text-slate-500"
          title="GitHub"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
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

      {/* Language toggle */}
      <button
        onClick={toggleLocale}
        className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300"
      >
        {locale === "en" ? "中文" : "EN"}
      </button>

      {/* Back to home */}
      {hasMessages && (
        <button
          onClick={onNewChat}
          className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300"
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
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          {t.newChatButton}
        </button>
      )}
    </header>
  );
}
