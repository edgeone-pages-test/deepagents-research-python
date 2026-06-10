import type { Translations } from "./types";

export const zh: Translations = {
  appTitle: "Deep Research",
  appSubtitle: "AI 专家研究助手",

  welcomeTitle: "你想研究什么？",
  welcomeSubtitle: "提出一个问题，专家研究团队将为你搜索、分析并汇总答案。",
  presetQuestions: [
    "最近科技圈有什么新闻？",
    "世界上最受欢迎的编程语言有哪些？",
    "React 和 Vue.js 各有什么优劣势？",
    "PostgreSQL、MySQL 和 MongoDB 怎么选？",
  ],

  inputPlaceholder: "输入你想研究的问题…",
  sendButton: "发送",
  stopButton: "停止",
  newChatButton: "返回首页",

  phaseIdle: "就绪",
  phasePlanning: "分析问题中",
  phaseResearching: "研究中",
  phaseSynthesizing: "汇总结论中",
  phaseComplete: "研究完成",

  specialistAgents: "研究员",
  completed: "已完成",
  taskPending: "正在准备研究…",
  taskSummarizing: "研究完成，正在整理结论…",
  taskCancelled: "已取消",
  noContentYet: "等待研究结果…",
  synthesizingResults: "正在汇总研究结论…",
  researchStopped: "研究已停止",

  you: "你",
  coordinator: "首席研究员",

  recentConversations: "近期会话",
  loadingHistory: "加载会话中...",
  deleteConversation: "删除",
};
