// -- SSE Event from backend --

export interface StreamEvent {
  type:
    | "ai"
    | "tool_call"
    | "tool"
    | "subagent_pending"
    | "subagent_step"
    | "subagent_complete"
    | "error";
  source: "main" | "subagent";
  content?: string;
  /** Tool name (used by `tool_call`). */
  name?: string;
  /** Tool name (used by `tool` completion). */
  tool_name?: string;
  /** For subagent_*: the main agent's `task` tool_call_id (= card id).
   *  For tool_call/tool: the inner per-invocation tool_call_id. */
  tool_call_id?: string;
  subagent_type?: string;
  description?: string;
  /** Pregel task id of a running subagent (short-form). */
  subagent_id?: string;
  /** JSON-serialised tool arguments (for `tool_call`). */
  args?: string;
}

// -- Chat message --

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** If true, this message triggered subagent tasks (used for grouping) */
  hasSubAgents?: boolean;
  /** Creation order index for timeline rendering */
  orderIdx?: number;
}

// -- SubAgent task card --

export type SubAgentStatus =
  | "pending"
  | "running"
  | "complete"
  | "error"
  | "cancelled";

export interface SubAgentTask {
  /** Unique card ID = tool_call_id */
  id: string;
  /** Display description from coordinator */
  description: string;
  /** Task status */
  status: SubAgentStatus;
  /** Accumulated streaming content from subagent LLM */
  content: string;
  /** List of tool call names invoked by this subagent */
  toolCalls: ToolCallEntry[];
  /** Timestamp (ms) when status became running */
  startedAt: number;
  /** Duration in seconds (set when complete) */
  duration?: number;
  /** Short subagent ID from namespace */
  subagentId?: string;
  /** Subagent type e.g. "researcher" */
  subagentType?: string;
}

export interface ToolCallEntry {
  id: string;
  name: string;
  status: "pending" | "completed" | "error";
  /** Accumulated raw args string (may be partial JSON during streaming) */
  args?: string;
  /** Short human-readable summary of args, e.g. the search query */
  argSummary?: string;
}

// -- SubAgent group (batch of tasks triggered by one coordinator message) --

export interface SubAgentGroup {
  id: string;
  tasks: SubAgentTask[];
  /** The assistant message ID that triggered this group */
  triggeredByMessageId?: string;
  /** Creation order index for timeline rendering */
  orderIdx?: number;
}

// -- Research phase --

export type ResearchPhase =
  | "idle"
  | "planning"
  | "researching"
  | "synthesizing"
  | "complete";

// -- Flow items for rendering --

export type FlowItem =
  | { type: "user_message"; message: ChatMessage }
  | { type: "ai_message"; message: ChatMessage }
  | { type: "subagent_group"; group: SubAgentGroup }
  | { type: "synthesizing" }
  | { type: "typing" }
  | { type: "stopped" };
