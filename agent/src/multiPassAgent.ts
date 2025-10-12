/**
 * Multi-Pass ReACT Agent
 * 
 * Uses the ReACT pattern (Reasoning + Acting) for iterative problem solving:
 * 
 * LOOP (max 5 iterations):
 *   1. THOUGHT: Agent reasons about what it knows and what to do next
 *   2. ACTION: Select a tool to use (or FINISH if done)
 *   3. OBSERVATION: Execute tool and observe results
 *   4. Update working memory
 *   5. Repeat or finish
 * 
 * This allows the agent to:
 * - Gather data from multiple sources
 * - Reason about intermediate results
 * - Handle complex multi-step queries
 * - Be transparent about its thinking process
 */

import OpenAI from 'openai';
import { FamilyMCPClient } from './familyMCPClient';
import { AnswerGenerator } from './answerGenerator';
import { 
  AgentState, 
  AgentIteration, 
  MultiPassAgentResponse,
  ToolResult 
} from './types';

export class MultiPassAgent {
  private mcpClient: FamilyMCPClient;
  private answerGenerator: AnswerGenerator;
  private openai: OpenAI | null = null;
  private model: string;
  private maxIterations: number = 5;
  private onIterationCallback?: (iteration: AgentIteration) => void;

  constructor(
    mcpServerUrl: string,
    openaiApiKey?: string,
    openaiModel: string = 'gpt-4o-mini',
    maxIterations: number = 5
  ) {
    this.mcpClient = new FamilyMCPClient(mcpServerUrl);
    this.answerGenerator = new AnswerGenerator(openaiApiKey, openaiModel);
    this.model = openaiModel;
    this.maxIterations = maxIterations;

    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
      console.log(`✅ Multi-Pass Agent initialized with model: ${openaiModel}`);
    } else {
      console.log('⚠️  Multi-Pass Agent: OpenAI API key not provided. Limited functionality.');
    }
  }

  /**
   * Set callback for iteration updates (for streaming)
   */
  setOnIterationCallback(callback: (iteration: AgentIteration) => void) {
    this.onIterationCallback = callback;
  }

  /**
   * Process a query using multi-pass ReACT loop
   */
  async processQuery(
    query: string,
    conversationHistory: Array<{role: string, content: string}> = []
  ): Promise<MultiPassAgentResponse> {
    const startTime = Date.now();
    
    console.log('\n' + '═'.repeat(80));
    console.log('🔄 MULTI-PASS REACT AGENT');
    console.log('═'.repeat(80));
    console.log(`📝 Query: "${query}"`);
    console.log(`🔢 Max Iterations: ${this.maxIterations}`);
    console.log('═'.repeat(80) + '\n');

    // Initialize agent state
    const state: AgentState = {
      query,
      conversationHistory,
      iterations: [],
      workingMemory: new Map(),
      isComplete: false,
      finalAnswer: undefined,
      maxIterations: this.maxIterations,
      currentIteration: 0
    };

    // ReACT Loop
    while (!state.isComplete && state.currentIteration < state.maxIterations) {
      state.currentIteration++;
      
      console.log(`\n┌─ ITERATION ${state.currentIteration}/${state.maxIterations} ─────────────────────────────────────────┐`);
      
      // Step 1: THOUGHT - Agent reasons about what to do
      const thought = await this.think(state);
      console.log(`│ 💭 THOUGHT: ${thought.substring(0, 70)}...`);
      
      // Step 2: ACTION - Agent decides which tool to use
      const action = await this.selectAction(state, thought);
      console.log(`│ 🎯 ACTION: ${action.action}`);
      if (action.actionInput) {
        console.log(`│ 📋 INPUT: ${JSON.stringify(action.actionInput)}`);
      }
      
      // Step 3: OBSERVATION - Execute the action
      const observation = await this.executeAction(action.action, action.actionInput, state);
      console.log(`│ 👁️  OBSERVATION: ${observation.substring(0, 60)}...`);
      
      // Record this iteration
      const iteration: AgentIteration = {
        iterationNumber: state.currentIteration,
        thought,
        action: action.action,
        actionInput: action.actionInput,
        observation,
        timestamp: new Date()
      };
      state.iterations.push(iteration);
      
      // Emit iteration update if callback is set (for streaming)
      if (this.onIterationCallback) {
        this.onIterationCallback(iteration);
      }
      
      // Check if agent decided to finish
      if (action.action === 'FINISH') {
        state.isComplete = true;
        state.finalAnswer = observation;
        console.log(`│ ✅ STATUS: COMPLETE`);
      }
      
      console.log(`└────────────────────────────────────────────────────────────┘`);
    }

    // If max iterations reached without finishing, generate final answer
    if (!state.isComplete) {
      console.log(`\n⚠️  Max iterations (${this.maxIterations}) reached. Generating final answer...\n`);
      state.finalAnswer = await this.generateFinalAnswer(state);
    }

    const executionTime = Date.now() - startTime;
    
    console.log('\n' + '═'.repeat(80));
    console.log(`✅ COMPLETE - ${state.iterations.length} iterations in ${executionTime}ms`);
    console.log('═'.repeat(80) + '\n');

    return {
      query,
      selectedTool: 'MultiPassAgent',
      reasoning: state.iterations.map(i => i.thought).join(' → '),
      result: {
        answer: state.finalAnswer || 'Unable to generate answer',
        rawData: Object.fromEntries(state.workingMemory),
        metadata: {
          toolName: 'MultiPassAgent',
          model: this.model
        }
      },
      executionTime,
      iterations: state.iterations,
      totalIterations: state.iterations.length,
      reasoningSteps: state.iterations.map(i => `[${i.action}] ${i.thought}`)
    };
  }

  /**
   * THOUGHT Phase: Agent reasons about current state and what to do next
   */
  private async think(state: AgentState): Promise<string> {
    if (!this.openai) {
      return "Proceeding with next action (OpenAI not configured for reasoning)";
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a reasoning agent. Analyze the current state and think about what to do next.

Your goal: Answer the user's query EFFICIENTLY by gathering ONLY necessary information.

Available tools:
- getFamily: Get family member data (name, birthdate, role, etc.)
- getEvents: Get events for a specific person
- getDPOCH: Get the oldest birthdate epoch (ONLY use when query explicitly asks about DPOCH or relative time calculations)
- FINISH: When you have all info needed to answer

IMPORTANT EFFICIENCY RULES:
1. For simple factual queries (e.g., "when was X born", "who is X"), use ONLY getFamily
2. ONLY use getDPOCH if the query explicitly mentions DPOCH or asks "how long after DPOCH"
3. ONLY use getEvents if the query asks about events, achievements, or timeline
4. If you already have the answer in working memory, use FINISH immediately
5. Minimize tool calls - think "what's the MINIMUM I need to answer this?"

Think step by step:
1. What EXACTLY is the user asking for?
2. Do I already have this information in working memory?
3. What is the MINIMUM action needed to answer?

Be concise but thorough in your reasoning.`
      },
      {
        role: 'user',
        content: `Query: "${state.query}"

Previous iterations:
${state.iterations.map(i => `- ${i.action}: ${i.observation.substring(0, 100)}`).join('\n') || 'None yet'}

Working memory:
${Array.from(state.workingMemory.entries()).map(([k, v]) => `- ${k}: ${JSON.stringify(v).substring(0, 100)}`).join('\n') || 'Empty'}

What should I do next? Think step by step.`
      }
    ];

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.3,
      max_tokens: 200
    });

    return completion.choices[0]?.message?.content || 'Continue with next action';
  }

  /**
   * ACTION Phase: Based on reasoning, select which tool to use
   */
  private async selectAction(
    state: AgentState, 
    thought: string
  ): Promise<{ action: string; actionInput?: any }> {
    if (!this.openai) {
      // Fallback: simple rule-based selection
      return { action: 'FINISH' };
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are an action selector. Based on the reasoning, choose the MOST EFFICIENT next action.

Available actions:
- getFamily [name?: string] - Get family member(s) data (includes birthdate, role, relationships, occupation)
- getEvents [name: string] - Get events for a person (only use if query asks about events/achievements)
- getDPOCH - Get oldest birthdate epoch (ONLY use if query explicitly mentions DPOCH or asks relative time)
- FINISH - When ready to answer (use as soon as you have sufficient data)

EFFICIENCY GUIDELINES:
- For "when was X born" → ONLY use getFamily, then FINISH
- For "who is X" → ONLY use getFamily, then FINISH  
- For "what are X's events" → use getFamily first, then getEvents if needed, then FINISH
- For "how long after DPOCH" → use getDPOCH AND getFamily/getEvents, then FINISH
- NEVER call getDPOCH unless the query explicitly requires it

Respond with JSON only:
{"action": "actionName", "actionInput": {...}} 

or for FINISH:
{"action": "FINISH"}`
      },
      {
        role: 'user',
        content: `Query: "${state.query}"

Reasoning: ${thought}

Select the next action (JSON only):`
      }
    ];

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.1,
      max_tokens: 100
    });

    const response = completion.choices[0]?.message?.content || '{"action": "FINISH"}';
    
    try {
      return JSON.parse(response);
    } catch (e) {
      console.warn('Failed to parse action JSON, defaulting to FINISH');
      return { action: 'FINISH' };
    }
  }

  /**
   * OBSERVATION Phase: Execute the selected action and observe results
   */
  private async executeAction(
    action: string, 
    actionInput: any,
    state: AgentState
  ): Promise<string> {
    try {
      switch (action) {
        case 'getFamily': {
          const result = await this.mcpClient.getFamily(actionInput?.name);
          const members = result.data?.members || [];
          state.workingMemory.set('familyMembers', members);
          return `Found ${members.length} family member(s). Data stored in working memory.`;
        }

        case 'getEvents': {
          const name = actionInput?.name;
          if (!name) {
            return 'Error: name parameter required for getEvents';
          }
          const result = await this.mcpClient.getEvents(name);
          const events = result.data?.events || [];
          state.workingMemory.set(`events_${name}`, events);
          return `Found ${events.length} event(s) for ${name}. Data stored in working memory.`;
        }

        case 'getDPOCH': {
          const result = await this.mcpClient.getDPOCH();
          console.log('🔍 getDPOCH result:', JSON.stringify(result, null, 2));
          
          const dpoch = result.data?.dpoch;
          
          if (!dpoch && dpoch !== 0) {
            return `Error: Could not retrieve DPOCH value. Response: ${JSON.stringify(result)}`;
          }
          
          state.workingMemory.set('dpoch', dpoch);
          
          // Convert EPOCH to human-readable date for context
          const date = new Date(Number(dpoch) * 1000);
          const dateStr = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          
          return `DPOCH value retrieved: ${dpoch} (which is ${dateStr}). Data stored in working memory.`;
        }

        case 'FINISH': {
          // Generate final answer using all collected data
          return await this.generateFinalAnswer(state);
        }

        default:
          return `Unknown action: ${action}`;
      }
    } catch (error) {
      return `Error executing ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Generate final answer using all collected data
   */
  private async generateFinalAnswer(state: AgentState): Promise<string> {
    // Build context from working memory
    const context: any = {
      members: state.workingMemory.get('familyMembers'),
      events: {}
    };

    // Collect all events
    for (const [key, value] of state.workingMemory.entries()) {
      if (key.startsWith('events_')) {
        const personName = key.replace('events_', '');
        context.events[personName] = value;
      }
    }

    // Flatten events for answerGenerator
    if (Object.keys(context.events).length > 0) {
      context.events = {
        events: Object.values(context.events).flat()
      };
    }

    // Use AnswerGenerator to create natural language response
    const result = await this.answerGenerator.answerGeneralQuery(
      state.query,
      context,
      state.conversationHistory
    );

    return result.data?.answer || 'Unable to generate answer';
  }
}
