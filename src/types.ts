// Type definitions for Dark Sun Assistant

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  title: string;
  created: Date;
  updated: Date;
  messages: Message[];
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  conversationId: string;
  message: Message;
  mcpResponses?: any[];
}

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  mcpServers: {
    name: string;
    status: 'connected' | 'disconnected' | 'error';
  }[];
}
