export type Locale = "en" | "zh";

export interface Translations {
  appTitle: string;
  appSubtitle: string;

  welcomeTitle: string;
  welcomeSubtitle: string;
  presetQuestions: string[];

  inputPlaceholder: string;
  sendButton: string;
  stopButton: string;
  newChatButton: string;

  phaseIdle: string;
  phasePlanning: string;
  phaseResearching: string;
  phaseSynthesizing: string;
  phaseComplete: string;

  specialistAgents: string;
  completed: string;
  taskPending: string;
  taskSummarizing: string;
  taskCancelled: string;
  noContentYet: string;
  synthesizingResults: string;
  researchStopped: string;

  you: string;
  coordinator: string;

  recentConversations: string;
  loadingHistory: string;
  deleteConversation: string;
}
