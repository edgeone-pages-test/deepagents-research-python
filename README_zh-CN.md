# Deep Research Agent (Python)

> 基于 Deep Agents 构建的多 Agent 研究助手，部署在 EdgeOne Makers 上。主研究员将问题拆分为子问题，委派给带有 Web 搜索能力的专家子 Agent 并行执行，最后综合输出完整答案。

**Framework:** Deep Agents · **Category:** Quick Start · **Language:** Python

[![Deploy to EdgeOne Makers](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/makers/new?template=deepagents-research-starter-python&from=within&fromAgent=1&agentLang=python)

## 概览

Deep Research Agent 将单个问题转化为多步骤的研究流程。主研究员制定研究计划，并行派发专家子 Agent 进行 Web 搜索，最后综合所有发现输出最终答案——全程实时流式推送到前端。

- **多 Agent 研究** — 协调者将问题拆分为 2-3 个子问题，委派给并行运行的专家子 Agent
- **Web 搜索** — 每个子 Agent 执行多次搜索，从多角度收集信息
- **实时流式输出** — SSE 推送研究计划、子 Agent 进度、工具调用和最终综合内容
- **会话历史** — 通过 LangGraph Checkpointer 持久化研究会话，可从首页历史记录列表恢复
- **中断生成** — 随时中止正在进行的研究，未完成的子 Agent 会被优雅取消

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_GATEWAY_API_KEY` | 是 | 模型网关 API Key。使用 **Makers Models API Key**，或任何 OpenAI 兼容的 Key。 |
| `AI_GATEWAY_BASE_URL` | 是 | 网关地址。Makers Models 使用 `https://ai-gateway.edgeone.link/v1`。 |
| `WSA_API_KEY` | 否 | 腾讯云联网搜索（WSA）API Key，用于平台内置搜索工具的鉴权。 |

> 本模板遵循 **OpenAI 兼容标准**，可对接 Makers Models 或任何兼容的模型网关。

### 如何获取 `AI_GATEWAY_API_KEY`

1. 打开 [Makers 控制台](https://console.cloud.tencent.com/edgeone/makers)。
2. 登录并开通 Makers。
3. 进入 **Makers → 模型 → API Key**，创建一个 Key。
4. 将 Key 填入 `AI_GATEWAY_API_KEY`（`AI_GATEWAY_BASE_URL` 填写 `https://ai-gateway.edgeone.link/v1`）。

内置模型（`@makers/deepseek-v4-flash`、`@makers/hy3-preview`、`@makers/minimax-m2.7`）免费但有频率限制，适合开发验证。生产环境建议在控制台绑定自有模型 Key（BYOK）。

### 如何获取 `WSA_API_KEY`

平台提供了内置的搜索工具，底层调用腾讯云联网搜索 API（Web Search API，WSA）。使用步骤：

1. 在 [腾讯云联网搜索控制台](https://console.cloud.tencent.com/wsapi/index) 开通**联网搜索（WSA）**服务。
2. 获取 API Key 并填入 `WSA_API_KEY`。
3. 详细接入指引参考 [WSA API 文档](https://cloud.tencent.com/document/product/1806/130615)。

> 如果不想使用腾讯云联网搜索 API，也可以自行接入第三方搜索服务（如 [Exa](https://exa.ai/docs/reference/search-api-guide-for-coding-agents)、[Tavily](https://docs.tavily.com/agents) 等），替换 `web_search` 工具实现即可。

## 本地开发

**前置依赖：** Node.js、npm、Python 3.11+

```bash
npm install
cp .env.example .env
edgeone makers dev
```

> CLI 会自动从 `requirements.txt` 安装 Python 依赖。

打开 `http://localhost:8080/agent-metrics` 查看本地可观测面板。

## 项目结构

```text
deepagents-research-python/
├── agents/
│   ├── stream.py          # /stream — 主研究端点（SSE 流式 + 历史 + 删除）
│   ├── stop.py            # /stop — 中止正在进行的研究
│   └── _logger.py         # 共享日志工厂
├── src/
│   ├── components/        # React UI 组件（ChatPage、SubAgentCard 等）
│   ├── hooks/
│   │   ├── useAgentStream.ts  # SSE 流式 Hook + 状态管理
│   │   └── useLanguage.tsx    # 国际化 Context Provider
│   ├── i18n/              # 国际化（en/zh）
│   └── lib/types.ts       # 共享 TypeScript 类型
├── requirements.txt       # Python 依赖
├── edgeone.json           # Agent 运行时配置
└── package.json
```

> 以 `_` 为前缀的文件是私有模块，不会被 EdgeOne 暴露为公开路由。

## 工作原理

Agent 以**会话模式**运行：相同 `conversation_id` 的请求路由到同一实例，状态持久化。

### 工作流

1. **用户提问** — 前端向 `/stream` 发送 POST 请求，携带 `makers-conversation-id` header。
2. **规划** — 主研究员输出 1-2 句研究计划，然后通过 `task` 工具并行派发 2-3 个子问题。
3. **研究** — 每个专家子 Agent 执行多次 Web 搜索，收集数据后撰写摘要。进度通过 SSE 事件流式推送。
4. **综合** — 所有子 Agent 完成后，主研究员综合各方发现，输出最终答案。
5. **完成** — 流结束；对话状态通过 Checkpointer 持久化，支持后续恢复。

### 核心机制

- **Deep Agents + LangGraph**：`create_deep_agent` 构建带子 Agent 编排、中间件（重试）、Checkpointer 和 Store 的 LangGraph 图。
- **v2 流式**：使用 `stream_mode=["updates", "messages"]` + `subgraphs=True` 实现实时事件推送。
- **平台工具**：`web_search` 由 EdgeOne Makers 运行时通过 `context.tools.to_langchain_tools()` 提供。
- **Checkpointer**：对话状态（消息、工具结果）通过 `context.store.langgraph_checkpointer` 持久化，支持历史恢复。

### 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/stream` | POST | 主研究端点（SSE 流式），同时处理 `action: "history"` 和 `action: "delete"` |
| `/stop` | POST | 中止正在进行的研究 |

`conversation_id` 通过 `makers-conversation-id` 请求头传递。

## 相关资源

- [Makers Agents 文档](https://pages.edgeone.ai/document/agents)
- [快速开始：Agent 开发](https://pages.edgeone.ai/document/agents-quickstart)
- [Makers Models](https://pages.edgeone.ai/document/models)

## License

MIT
