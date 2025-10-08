/**
 * Core types and interfaces for the AI Agent
 */

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'family' | 'general' | 'utility';
  parameters?: Record<string, any>;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  reasoning?: string;
}

export interface AgentQuery {
  query: string;
  context?: Record<string, any>;
}

export interface AgentResponse {
  query: string;
  selectedTool: string;
  reasoning: string;
  result: any;
  executionTime: number;
}

export interface FamilyEvent {
  event_date: string;
  event_type: string;
  name: string;
  event_epoch: string;
}

export interface FamilyEventsResponse {
  name: string;
  refDate: string;
  events: FamilyEvent[];
  count: number;
}

export interface DPOCResponse {
  dpoc: string;
  description: string;
}
