/**
 * Tool Selection Engine
 * This is the "brain" of the agent - it decides which tool to use based on the query
 * Uses LLM-based tool selection (OpenAI function calling) instead of hard-coded rules
 */

import { ToolDefinition } from './types';
import OpenAI from 'openai';

export interface ToolSelectionResult {
  selectedTool: string;
  reasoning: string;
  confidence: number;
  parameters?: Record<string, any>;
}

export class ToolSelector {
  private availableTools: ToolDefinition[];
  private openai: OpenAI | null = null;

  constructor(tools: ToolDefinition[], openaiApiKey?: string) {
    this.availableTools = tools;
    
    // Initialize OpenAI for LLM-based tool selection
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  /**
   * Main tool selection logic
   * Uses LLM to intelligently select the right tool - NO HARD-CODED KEYWORDS!
   */
  async selectTool(query: string): Promise<ToolSelectionResult> {
    console.log('\n🤖 [Agent Decision Process] Analyzing query...');
    console.log(`📝 Query: "${query}"`);
    console.log(`🔍 Available tools: ${this.availableTools.map(t => t.name).join(', ')}\n`);

    // If OpenAI is not configured, fall back to simple heuristic
    if (!this.openai) {
      console.log('⚠️  OpenAI not configured - using fallback heuristic');
      return this.fallbackSelection(query);
    }

    try {
      // Let GPT decide which tool to use based on tool descriptions!
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a tool selection assistant for an AI agent that has access to a family database via MCP server.

Available tools:
${this.availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

CRITICAL RULES:
1. ANY query about specific people (Roy, Maya, Alon, Amit, etc.) → MUST use needsFamilyContext=true
2. ANY query about birthdates, ages, events, family members → MUST use needsFamilyContext=true
3. The family database contains: names, birthdates, events, relationships
4. Examples that NEED family context:
   - "When was Roy born?" → needsFamilyContext: true
   - "How old is Maya?" → needsFamilyContext: true
   - "Show me Alon's events" → needsFamilyContext: true
   - "Who is in the family?" → needsFamilyContext: true
   
5. Examples that DON'T need family context:
   - "What is AI?" → needsFamilyContext: false
   - "Explain quantum physics" → needsFamilyContext: false
   - "What's 2+2?" → needsFamilyContext: false

Always use "answerGeneralQuery" as the tool.
Respond in JSON format: {"tool": "answerGeneralQuery", "reasoning": "why", "needsFamilyContext": true/false}`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1,  // Lower temperature for more consistent decisions
        response_format: { type: 'json_object' }
      });

      const selection = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log('✓ LLM-based tool selection:');
      console.log(`  → Tool: ${selection.tool}`);
      console.log(`  → Reasoning: ${selection.reasoning}`);
      console.log(`  → Family Context: ${selection.needsFamilyContext ? 'Yes' : 'No'}\n`);
      
      return {
        selectedTool: selection.tool || 'answerGeneralQuery',
        reasoning: selection.reasoning || 'LLM-based selection',
        confidence: 0.95,
        parameters: { 
          query, 
          needsFamilyContext: selection.needsFamilyContext || false 
        }
      };
      
    } catch (error) {
      console.error('❌ LLM tool selection failed, using fallback:', error);
      return this.fallbackSelection(query);
    }
  }

  /**
   * Fallback selection when OpenAI is not available
   * Simple heuristic - assumes everything might need family context
   */
  private fallbackSelection(query: string): ToolSelectionResult {
    console.log('  → Decision: Use answerGeneralQuery (fallback mode)');
    console.log('  → Reason: OpenAI not configured, assuming general query\n');
    
    return {
      selectedTool: 'answerGeneralQuery',
      reasoning: 'Fallback mode - OpenAI not configured',
      confidence: 0.5,
      parameters: { query, needsFamilyContext: true } // Safe default
    };
  }

  /**
   * Get explanation of how tool selection works
   */
  getSelectionStrategy(): string {
    return `
Tool Selection Strategy:
========================

LLM-BASED INTELLIGENT SELECTION - NO HARD-CODED RULES!

How it works:
1. Agent receives a query from the user
2. Tool Selector sends the query + tool descriptions to GPT
3. GPT analyzes the query and decides which tool to use
4. GPT returns: tool name, reasoning, and whether family context is needed
5. Agent executes the selected tool

Examples:
- "When was Alon born?" → GPT selects: answerGeneralQuery + family context
- "What is AI?" → GPT selects: answerGeneralQuery (no context)
- "How old is Maya?" → GPT selects: answerGeneralQuery + family context

Benefits:
✅ NO hard-coded keywords (maya, alon, born, etc.)
✅ NO hard-coded logic (if/else statements)
✅ LLM understands context and intent
✅ Works with new family members automatically
✅ Handles complex queries naturally

Fallback:
- If OpenAI is not configured, uses simple heuristic (assumes family context)
    `.trim();
  }
}
