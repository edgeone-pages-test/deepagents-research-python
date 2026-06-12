import { useState, useEffect } from "react";
import { useAgentStream } from "../hooks/useAgentStream";
import { Header } from "./Header";
import { WelcomeScreen } from "./WelcomeScreen";
import { MessageFlow } from "./MessageFlow";
import { ChatInput } from "./ChatInput";

import { useLanguage } from "../hooks/useLanguage";

/** Main chat page — centered container layout. */
export function ChatPage() {
  const { t } = useLanguage();
  const {
    messages,
    phase,
    isStreaming,
    isLoadingHistory,
    loadError,
    dismissLoadError,
    sendMessage,
    stopStreaming,
    resetChat,
    buildFlowItems,
    loadConversation,
    getStoredConversations,
    removeConversationFromStorage,
  } = useAgentStream();

  const hasMessages = messages.length > 0;
  const flowItems = buildFlowItems();

  // Auto-dismiss load error after 3s
  useEffect(() => {
    if (loadError) {
      const timer = setTimeout(() => dismissLoadError(), 3000);
      return () => clearTimeout(timer);
    }
  }, [loadError, dismissLoadError]);

  const loadErrorText = loadError
    ? loadError === "empty"
      ? t.loadHistoryEmpty
      : `${t.loadHistoryFailed}: ${loadError}`
    : null;

  // Force re-render when conversations change (after removal)
  const [, forceUpdate] = useState(0);
  const handleRemoveConversation = (id: string) => {
    removeConversationFromStorage(id);
    forceUpdate((n: number) => n + 1);
  };

  return (
    <div className="flex h-screen flex-col bg-[#f9fafb]">
      <Header
        phase={phase}
        hasMessages={hasMessages}
        onNewChat={resetChat}
      />

      {/* Floating error toast — auto-dismiss 3s */}
      {loadErrorText && (
        <div className="absolute top-16 inset-x-0 flex justify-center z-50 animate-fade-in-up">
          <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 shadow-lg">
            <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm text-red-700">{loadErrorText}</span>
            <button
              onClick={dismissLoadError}
              className="cursor-pointer ml-1 rounded p-0.5 text-red-400 hover:text-red-600 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {isLoadingHistory ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t.loadingHistory}
            </div>
          </div>
        ) : hasMessages ? (
          <MessageFlow items={flowItems} isStreaming={isStreaming} phase={phase} />
        ) : (
          <WelcomeScreen
            onSelect={sendMessage}
            onLoadConversation={loadConversation}
            storedConversations={getStoredConversations()}
            onRemoveConversation={handleRemoveConversation}
          />
        )}

        <ChatInput
          onSend={sendMessage}
          onStop={stopStreaming}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
