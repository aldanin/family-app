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

/**
 * Unified response structure for all agent queries
 */
export interface AgentResponse {
  query: string;
  selectedTool: string;
  reasoning: string;
  result: UnifiedResult;
  executionTime: number;
}

/**
 * Unified result format - all tools return this structure
 */
export interface UnifiedResult {
  // The main answer/content (always present)
  answer: string;
  
  // Original data from the tool (optional, for advanced use)
  rawData?: any;
  
  // Metadata
  metadata?: {
    toolName?: string;
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    hasContext?: boolean;
    eventCount?: number;
    personName?: string;
    memberCount?: number;
  };
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

export interface DPOCHResponse {
  dpoch: string;
  description: string;
}

/**
 * ReACT Multi-Pass Agent Types
 */

export interface AgentIteration {
  iterationNumber: number;
  thought: string;           // Agent's reasoning about what to do
  action: string;            // Tool/action selected (or "FINISH")
  actionInput?: any;         // Parameters for the tool
  observation: string;       // Result from executing the action
  timestamp: Date;
}

export interface AgentState {
  query: string;
  conversationHistory: Array<{role: string, content: string}>;
  iterations: AgentIteration[];
  workingMemory: Map<string, any>;  // Data collected across iterations
  isComplete: boolean;
  finalAnswer?: string;
  maxIterations: number;
  currentIteration: number;
}

/**
 * Updated response to include multi-pass iterations
 */
export interface MultiPassAgentResponse extends AgentResponse {
  iterations: AgentIteration[];
  totalIterations: number;
  reasoningSteps: string[];  // Summary of thinking at each step
}

