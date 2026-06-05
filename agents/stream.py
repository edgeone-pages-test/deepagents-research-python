"""
Deep Research Agent — EdgeOne Pages handler (Python).

Architecture: Lead Researcher delegates sub-questions to Expert Researcher
subagents (with web_search), then synthesizes a final answer.

Streaming: uses v2 format with stream_mode=["updates","messages"], subgraphs=True.
Subagent correlation uses arrival-order matching (consistent with ToolNode dispatch order).
Note: v3 streaming is not used due to SDK transformer key conflicts.
"""

import asyncio
import json
import re
from datetime import datetime, timezone

from langchain.chat_models import init_chat_model
from langchain.agents.middleware import (
    ModelRetryMiddleware,
    ToolRetryMiddleware,
    ToolCallLimitMiddleware,
)
from langchain_core.messages import AIMessageChunk, ToolMessage
from langchain_core.tools import StructuredTool
from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend

from ._logger import create_logger

logger = create_logger("research-stream")

# ─── Singleton model & agent (lazy init) ───

_model = None
_agent = None


def _get_env(context_env) -> dict[str, str]:
    source = context_env or {}
    required = ("AI_GATEWAY_API_KEY", "AI_GATEWAY_BASE_URL")
    missing = [k for k in required if not (source.get(k) or "").strip()]

    if missing:
        raise RuntimeError(f"Missing environment variables: {', '.join(missing)}")

    return {k: source[k] for k in required}


def _get_model(env: dict[str, str]):
    global _model
    if _model is None:
        logger.log("Initializing model...")
        _model = init_chat_model(
            model="@makers/hy3-preview",
            model_provider="openai",
            api_key=env["AI_GATEWAY_API_KEY"],
            base_url=env["AI_GATEWAY_BASE_URL"],
            temperature=0,
            timeout=300,
        )
    return _model


def _get_agent(model, checkpointer, store, context_tools):
    global _agent
    if _agent is None:
        logger.log("Initializing research agent...")

        today = datetime.now(timezone.utc).strftime("%Y-%m")
        web_search_tools = context_tools.to_langchain_tools(StructuredTool, names=["web_search"])

        researcher_subagent = {
            "name": "researcher",
            "description": "An expert researcher that answers a specific sub-question using web search.",
            "system_prompt": (
                f"You are an expert researcher. Today is {today}.\n"
                "CRITICAL: You MUST respond in the EXACT same language as your task description. "
                "If the task is in Chinese, your ENTIRE output must be in Chinese. If in English, respond in English.\n\n"
                "Workflow:\n"
                "1. Call web_search 3-5 times with different queries to gather information from multiple angles.\n"
                "2. After your searches complete, IMMEDIATELY write your final summary. Do NOT call web_search again.\n\n"
                "HARD LIMIT: You may call web_search AT MOST 5 times total. After finishing your searches, "
                "you MUST stop and write your summary — no exceptions, no \"let me search more\".\n\n"
                "Output rules:\n"
                "- After searching, output ONLY your summary text (under 600 Chinese characters or 400 English words).\n"
                "- Do NOT narrate your search process (e.g. \"Let me search...\", \"I will look for...\").\n"
                "- Do NOT echo raw JSON from tool results.\n"
                "- Do NOT say you want to search more. Just write the summary."
            ),
            "tools": web_search_tools,
            "middleware": [
                ModelRetryMiddleware(max_retries=3),
                ToolRetryMiddleware(max_retries=2, tools=["web_search"]),
                ToolCallLimitMiddleware(tool_name="web_search", run_limit=15),
            ],
        }

        _agent = create_deep_agent(
            model=model,
            system_prompt=(
                f"You are a lead researcher. Today is {today}.\n"
                "CRITICAL: You MUST use the EXACT same language as the user. "
                "If the user writes in Chinese, ALL your output (plan text AND task descriptions) MUST be in Chinese. "
                "If in English, use English.\n\n"
                "Process:\n"
                "1. On your FIRST response, you MUST call the task tool to delegate 2-3 sub-questions. "
                "You may optionally include a brief plan sentence before the tool calls, but tool calls are MANDATORY in the first response.\n"
                "2. Wait for ALL sub-agent results, then synthesize a concise final answer "
                "(under 400 English words or 600 Chinese characters).\n\n"
                "Rules:\n"
                "- Your first response MUST contain task tool calls. Never respond with only text and no tool calls.\n"
                "- ALL task tool calls MUST happen in ONE single model response — batch them together.\n"
                "- Do NOT dispatch additional tasks after receiving sub-agent results.\n"
                "- Task descriptions MUST be in the user's language.\n"
                "- Only use sub-agent findings. Do not fabricate."
            ),
            subagents=[researcher_subagent],
            middleware=[
                ModelRetryMiddleware(max_retries=3),
            ],
            checkpointer=checkpointer,
            store=store,
            backend=CompositeBackend(
                StateBackend(),
                {
                    "/memories/": StoreBackend(
                        namespace=lambda _: ("agent", "memories"),
                    ),
                },
            ),
            memory=["/memories/AGENTS.md"],
        )
    return _agent


