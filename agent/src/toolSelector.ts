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
      // Build a focused system prompt (extracted for readability)
      const systemPrompt = this.buildSystemPrompt();

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const selectionRaw = response.choices?.[0]?.message?.content || '{}';
      const selection = this.safeParse(selectionRaw);

      // Structured logging
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

  private buildSystemPrompt(): string {
    return this.dedent`
      You are a tool selection assistant for an AI agent that has access to a family database via MCP server.

      Available tools:
      ${this.availableTools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

      FAMILY DATABASE:
      The database has two types of data:
      - MEMBER DATA: Basic info (names, birthdates, roles, relationships, occupations)
      - EVENT DATA: Life events (graduations, weddings, achievements, etc.)
      - DPOCH: The oldest birthdate in the database (special query)

      TOOL SELECTION:
      - ALWAYS use "answerGeneralQuery" for natural language questions (it will fetch needed data automatically)
      - ONLY use direct MCP tools (getDPOCH, getEvents, getFamily) if explicitly building a tool/API (rare)
      - For user questions → "answerGeneralQuery" + specify what data to fetch (fetchMembers/fetchEvents)

      YOUR JOB:
      Analyze the query and decide what data is needed to answer it.

      GUIDELINES:
      - Questions about people, ages, relationships → need MEMBER DATA (fetchMembers: true)
      - Questions about FAMILY events/achievements (graduations, weddings, etc.) → need EVENT DATA (fetchEvents: true)
      - Questions about WORLD events → use GPT's general knowledge (fetchEvents: false)
      - If the query mentions BOTH world and family events → fetchEvents: true (GPT will handle world events from its knowledge)
      - Some questions need BOTH types of data to answer fully
      - Questions that REFERENCE family members but ask about OTHER topics → still fetch family data as context
      - Pure general knowledge questions (no family reference) → no data needed
      - DPOCH queries → use the "getDPOCH" tool directly

      EXAMPLES:
      "When was Agam born?" → tool: "answerGeneralQuery", fetchMembers: true, fetchEvents: false
      "Does Maya have a degree?" → tool: "answerGeneralQuery", fetchMembers: true, fetchEvents: true
      "How old is Alon?" → tool: "answerGeneralQuery", fetchMembers: true, fetchEvents: false
      "What world events happened when Roy was born?" → tool: "answerGeneralQuery", fetchMembers: true, fetchEvents: false
      "What family events happened in 2019?" → tool: "answerGeneralQuery", fetchMembers: false, fetchEvents: true
      "What world and family events happened in 2019?" → tool: "answerGeneralQuery", fetchMembers: false, fetchEvents: true
      "What is AI?" → tool: "answerGeneralQuery", fetchMembers: false, fetchEvents: false
      "What is DPOCH?" → tool: "getDPOCH"

      Respond in JSON format: 
      {
        "tool": "answerGeneralQuery" | "getDPOCH", 
        "reasoning": "why", 
        "needsFamilyContext": true/false,
        "fetchMembers": true/false,
        "fetchEvents": true/false
      }
    `;
  }

  private dedent(strings: TemplateStringsArray, ...values: any[]): string {
    // Combine strings and values
    let full = strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ''), '');

    // Trim leading/trailing blank lines
    full = full.replace(/^\n+/, '').replace(/\n+$/, '');

    const lines = full.split('\n');
    // Calculate minimum indentation (ignore empty lines)
    let minIndent: number | null = null;
    for (const line of lines) {
      if (/^\s*$/.test(line)) continue;
      const match = line.match(/^\s*/);
      const indent = match ? match[0].length : 0;
      minIndent = minIndent === null ? indent : Math.min(minIndent, indent);
    }

    if (minIndent && minIndent > 0) {
      return lines.map((l) => l.slice(minIndent as number)).join('\n');
    }
    return lines.join('\n');
  }

  private safeParse(raw: string): Record<string, any> {
    try {
      return JSON.parse(raw);
    } catch {
      console.warn('⚠️  Failed to parse selection response, returning empty object');
      return {};
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
