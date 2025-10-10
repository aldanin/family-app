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

FAMILY DATABASE STRUCTURE:
1. MEMBER DATA: names, birthdates, roles, relationships (father, mother, spouse), occupations
2. EVENT DATA: graduations, weddings, achievements, timeline events
3. DPOCH (Date Point Of Commencement): The oldest birthdate in the family database (special query)

YOUR JOB: Decide which tool and what data to fetch for the query.

TOOL SELECTION RULES:
- Most queries → "answerGeneralQuery" (default)
- "What is DPOCH?" or "Tell me about DPOCH" → "getDPOCH" tool
- General knowledge (not family) → "answerGeneralQuery" without context

DATA FETCHING RULES:
1. If query asks about PEOPLE, AGES, BIRTHDATES, RELATIONSHIPS, OCCUPATIONS → fetchMembers: true
2. If query asks about EVENTS, GRADUATIONS, WEDDINGS, ACHIEVEMENTS, DEGREES, TIMELINE → fetchEvents: true
3. Many queries need BOTH! Examples:
   - "Does Maya have a degree?" → fetchMembers: true, fetchEvents: true (degree is in events)
   - "How old is Maya?" → fetchMembers: true, fetchEvents: false (age from birthdate)
   - "When did Roy graduate?" → fetchMembers: true, fetchEvents: true (both needed)
   - "Tell me about Alon" → fetchMembers: true, fetchEvents: true (complete profile)
   - "What is DPOCH?" → Use "getDPOCH" tool, fetchMembers: false, fetchEvents: false
   - "Do you know what DPOCH is?" → Use "getDPOCH" tool, explain it's the oldest birthdate

4. For general knowledge (not family) → fetchMembers: false, fetchEvents: false

Respond in JSON format: 
{
  "tool": "answerGeneralQuery" | "getDPOCH", 
  "reasoning": "why", 
  "needsFamilyContext": true/false,
  "fetchMembers": true/false,
  "fetchEvents": true/false
}`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const selection = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log('✓ LLM-based tool selection:');
      console.log(`  → Tool: ${selection.tool}`);
      console.log(`  → Reasoning: ${selection.reasoning}`);
      console.log(`  → Family Context: ${selection.needsFamilyContext ? 'Yes' : 'No'}`);
      console.log(`  → Fetch Members: ${selection.fetchMembers ? 'Yes' : 'No'}`);
      console.log(`  → Fetch Events: ${selection.fetchEvents ? 'Yes' : 'No'}\n`);
      
      return {
        selectedTool: selection.tool || 'answerGeneralQuery',
        reasoning: selection.reasoning || 'LLM-based selection',
        confidence: 0.95,
        parameters: { 
          query, 
          needsFamilyContext: selection.needsFamilyContext || false,
          fetchMembers: selection.fetchMembers || false,
          fetchEvents: selection.fetchEvents || false
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