# ─── SSE event stream generator ───

async def _event_stream(agent, message: str, conversation_id: str, utils):
    """Async generator that yields SSE-formatted strings.

    Uses v2 streaming with arrival-order subagent correlation.
    """

    # Subagent correlation state
    tool_call_to_subagent: dict[str, str] = {}
    subagent_to_tool_call: dict[str, str] = {}
    pending_tool_call_ids: list[str] = []
    emitted_tool_call_ids: set[str] = set()
    emitted_tool_result_ids: set[str] = set()
    tool_call_id_to_name: dict[str, str] = {}

    def extract_subagent_id(ns: tuple) -> str:
        if not ns:
            return ""
        return ns[0].split(":", 1)[-1][:8]

    def link_ids(tool_call_id: str, subagent_id: str) -> None:
        if not tool_call_id or not subagent_id:
            return
        tool_call_to_subagent[tool_call_id] = subagent_id
        subagent_to_tool_call[subagent_id] = tool_call_id
        if tool_call_id in pending_tool_call_ids:
            pending_tool_call_ids.remove(tool_call_id)

    def resolve_both_ids(tool_call_id: str = "", subagent_id: str = "") -> tuple[str, str]:
        if subagent_id and not tool_call_id:
            tool_call_id = subagent_to_tool_call.get(subagent_id, "")
        if tool_call_id and not subagent_id:
            subagent_id = tool_call_to_subagent.get(tool_call_id, "")
        return tool_call_id, subagent_id

    def send(event: dict) -> object:
        return utils.sse({k: v for k, v in event.items() if v not in ("", None)})

    try:
        async for chunk in agent.astream(
            {"messages": [{"role": "user", "content": message}]},
            config={"configurable": {"thread_id": conversation_id}},
            stream_mode=["updates", "messages"],
            subgraphs=True,
            version="v2",
        ):
            mode = chunk.get("type")
            chunk_ns = chunk.get("ns") or ()
            chunk_data = chunk.get("data")
            is_subagent = any(s.startswith("tools:") for s in chunk_ns)

            # ── Updates mode ──
            if mode == "updates":
                if not isinstance(chunk_data, dict):
                    continue

                for node_name, node_data in chunk_data.items():

                    # (A) Main agent model node → task tool_calls
                    if not is_subagent and node_name in ("model", "model_request"):
                        for msg in (node_data or {}).get("messages", []) or []:
                            for tc in getattr(msg, "tool_calls", []) or []:
                                if tc.get("name") != "task":
                                    continue
                                tc_id = tc.get("id") or ""
                                pending_tool_call_ids.append(tc_id)
                                yield send({
                                    "type": "subagent_pending",
                                    "source": "main",
                                    "tool_call_id": tc_id,
                                    "subagent_type": (tc.get("args") or {}).get("subagent_type", "researcher"),
                                    "description": ((tc.get("args") or {}).get("description", "") or "")[:500],
                                })

                    # (B) Subagent namespace → running + tool events
                    if is_subagent:
                        sa_id = extract_subagent_id(chunk_ns)

                        if sa_id and sa_id not in subagent_to_tool_call and pending_tool_call_ids:
                            link_ids(pending_tool_call_ids[0], sa_id)

                        tc_id, sa_id = resolve_both_ids(subagent_id=sa_id)

                        yield send({
                            "type": "subagent_step",
                            "source": "subagent",
                            "subagent_id": sa_id,
                            "tool_call_id": tc_id,
                        })

                        # Subagent model node → tool_calls
                        if node_name in ("model", "model_request"):
                            for msg in (node_data or {}).get("messages", []) or []:
                                for tc in getattr(msg, "tool_calls", []) or []:
                                    name = tc.get("name") or ""
                                    if not name:
                                        continue
                                    tc_real_id = tc.get("id") or ""
                                    if tc_real_id and tc_real_id in emitted_tool_call_ids:
                                        continue
                                    if tc_real_id:
                                        emitted_tool_call_ids.add(tc_real_id)
                                        tool_call_id_to_name[tc_real_id] = name

                                    raw_args = tc.get("args")
                                    if isinstance(raw_args, str):
                                        args_str = raw_args
                                    elif raw_args is None:
                                        args_str = ""
                                    else:
                                        try:
                                            args_str = json.dumps(raw_args, ensure_ascii=False)
                                        except (TypeError, ValueError):
                                            args_str = ""

                                    yield send({
                                        "type": "tool_call",
                                        "source": "subagent",
                                        "name": name,
                                        "subagent_id": sa_id,
                                        "tool_call_id": tc_real_id,
                                        "args": args_str,
                                    })

                        # Subagent tools node → tool completion
                        if node_name == "tools":
                            for msg in (node_data or {}).get("messages", []) or []:
                                if not (isinstance(msg, ToolMessage) or getattr(msg, "type", None) == "tool"):
                                    continue
                                tool_tc_id = getattr(msg, "tool_call_id", "") or ""
                                resolved_name = (
                                    getattr(msg, "name", None)
                                    or tool_call_id_to_name.get(tool_tc_id, "")
                                    or ""
                                )
                                if resolved_name == "task":
                                    continue
                                if tool_tc_id and tool_tc_id in emitted_tool_result_ids:
                                    continue
                                if tool_tc_id:
                                    emitted_tool_result_ids.add(tool_tc_id)

                                yield send({
                                    "type": "tool",
                                    "source": "subagent",
                                    "tool_name": resolved_name,
                                    "subagent_id": sa_id,
                                    "tool_call_id": tool_tc_id,
                                })

                    # (C) Main agent tools node → task ToolMessage → subagent complete
                    if not is_subagent and node_name == "tools":
                        for msg in (node_data or {}).get("messages", []) or []:
                            if getattr(msg, "type", None) != "tool":
                                continue
                            if getattr(msg, "name", None) != "task":
                                continue
                            raw_tc_id = getattr(msg, "tool_call_id", "") or ""
                            tc_id, sa_id = resolve_both_ids(tool_call_id=raw_tc_id)
                            yield send({
                                "type": "subagent_complete",
                                "source": "main",
                                "tool_call_id": tc_id,
                                "subagent_id": sa_id,
                            })

                continue

            # ── Messages mode: text tokens only ──
            if mode == "messages":
                if not chunk_data:
                    continue
                msg, _metadata = chunk_data
                if not isinstance(msg, AIMessageChunk):
                    continue
                if getattr(msg, "tool_call_chunks", None):
                    continue
                content = msg.content or ""
                if not isinstance(content, str) or not content:
                    continue
                content = re.sub(r"\n{3,}", "\n\n", content)
                if not content:
                    continue

                sa_id = ""
                tc_id = ""
                if is_subagent:
                    sa_id = extract_subagent_id(chunk_ns)
                    tc_id, sa_id = resolve_both_ids(subagent_id=sa_id)

                yield send({
                    "type": "ai",
                    "source": "subagent" if is_subagent else "main",
                    "content": content,
                    "subagent_id": sa_id,
                    "tool_call_id": tc_id,
                })

        # Check for errors stored in final state
        try:
            state = await agent.aget_state({"configurable": {"thread_id": conversation_id}})
            msgs = (state.values or {}).get("messages", []) if state else []
            if msgs:
                last_msg = msgs[-1]
                if getattr(last_msg, "type", None) == "ai":
                    text = getattr(last_msg, "content", "")
                    if isinstance(text, str) and "Model call failed" in text:
                        yield send({"type": "error", "source": "main", "content": text})
        except Exception:
            pass

    except Exception as e:
        logger.error("Stream error:", str(e))
        yield send({"type": "error", "source": "main", "content": f"Stream error: {type(e).__name__}: {str(e)[:200]}"})

    yield utils.sse("[DONE]")


