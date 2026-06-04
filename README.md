# Deep Research Agent (Python)

> A multi-agent research assistant built with Deep Agents on EdgeOne Makers — a lead researcher delegates sub-questions to expert subagents with web search, then synthesizes a comprehensive answer.

**Framework:** Deep Agents · **Category:** Quick Start · **Language:** Python

[![Deploy to EdgeOne Makers](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/makers/new?template=deepagents-research-python&from=within&fromAgent=1&agentLang=python)

## Overview

Deep Research Agent turns a single question into a multi-step research process. A lead researcher plans the approach, dispatches expert subagents to search the web in parallel, and synthesizes their findings into a final answer — all streamed to the frontend in real time.

- **Multi-agent research** — a coordinator delegates 2-3 sub-questions to expert researcher subagents running in parallel
- **Web search** — each subagent performs multiple web searches to gather information from multiple angles
- **Real-time streaming** — SSE delivers planning text, subagent progress, tool calls, and the final synthesis token-by-token
- **Conversation history** — previous research sessions are persisted via LangGraph checkpointer and restorable from the home history list
- **Stop generation** — abort a running research at any time; pending subagents are cancelled gracefully

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_API_KEY` | Yes | Model gateway API key. Use your **Makers Models API Key**, or any OpenAI-compatible provider key. |
| `AI_GATEWAY_BASE_URL` | Yes | Gateway base URL. For Makers Models, use `https://ai-gateway.edgeone.link/v1`. |

> This template follows the **OpenAI-compatible** standard — you can point these variables at Makers Models or any other compatible gateway / provider.

### How to get `AI_GATEWAY_API_KEY`

1. Open the [Makers Console](https://console.cloud.tencent.com/edgeone/makers).
2. Sign in and enable Makers.
3. Go to **Makers → Models → API Key** and create a key.
4. Copy it into `AI_GATEWAY_API_KEY` (set `AI_GATEWAY_BASE_URL` to `https://ai-gateway.edgeone.link/v1`).

Built-in models (`@makers/deepseek-v4-flash`, `@makers/hy3-preview`, `@makers/minimax-m2.7`) are free and rate-limited — great for prototyping. For production, bind your own provider key (BYOK) in the console.

## Local Development

**Prerequisites:** Node.js, npm, Python 3.11+

```bash
npm install
cp .env.example .env
edgeone makers dev
```

> The CLI automatically installs Python dependencies from `requirements.txt`.

Open `http://localhost:8080/agent-metrics` for the local observability panel.

## Project Structure

```text
deepagents-research-python/
├── agents/
│   ├── stream.py          # /stream — main research endpoint (SSE streaming + history + delete)
│   ├── stop.py            # /stop — abort an active research run
│   └── _logger.py         # Shared logger factory
├── src/
│   ├── components/        # React UI components (ChatPage, SubAgentCard, etc.)
│   ├── hooks/
│   │   ├── useAgentStream.ts  # SSE streaming hook + state management
│   │   └── useLanguage.tsx    # i18n context provider
│   ├── i18n/              # Internationalization (en/zh)
│   └── lib/types.ts       # Shared TypeScript types
├── requirements.txt       # Python dependencies
├── edgeone.json           # Agent runtime configuration
└── package.json
```

> Files prefixed with `_` are private modules — not exposed as public routes by EdgeOne.

## How It Works

The agent runs as a **session-mode** runtime: requests sharing the same `conversation_id` are routed to the same instance with persistent state.

### Workflow

1. **User asks a question** — the frontend sends a POST to `/stream` with `makers-conversation-id` header.
2. **Planning** — the lead researcher outputs a brief research plan (1-2 sentences) and dispatches 2-3 sub-questions in parallel via the `task` tool.
3. **Researching** — each expert subagent performs multiple web searches, gathers data, and writes a summary. Progress streams as SSE events.
4. **Synthesizing** — once all subagents finish, the lead researcher synthesizes a comprehensive final answer.
5. **Complete** — the stream ends; the conversation state is checkpointed for future restoration.

### Key Mechanisms

- **Deep Agents + LangGraph**: `create_deep_agent` builds a LangGraph graph with subagent orchestration, middleware (retry), checkpointer, and store.
- **v2 streaming**: uses `stream_mode=["updates", "messages"]` with `subgraphs=True` for real-time event delivery.
- **Platform tools**: `web_search` is provided by the EdgeOne Makers runtime via `context.tools.to_langchain_tools()`.
- **Checkpointer**: conversation state (messages, tool results) is persisted via `context.store.langgraph_checkpointer`, enabling history restoration.

### Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/stream` | POST | Main research (SSE streaming), also handles `action: "history"` and `action: "delete"` |
| `/stop` | POST | Abort an active research run |

The `conversation_id` is passed via the `makers-conversation-id` request header.

## Resources

- [Makers Agents Documentation](https://pages.edgeone.ai/document/agents)
- [Quick Start: Agent Development](https://pages.edgeone.ai/document/agents-quickstart)
- [Makers Models](https://pages.edgeone.ai/document/models)

## License

MIT
