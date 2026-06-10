import { useState } from "react";
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
