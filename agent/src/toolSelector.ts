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
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const selectionRaw = response.choices?.[0]?.message?.content || '{}';
      const selection = this.normalizeSelection(this.safeParse(selectionRaw));

      // Structured logging
      console.log('✓ LLM-based tool selection:');
      console.log(`  → Tool: ${selection.tool}`);
      console.log(`  → Reasoning: ${selection.reasoning}`);
      console.log(`  → Family Context: ${selection.needsFamilyContext ? 'Yes' : 'No'}`);
      console.log(`  → Fetch Members: ${selection.fetchMembers ? 'Yes' : 'No'}`);
      console.log(`  → Fetch Events: ${selection.fetchEvents ? 'Yes' : 'No'}\n`);

      return {
        selectedTool: selection.tool,
        reasoning: selection.reasoning,
        confidence: 0.95,
        parameters: {
          query,
          needsFamilyContext: selection.needsFamilyContext,
          fetchMembers: selection.fetchMembers,
          fetchEvents: selection.fetchEvents
        }
      };
    } catch (error) {
      console.error('❌ LLM tool selection failed, using fallback:', error);
      return this.fallbackSelection(query);
    }
  }

  private buildSystemPrompt(): string {
    return this.dedent`
      You help decide which tool the agent should run. Follow the rules precisely and answer ONLY with JSON.

      TOOLS:
      ${this.availableTools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

      JSON CONTRACT:
      {
        "tool": "answerGeneralQuery" | "getDPOCH",
        "reasoning": "short explanation",
        "fetchMembers": true | false,
        "fetchEvents": true | false,
        "needsFamilyContext": true | false
      }

      CORE RULES:
      1. Default to "answerGeneralQuery" for user questions. It combines MCP data with the model's own knowledge.
      2. Use "getDPOCH" ONLY if the user explicitly asks for DPOCH / oldest birthdate.
      3. NEVER return raw data tools (getFamily/getEvents) directly for conversational answers.
      4. CRITICAL: Achievements, accomplishments, graduations, degrees, and milestones are ALWAYS stored as EVENTS, not in member data. You MUST set fetchEvents=true for these queries.

  FLAG RULES:
  - fetchMembers = true when the question needs MEMBER info (names, birthdates, ages, relationships, "who is" someone, etc.).
  - Also set fetchMembers = true for help/expertise questions ("who should I call", "who can help with", "who would you recommend") even if the word "family" is missing—assume the user wants a family member.
  - fetchEvents = true when the question needs FAMILY event history (graduations, weddings, achievements, accomplishments, milestones, timeline). For "family events" or "events for <person>", set this flag.
  - MANDATORY: If the query contains ANY of these keywords, you MUST set fetchEvents=true: achievement, accomplishment, milestone, graduation, degree, university, college, education, wedding, married, ceremony.
  - For questions about someone's life events (wedding, graduation, achievements), set BOTH fetchMembers (to get relationship context like spouse) AND fetchEvents (to get the event details).
  - World/general history questions do NOT require fetchEvents; the model already knows world events.
  - If a question mixes world + family events, set fetchEvents = true so the agent retrieves family events, and let the model add world events itself.
  - When a specific family member is referenced, set fetchMembers = true (needed for context even if the final answer discusses world topics).
  - needsFamilyContext MUST be true whenever fetchMembers or fetchEvents is true; otherwise false.

      STEP-BY-STEP THINKING:
      1. Identify if the query is about family members, family events, world/general knowledge, or DPOCH.
      2. Choose the correct tool using the core rules.
      3. Decide which family datasets (members/events) must be fetched.
      4. Set needsFamilyContext accordingly (true iff any dataset is fetched).
      5. Reply with the JSON object only.

  EXAMPLES:
  - "What family events do we have?" → answerGeneralQuery, fetchMembers false, fetchEvents true, needsFamilyContext true.
  - "Tell me about world events in 2019." → answerGeneralQuery, all fetch flags false, needsFamilyContext false.
  - "What world events happened when Roy was born?" → answerGeneralQuery, fetchMembers true (to know Roy's birth year), fetchEvents false, needsFamilyContext true.
  - "List the family and world events in 2019." → answerGeneralQuery, fetchMembers false, fetchEvents true, needsFamilyContext true.
  - "If I have a stutter, who should I call?" → answerGeneralQuery, fetchMembers true, fetchEvents false, needsFamilyContext true.
  - "When is Liad's wedding?" → answerGeneralQuery, fetchMembers true (to get spouse info), fetchEvents true (to get wedding date), needsFamilyContext true.
  - "Does Maya have a degree?" → answerGeneralQuery, fetchMembers true (to identify Maya), fetchEvents true (to check graduation events), needsFamilyContext true.
  - "Tell me about Maya's achievements" → answerGeneralQuery, fetchMembers true (to identify Maya), fetchEvents true (achievements are stored as events), needsFamilyContext true.
  - "What has Amit accomplished?" → answerGeneralQuery, fetchMembers true, fetchEvents true (accomplishments are stored as events), needsFamilyContext true.
  - "What is DPOCH?" → getDPOCH, all fetch flags false, needsFamilyContext false.
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

  private normalizeSelection(raw: Record<string, any>): {
    tool: 'answerGeneralQuery' | 'getDPOCH';
    reasoning: string;
    fetchMembers: boolean;
    fetchEvents: boolean;
    needsFamilyContext: boolean;
  } {
    const tool = raw.tool === 'getDPOCH' ? 'getDPOCH' : 'answerGeneralQuery';

    const fetchMembers = Boolean(raw.fetchMembers);
    const fetchEvents = Boolean(raw.fetchEvents);

    const needsFamilyContext = tool === 'getDPOCH'
      ? false
      : Boolean(
          raw.needsFamilyContext !== undefined
            ? raw.needsFamilyContext
            : fetchMembers || fetchEvents
        );

    return {
      tool,
      reasoning: raw.reasoning?.toString().trim() || 'LLM-based selection',
      fetchMembers,
      fetchEvents,
      needsFamilyContext
    };
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
      parameters: {
        query,
        fetchMembers: true,
        fetchEvents: true,
        needsFamilyContext: true
      } // Fetch everything so GPT has maximum context in fallback mode
    };
  }

  /**
   * Get explanation of how tool selection works
   */
  getSelectionStrategy(): string {
    return `
Tool Selection Strategy:
========================

LLM selects tools using explicit JSON contract. Key rules:
- Default tool is answerGeneralQuery (LLM response with optional family context).
- Use getDPOCH only for explicit DPOCH questions.
- fetchMembers flag when people info is needed.
- fetchEvents flag when family event history is needed.
- needsFamilyContext mirrors whether any family data is fetched.

Examples:
- "When was Alon born?" → answerGeneralQuery, fetchMembers=true, fetchEvents=false.
- "What family events do we have?" → answerGeneralQuery, fetchEvents=true.
- "What world events happened when Roy was born?" → answerGeneralQuery, fetchMembers=true.
- "What world events happened in 2019?" → answerGeneralQuery, no family context.
- "What is DPOCH?" → getDPOCH, no family context.

Fallback mode returns answerGeneralQuery with both datasets fetched so GPT can still answer.
    `.trim();
  }
}
