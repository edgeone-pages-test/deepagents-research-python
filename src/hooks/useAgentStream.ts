/**
 * useAgentStream — SSE streaming hook for the DeepAgents chat.
 *
 * Consumes the EdgeOne Makers SSE endpoint (POST /stream) and manages:
 * - messages[]       : the linear chat history
 * - subAgentGroups[] : batches of SubAgent cards, each triggered by a coordinator message
 * - phase            : current research phase (idle -> planning -> researching -> synthesizing -> complete)
 * - isStreaming       : whether the stream is active
 *
 * ConversationId is managed here: generated once per session, sent via
 * `makers-conversation-id` header so EdgeOne routes to the same agent instance.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  FlowItem,
  ResearchPhase,
  StreamEvent,
  SubAgentGroup,
  SubAgentTask,
  ToolCallEntry,
} from "../lib/types";

let _id = 0;
function uid(): string {
  return `msg-${++_id}-${Date.now()}`;
}

function toolCallUid(): string {
  return `tc-${++_id}-${Date.now()}`;
}

// Build a short, human-readable summary from tool args.
function buildArgSummary(toolName: string, rawArgs: string): string | undefined {
  if (!rawArgs) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const args = parsed as Record<string, unknown>;

  const truncate = (s: string, n = 80) =>
    s.length > n ? s.slice(0, n - 1) + "…" : s;

  switch (toolName) {
    case "internet_search": {
      const q = typeof args.query === "string" ? args.query : "";
      return q ? `"${truncate(q)}"` : undefined;
    }
    case "write_todos": {
      const todos = args.todos;
      if (Array.isArray(todos)) return `${todos.length} todos`;
      return undefined;
    }
    case "read_file":
    case "read":
    case "write_file":
    case "edit_file": {
      const p =
        (typeof args.file_path === "string" && args.file_path) ||
        (typeof args.path === "string" && args.path) ||
        "";
      return p ? truncate(p) : undefined;
    }
    case "ls": {
      const p = typeof args.path === "string" ? args.path : "/";
      return truncate(p);
    }
    default: {
      // Generic fallback: first string value in args
      for (const v of Object.values(args)) {
        if (typeof v === "string" && v.trim()) return `"${truncate(v)}"`;
      }
      return undefined;
    }
  }
}

// Global order counter for timeline rendering
let _orderIdx = 0;
function nextOrder(): number {
  return ++_orderIdx;
}

const CONVERSATIONS_KEY = 'deepagents-conversations';

interface StoredConversation {
  id: string;
  title: string;
  timestamp: number;
}

function getStoredConversations(): StoredConversation[] {
  try {
    return JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveConversationToStorage(id: string, title: string) {
  const list = getStoredConversations();
  // Don't duplicate
  if (list.find((c) => c.id === id)) return;
  list.unshift({ id, title: title.slice(0, 50), timestamp: Date.now() });
  // Keep max 20 recent conversations
  if (list.length > 20) list.pop();
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
}

async function removeConversationFromStorage(id: string) {
  const list = getStoredConversations().filter((c) => c.id !== id);
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
  try {
    await fetch('/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'makers-conversation-id': id,
      },
      body: JSON.stringify({ action: 'delete', conversationId: id }),
    });
  } catch {}
}

// Get initial conversation ID from URL ?id= or generate new one
function getInitialConversationId(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const urlId = urlParams.get('id');
  if (urlId) return urlId;
  return crypto.randomUUID();
}

export function useAgentStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [subAgentGroups, setSubAgentGroups] = useState<SubAgentGroup[]>([]);
  const [phase, setPhase] = useState<ResearchPhase>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const wasCancelledRef = useRef(false);

  // ConversationId: from URL ?id= param or generate new.
  const conversationIdRef = useRef<string>(getInitialConversationId());
  const conversationSavedRef = useRef(false);

  // Mapping: subagent_id → card_id
  const saToCardRef = useRef<Map<string, string>>(new Map());
  const cardToGroupRef = useRef<Map<string, string>>(new Map());

  // Two different tool_call_id namespaces:
  //   1. Main agent's `task` tool_call_id = card id (lifecycle events)
  //   2. Subagent's internal tool_call_id (tool invocations, NOT card id)
  //
  // lifecycle events  → resolveCardId({ preferToolCallId: true })
  // subagent tool/AI  → resolveCardId({ preferToolCallId: false })

  function resolveCardId(
    event: StreamEvent,
    opts: { preferToolCallId?: boolean } = {}
  ): string | null {
    if (opts.preferToolCallId && event.tool_call_id) return event.tool_call_id;
    if (event.subagent_id) {
      const mapped = saToCardRef.current.get(event.subagent_id);
      if (mapped) return mapped;
    }
    return null;
  }

  // -- Update a specific task card --

  function updateTask(
    cardId: string,
    updater: (task: SubAgentTask) => SubAgentTask
  ) {
    setSubAgentGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) =>
          task.id === cardId ? updater(task) : task
        ),
      }))
    );
  }

  // -- Build flow items for rendering (pure timeline order) --

  function buildFlowItems(): FlowItem[] {
    // Collect all items with their order index
    const ordered: { orderIdx: number; item: FlowItem }[] = [];

    for (const msg of messages) {
      ordered.push({
        orderIdx: msg.orderIdx ?? 0,
        item: msg.role === "user"
          ? { type: "user_message", message: msg }
          : { type: "ai_message", message: msg },
      });
    }

    for (const group of subAgentGroups) {
      ordered.push({
        orderIdx: group.orderIdx ?? 0,
        item: { type: "subagent_group", group },
      });
    }

    // Sort by creation order
    ordered.sort((a, b) => a.orderIdx - b.orderIdx);

    return ordered.map((o) => o.item);
  }

  // -- Send message --

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        orderIdx: nextOrder(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setPhase("planning");
      setIsStreaming(true);

      // Save conversation to localStorage on first message
      if (!conversationSavedRef.current) {
        saveConversationToStorage(conversationIdRef.current, text);
        conversationSavedRef.current = true;
        // Update URL with conversation id
        window.history.replaceState(null, '', '?id=' + conversationIdRef.current);
      }

      const controller = new AbortController();
      abortRef.current = controller;
      wasCancelledRef.current = false;

      saToCardRef.current.clear();
      cardToGroupRef.current.clear();

      let currentAssistantId: string | null = null;
      let synthesisAssistantId: string | null = null;
      let synthesisStarted = false;
      let currentGroupId: string | null = null;
      let lastGroupLinkedToMsgId: string | null = null;
      let hasSeenSubAgents = false;
      const unmappedCardIds: string[] = [];

      // -- Event handlers --

      function handleSubagentPending(event: StreamEvent) {
        const cardId = event.tool_call_id || uid();
        const description = "__PENDING__";
        const subagentType = event.subagent_type || "researcher";

        if (synthesisStarted) {
          synthesisStarted = false;
          synthesisAssistantId = null;
        }

        hasSeenSubAgents = true;
        setPhase("researching");

        if (currentAssistantId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentAssistantId
                ? { ...m, hasSubAgents: true }
                : m
            )
          );
        }

        const newTask: SubAgentTask = {
          id: cardId,
          description,
          status: "pending",
          content: "",
          toolCalls: [],
          startedAt: Date.now(),
          subagentType,
        };

        unmappedCardIds.push(cardId);

        if (!currentGroupId || currentAssistantId !== lastGroupLinkedToMsgId) {
          currentGroupId = `group-${++_id}`;
          lastGroupLinkedToMsgId = currentAssistantId;
          const triggerMsgId = currentAssistantId || undefined;
          setSubAgentGroups((prev) => [
            ...prev,
            { id: currentGroupId!, tasks: [newTask], triggeredByMessageId: triggerMsgId, orderIdx: nextOrder() },
          ]);
        } else {
          setSubAgentGroups((prev) =>
            prev.map((g) =>
              g.id === currentGroupId
                ? { ...g, tasks: [...g.tasks, newTask] }
                : g
            )
          );
        }

        cardToGroupRef.current.set(cardId, currentGroupId);
      }

      function handleSubagentStep(event: StreamEvent) {
        const saId = event.subagent_id || "";

        if (saId && !saToCardRef.current.has(saId) && unmappedCardIds.length > 0) {
          const cardId = unmappedCardIds.shift()!;
          saToCardRef.current.set(saId, cardId);
        }

        const cardId = resolveCardId(event, { preferToolCallId: true });
        if (cardId) {
          updateTask(cardId, (t) =>
            t.status === "pending"
              ? { ...t, status: "running", subagentId: saId, startedAt: Date.now() }
              : t
          );
        }
      }

      function handleSubagentComplete(event: StreamEvent) {
        const toolCallId = event.tool_call_id || "";
        const contentPrefix = event.content || "";
        const description = event.description || "";
        if (!toolCallId) return;

        setSubAgentGroups((prev) => {
          // Match card by content prefix
          let matchedCardId: string | null = null;

          if (contentPrefix) {
            const prefix = contentPrefix.slice(0, 50);
            for (const group of prev) {
              for (const task of group.tasks) {
                if (task.content && task.content.startsWith(prefix)) {
                  matchedCardId = task.id;
                  break;
                }
              }
              if (matchedCardId) break;
            }
          }

          // Fallback: tool_call_id is also the card id
          const targetCardId = matchedCardId || toolCallId;

          const updated = prev.map((group) => ({
            ...group,
            tasks: group.tasks.map((task) =>
              task.id === targetCardId
                ? {
                    ...task,
                    description: description || task.description,
                    status: "complete" as const,
                    duration: (Date.now() - task.startedAt) / 1000,
                    toolCalls: task.toolCalls.map((tc) => ({
                      ...tc,
                      status: "completed" as const,
                    })),
                  }
                : task
            ),
          }));

          const allComplete = updated.every((g) =>
            g.tasks.every((t) => t.status === "complete")
          );
          if (allComplete && hasSeenSubAgents) {
            synthesisStarted = true;
            setPhase("synthesizing");
          }

          return updated;
        });
      }

      function handleMainAI(event: StreamEvent) {
        const content = event.content || "";
        if (!content) return;

        if (hasSeenSubAgents) {
          // Auto-enter synthesis mode when main agent starts responding
          // after subagents, even if not all subagents have completed.
          if (!synthesisStarted) {
            synthesisStarted = true;
            setPhase("synthesizing");
            // Force-complete any remaining running/pending subagent tasks
            setSubAgentGroups((prev) =>
              prev.map((group) => ({
                ...group,
                tasks: group.tasks.map((task) =>
                  task.status === "running" || task.status === "pending"
                    ? { ...task, status: "complete" as const, duration: task.startedAt ? (Date.now() - task.startedAt) / 1000 : 0 }
                    : task
                ),
              }))
            );
          }

          if (!synthesisAssistantId) {
            const newId = uid();
            synthesisAssistantId = newId;
            currentAssistantId = newId;
            currentGroupId = null;
            setMessages((prev) => [
              ...prev,
              { id: newId, role: "assistant", content, orderIdx: nextOrder() },
            ]);
          } else {
            const targetId = synthesisAssistantId;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === targetId
                  ? { ...m, content: m.content + content }
                  : m
              )
            );
          }
          return;
        }

        if (!currentAssistantId) {
          const newId = uid();
          currentAssistantId = newId;
          setMessages((prev) => [
            ...prev,
            { id: newId, role: "assistant", content, orderIdx: nextOrder() },
          ]);
        } else {
          const targetId = currentAssistantId;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === targetId
                ? { ...m, content: m.content + content }
                : m
            )
          );
        }
      }

      function handleMainToolCall(event: StreamEvent) {
        if (event.name === "task") {
          hasSeenSubAgents = true;
          setPhase("researching");
        }
      }

      function handleSubagentAI(event: StreamEvent) {
        const cardId = resolveCardId(event, { preferToolCallId: false });
        const content = event.content || "";
        if (!cardId || !content) return;

        updateTask(cardId, (t) => {
          const allToolsDone = t.toolCalls.length > 0 &&
            t.toolCalls.every((tc) => tc.status === "completed");
          const shouldUpdateDesc = allToolsDone && !t.content;

          return {
            ...t,
            content: t.content + content,
            status: t.status === "pending" ? "running" : t.status,
            ...(shouldUpdateDesc && { description: "__SUMMARIZING__" }),
          };
        });
      }

      function handleSubagentToolCall(event: StreamEvent) {
        const cardId = resolveCardId(event, { preferToolCallId: false });
        if (!cardId) return;

        const tcId = event.tool_call_id;
        const name = event.name;
        if (!name) return;

        const args = event.args ?? "";
        const entryId = tcId ? `tc:${tcId}` : toolCallUid();

        updateTask(cardId, (t) => {
          if (tcId && t.toolCalls.some((tc) => tc.id === entryId)) return t;

          const entry: ToolCallEntry = {
            id: entryId,
            name,
            status: "pending",
            args: args || undefined,
            argSummary: args ? buildArgSummary(name, args) : undefined,
          };

          const argSummary = args ? buildArgSummary(name, args) : undefined;
          const dynamicDesc = argSummary ? `${name} ${argSummary}` : name;

          return {
            ...t,
            description: dynamicDesc,
            toolCalls: [...t.toolCalls, entry],
            status: t.status === "pending" ? "running" : t.status,
          };
        });
      }

      function handleSubagentToolResult(event: StreamEvent) {
        const cardId = resolveCardId(event, { preferToolCallId: false });
        if (!cardId) return;
        const tcId = event.tool_call_id;
        const entryId = tcId ? `tc:${tcId}` : null;

        updateTask(cardId, (t) => {
          const toolCalls = [...t.toolCalls];
          let idx = entryId
            ? toolCalls.findIndex((tc) => tc.id === entryId)
            : -1;
          if (idx === -1) {
            idx = toolCalls.findIndex((tc) => tc.status === "pending");
          }
          if (idx !== -1) {
            toolCalls[idx] = {
              ...toolCalls[idx],
              status: "completed",
            };
          }
          return { ...t, toolCalls };
        });
      }

      // -- SSE stream consumption --

      try {
        const resp = await fetch("/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "makers-conversation-id": conversationIdRef.current,
          },
          body: JSON.stringify({ message: text }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const reader = resp.body?.getReader();
        if (!reader) throw new Error("No readable stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(payload);
            } catch {
              continue;
            }

            switch (event.type) {
              case "subagent_pending":
                handleSubagentPending(event);
                break;
              case "subagent_step":
                handleSubagentStep(event);
                break;
              case "subagent_complete":
                handleSubagentComplete(event);
                break;
              case "ai":
                if (event.source === "main") {
                  handleMainAI(event);
                } else {
                  handleSubagentAI(event);
                }
                break;
              case "tool_call":
                if (event.source === "main") {
                  handleMainToolCall(event);
                } else {
                  handleSubagentToolCall(event);
                }
                break;
              case "tool":
                if (event.source === "subagent") {
                  handleSubagentToolResult(event);
                }
                break;
              case "error":
                setMessages((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    role: "assistant",
                    content: `⚠️ ${event.content || "Unknown error"}`,
                    orderIdx: nextOrder(),
                  },
                ]);
                break;
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          wasCancelledRef.current = true;
        } else {
          const errorMsg =
            err instanceof Error ? err.message : "Stream connection failed";
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content: `⚠️ ${errorMsg}`,
              orderIdx: nextOrder(),
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;

        if (wasCancelledRef.current) {
          setPhase("idle");
          setMessages((prev) => [
            ...prev,
            { id: uid(), role: "assistant", content: "__STOPPED__", orderIdx: nextOrder() },
          ]);
          setSubAgentGroups((prev) =>
            prev.map((group) => ({
              ...group,
              tasks: group.tasks.map((task) =>
                task.status === "running" || task.status === "pending"
                  ? {
                      ...task,
                      status: "cancelled" as const,
                      duration:
                        task.duration || (Date.now() - task.startedAt) / 1000,
                    }
                  : task
              ),
            }))
          );
        } else {
          setPhase("complete");
          setSubAgentGroups((prev) =>
            prev.map((group) => ({
              ...group,
              tasks: group.tasks.map((task) =>
                task.status === "running" || task.status === "pending"
                  ? {
                      ...task,
                      status: "complete" as const,
                      duration:
                        task.duration || (Date.now() - task.startedAt) / 1000,
                    }
                  : task
              ),
            }))
          );
        }
      }
    },
    [isStreaming]
  );

  // -- Stop streaming --

  const stopStreaming = useCallback(() => {
    wasCancelledRef.current = true;

    // Abort the client-side stream immediately so any subsequent sendMessage
    // won't be interfered with by a late-arriving /stop response.
    abortRef.current?.abort();
    abortRef.current = null;

    // Fire-and-forget: notify the server to cancel the active run.
    // We intentionally do NOT await this — waiting for the response caused a
    // race where the delayed response would abort a newly-started conversation.
    const convId = conversationIdRef.current;
    fetch("/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "makers-conversation-id": convId,
      },
      body: JSON.stringify({ conversationId: convId }),
    }).catch(() => {
      // ignore stop request failure
    });
  }, []);

  // -- Reset for new conversation --

  const resetChat = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setSubAgentGroups([]);
    setPhase("idle");
    setIsStreaming(false);
    setIsLoadingHistory(false);
    saToCardRef.current.clear();
    cardToGroupRef.current.clear();
    _orderIdx = 0;
    // Generate new conversationId for fresh conversation
    conversationIdRef.current = crypto.randomUUID();
    conversationSavedRef.current = false;
    // Clear URL params
    window.history.replaceState(null, '', window.location.pathname);
  }, [stopStreaming]);

  // -- Load conversation from backend (restore history) --

  const loadConversation = useCallback(
    async (targetConversationId: string) => {
      if (isStreaming) return;
      setIsLoadingHistory(true);
      setLoadError(null);
      setMessages([]);
      setSubAgentGroups([]);
      setPhase("idle");
      saToCardRef.current.clear();
      cardToGroupRef.current.clear();
      _orderIdx = 0;

      // Update conversationId and URL
      conversationIdRef.current = targetConversationId;
      conversationSavedRef.current = true;
      window.history.replaceState(null, '', '?id=' + targetConversationId);

      try {
        const resp = await fetch("/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "makers-conversation-id": targetConversationId,
          },
          body: JSON.stringify({ action: "history", conversationId: targetConversationId }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const items: Array<
          | { type: "user"; content: string }
          | { type: "coordinator"; content: string }
          | { type: "subagentTask"; id: string; description: string; subagentType: string; content: string }
        > = data.items || [];

        // Rebuild messages + subagent groups in original order
        const restoredMessages: ChatMessage[] = [];
        const restoredGroups: SubAgentGroup[] = [];
        let currentGroupTasks: SubAgentTask[] = [];
        let lastCoordinatorMsgId: string | null = null;

        for (const item of items) {
          if (item.type === "user") {
            // Flush any pending subagent group before a new turn
            if (currentGroupTasks.length > 0) {
              restoredGroups.push({
                id: `group-restored-${restoredGroups.length}-${Date.now()}`,
                tasks: currentGroupTasks,
                triggeredByMessageId: lastCoordinatorMsgId || undefined,
                orderIdx: ++_orderIdx,
              });
              if (lastCoordinatorMsgId) {
                const m = restoredMessages.find((msg) => msg.id === lastCoordinatorMsgId);
                if (m) m.hasSubAgents = true;
              }
              currentGroupTasks = [];
              lastCoordinatorMsgId = null;
            }

            const id = `restored-${restoredMessages.length}-${Date.now()}`;
            restoredMessages.push({ id, role: "user", content: item.content, orderIdx: ++_orderIdx });
          } else if (item.type === "coordinator") {
            // Flush pending group before the synthesis message
            if (currentGroupTasks.length > 0) {
              restoredGroups.push({
                id: `group-restored-${restoredGroups.length}-${Date.now()}`,
                tasks: currentGroupTasks,
                triggeredByMessageId: lastCoordinatorMsgId || undefined,
                orderIdx: ++_orderIdx,
              });
              if (lastCoordinatorMsgId) {
                const m = restoredMessages.find((msg) => msg.id === lastCoordinatorMsgId);
                if (m) m.hasSubAgents = true;
              }
              currentGroupTasks = [];
            }

            const id = `restored-${restoredMessages.length}-${Date.now()}`;
            lastCoordinatorMsgId = id;
            restoredMessages.push({ id, role: "assistant", content: item.content, orderIdx: ++_orderIdx });
          } else if (item.type === "subagentTask") {
            currentGroupTasks.push({
              id: item.id,
              description: item.description,
              status: "complete",
              content: item.content,
              toolCalls: [],
              startedAt: 0,
              subagentType: item.subagentType,
            });
          }
        }

        // Flush any remaining group
        if (currentGroupTasks.length > 0) {
          restoredGroups.push({
            id: `group-restored-${restoredGroups.length}-${Date.now()}`,
            tasks: currentGroupTasks,
            triggeredByMessageId: lastCoordinatorMsgId || undefined,
            orderIdx: ++_orderIdx,
          });
          if (lastCoordinatorMsgId) {
            const m = restoredMessages.find((msg) => msg.id === lastCoordinatorMsgId);
            if (m) m.hasSubAgents = true;
          }
        }

        setMessages(restoredMessages);
        setSubAgentGroups(restoredGroups);
        if (restoredMessages.length > 0) {
          setPhase("complete");
        } else {
          setLoadError("empty");
        }
      } catch (err) {
        console.error("Failed to load conversation history:", err);
        setLoadError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [isStreaming]
  );

  // -- Auto-restore conversation on mount if URL has ?id= --

  const hasAutoLoaded = useRef(false);
  useEffect(() => {
    if (hasAutoLoaded.current) return;
    hasAutoLoaded.current = true;
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');
    if (urlId) {
      loadConversation(urlId);
    }
  }, [loadConversation]);

  return {
    messages,
    subAgentGroups,
    phase,
    isStreaming,
    isLoadingHistory,
    loadError,
    dismissLoadError: () => setLoadError(null),
    sendMessage,
    stopStreaming,
    resetChat,
    buildFlowItems,
    loadConversation,
    getStoredConversations,
    removeConversationFromStorage,
  };
}
