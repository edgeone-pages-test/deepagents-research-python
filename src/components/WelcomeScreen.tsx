import { useLanguage } from "../hooks/useLanguage";

interface StoredConversation {
  id: string;
  title: string;
  timestamp: number;
}

interface WelcomeScreenProps {
  onSelect: (question: string) => void;
  onLoadConversation?: (id: string) => void;
  storedConversations?: StoredConversation[];
  onRemoveConversation?: (id: string) => void;
}

const cardIcons = [
  <svg key="search" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>,
  <svg key="rocket" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
  </svg>,
  <svg key="bolt" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>,
  <svg key="database" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>,
];

// Format relative time for conversation timestamps
function formatRelativeTime(timestamp: number, locale: string): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (locale === "zh") {
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return new Date(timestamp).toLocaleDateString("zh-CN");
  }

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US");
}

export function WelcomeScreen({ onSelect, onLoadConversation, storedConversations, onRemoveConversation }: WelcomeScreenProps) {
  const { t, locale } = useLanguage();

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pt-[12vh] pb-8">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50">
        <svg
          className="h-7 w-7 text-teal-600"
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

      <h2 className="mb-1.5 text-xl font-semibold tracking-tight text-slate-800">
        {t.welcomeTitle}
      </h2>
      <p className="mb-8 max-w-md text-center text-sm leading-relaxed text-slate-500">
        {t.welcomeSubtitle}
      </p>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {t.presetQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="group cursor-pointer rounded-xl border border-[#e5e5e3] bg-white p-5 text-left transition-all duration-200 hover:border-teal-200 hover:shadow-[0_2px_8px_rgba(13,148,136,0.10)]"
            style={{ animation: `slideUp 0.3s ease ${i * 0.06}s both` }}
          >
            <span className="mb-2 block text-teal-400 transition-colors duration-200 group-hover:text-teal-600">
              {cardIcons[i % 4]}
            </span>
            <span className="text-[13px] leading-relaxed text-slate-600 transition-colors duration-200 group-hover:text-slate-800">
              {q}
            </span>
          </button>
        ))}
      </div>

      {/* Recent conversations */}
      {storedConversations && storedConversations.length > 0 && onLoadConversation && (
        <div className="mt-8 w-full max-w-2xl" style={{ animation: "fadeIn 0.3s ease 0.2s both" }}>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t.recentConversations}
          </h3>
          <div className="space-y-2">
            {storedConversations.map((conv) => (
              <div
                key={conv.id}
                className="group flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 transition-all duration-200 hover:border-teal-200 hover:shadow-[0_1px_4px_rgba(13,148,136,0.08)]"
              >
                <button
                  onClick={() => onLoadConversation(conv.id)}
                  className="flex-1 cursor-pointer text-left"
                >
                  <span className="block text-[13px] leading-relaxed text-slate-700 group-hover:text-slate-900">
                    {conv.title}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatRelativeTime(conv.timestamp, locale)}
                  </span>
                </button>
                {onRemoveConversation && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveConversation(conv.id);
                    }}
                    className="cursor-pointer rounded p-1 text-slate-300 opacity-0 transition-all duration-200 hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100"
                    title={t.deleteConversation}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