# ─── EdgeOne Pages handler ───

async def handler(context):
    conversation_id = getattr(context, "conversation_id", None)
    logger.log("conversationId:", conversation_id, "runId:", getattr(context, "run_id", None))

    body = context.request.body or {}
    action = body.get("action", "chat")

    checkpointer = context.store.langgraph_checkpointer
    store = context.store.langgraph_store

    # ── Delete conversation ──
    if action == "delete":
        thread_id = body.get("conversationId")
        if not thread_id:
            return {"status_code": 400, "body": {"error": "Missing conversationId"}}
        try:
            await checkpointer.adelete_thread(thread_id)
        except Exception:
            pass
        return {"status_code": 200, "body": {"deleted": True}}

    try:
        env = _get_env(context.env)
        model = _get_model(env)
        agent_instance = _get_agent(model, checkpointer, store, context.tools)
    except Exception as e:
        msg = str(e)
        logger.error(msg)
        return {"status_code": 500, "body": {"error": msg}}

    # ── History ──
    if action == "history":
        thread_id = body.get("conversationId")
        logger.log("history request for threadId:", thread_id)
        if not thread_id:
            return {"status_code": 200, "body": {"items": []}}
        try:
            state = await agent_instance.aget_state({"configurable": {"thread_id": thread_id}})
            raw_messages = (state.values or {}).get("messages", []) if state else []

            items = []
            pending_tasks: dict[str, dict] = {}

            for m in raw_messages:
                msg_type = getattr(m, "type", None)

                if msg_type == "human":
                    content = getattr(m, "content", "")
                    if isinstance(content, str) and content:
                        items.append({"type": "user", "content": content})
                    continue

                if msg_type == "ai":
                    content = getattr(m, "content", "")
                    if isinstance(content, str):
                        text_content = content
                    elif isinstance(content, list):
                        text_content = "".join(
                            p.get("text", "") for p in content
                            if isinstance(p, dict) and p.get("type") == "text"
                        )
                    else:
                        text_content = ""

                    for tc in getattr(m, "tool_calls", []) or []:
                        if tc.get("name") == "task" and tc.get("id"):
                            pending_tasks[tc["id"]] = {
                                "description": ((tc.get("args") or {}).get("description", "") or "")[:500],
                                "subagentType": (tc.get("args") or {}).get("subagent_type", "researcher"),
                            }

                    if text_content:
                        items.append({"type": "coordinator", "content": text_content})
                    continue

                if msg_type == "tool":
                    tool_call_id = getattr(m, "tool_call_id", "") or ""
                    tool_name = getattr(m, "name", "") or ""
                    if tool_name == "task" and tool_call_id in pending_tasks:
                        task_info = pending_tasks.pop(tool_call_id)
                        raw_content = getattr(m, "content", "")
                        if isinstance(raw_content, str):
                            result_content = raw_content
                        elif isinstance(raw_content, list):
                            result_content = "\n".join(
                                block.get("text", "") for block in raw_content
                                if isinstance(block, dict) and block.get("type") == "text"
                            )
                        else:
                            result_content = ""
                        items.append({
                            "type": "subagentTask",
                            "id": tool_call_id,
                            "description": task_info["description"],
                            "subagentType": task_info["subagentType"],
                            "content": result_content,
                        })
                    continue

            logger.log("history: found", len(items), "items")
            return {"status_code": 200, "body": {"items": items}}
        except Exception as e:
            logger.error("history error:", str(e))
            return {"status_code": 200, "body": {"items": []}}

    # ── Chat (SSE streaming) ──
    message = body.get("message")
    logger.log("user message:", message)

    if not message:
        return {"status_code": 400, "body": "Missing chat message"}

    async def gen():
        agen = _event_stream(agent_instance, message, conversation_id, context.utils).__aiter__()
        cancel_task = asyncio.ensure_future(context.request.signal.wait())
        pending: asyncio.Task | None = None
        try:
            while True:
                if pending is None:
                    pending = asyncio.ensure_future(agen.__anext__())

                done, _ = await asyncio.wait(
                    {pending, cancel_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )

                if cancel_task in done:
                    logger.log("Stream aborted by user")
                    break

                try:
                    frame = pending.result()
                except StopAsyncIteration:
                    break
                pending = None
                yield frame
        finally:
            if pending is not None and not pending.done():
                pending.cancel()
                try:
                    await pending
                except BaseException:
                    pass
            if not cancel_task.done():
                cancel_task.cancel()
                try:
                    await cancel_task
                except BaseException:
                    pass
            try:
                await agen.aclose()
            except Exception as e:
                logger.error("agen.aclose error:", str(e))

    return context.utils.stream_sse(gen())
