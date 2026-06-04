import { useLanguage } from "../hooks/useLanguage";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming }: ChatInputProps) {
  const { t } = useLanguage();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("message") as HTMLInputElement;
    const value = input.value.trim();
    if (!value) return;
    onSend(value);
    input.value = "";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) form.requestSubmit();
    }
  }

  return (
    <div className="border-t border-[#e5e5e3] bg-white px-6 py-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-3xl items-center gap-3"
      >
        <input
          name="message"
          type="text"
          autoComplete="off"
          placeholder={t.inputPlaceholder}
          disabled={isStreaming}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-[13px] outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-teal-300 focus:bg-white focus:shadow-[0_0_0_3px_rgba(13,148,136,0.08)] disabled:opacity-40"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="stop-btn cursor-pointer flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-[13px] font-medium text-white transition-all duration-200 hover:bg-teal-700 active:scale-95"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            {t.stopButton}
          </button>
        ) : (
          <button
            type="submit"
            className="cursor-pointer flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-[13px] font-medium text-white transition-all duration-200 hover:bg-teal-500"
          >
            {t.sendButton}
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        )}
      </form>
    </div>
  );
}
