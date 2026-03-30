export interface AgentMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  model: string;
  enableMemory: boolean;
  enableSkills: boolean;
  securityLevel: 'low' | 'medium' | 'high';
}

export interface MemoryEntry {
  id: string;
  type: 'working' | 'episodic' | 'semantic';
  content: string;
  embedding?: number[];
  timestamp: Date;
  accessCount: number;
  importance: number;
}

export interface SkillDefinition {
  name: string;
  description: string;
  version: string;
  author: string;
  permissions: string[];
  handler: string;
  parameters?: Record<string, unknown>;
  signature?: string;
}

export interface AgentSession {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  messages: AgentMessage[];
  memory: MemoryEntry[];
  skills: string[];
  config: AgentConfig;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  event: string;
  severity: 'info' | 'warning' | 'critical';
  details: string;
  sourceIp?: string;
  userId?: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  name: 'Brain Frog',
  description: 'An AI agent platform with ReAct reasoning, visible tool execution, and multi-LLM support.',
  systemPrompt: `You are Brain Frog, an AI agent that reasons through problems step by step. You have access to tools (web-search, summarizer, translator, image-generator) and decide when to use them based on the user's request. You also have a hierarchical memory system persisted to SQLite. Always be helpful, accurate, and show your reasoning steps clearly.`,
  temperature: 0.7,
  maxTokens: 4096,
  model: 'default',
  enableMemory: true,
  enableSkills: true,
  securityLevel: 'high',
};
