import OpenAI from 'openai';
import { FamilyMCPClient } from '../familyMCPClient';
import { AnswerGenerator } from '../answerGenerator';
import { AgentIteration, AgentState, MultiPassAgentResponse } from '../types';

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
    }
  }

  setOnIterationCallback(callback: (iteration: AgentIteration) => void): void {
    this.onIterationCallback = callback;
  }

  async processQuery(query: string, conversationHistory: any[] = []): Promise<MultiPassAgentResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API key not provided');
    }

    const state: AgentState = {
      query,
      conversationHistory,
      iterations: [],
      workingMemory: new Map(),
      isComplete: false,
      finalAnswer: '',
      maxIterations: this.maxIterations,
      currentIteration: 0
    };

    while (!state.isComplete && state.currentIteration < state.maxIterations) {
      state.currentIteration++;

      const thought = await this.think(state);
      const actionResult = await this.selectAction(state, thought);
      const observation = await this.executeAction(actionResult.action, actionResult.actionInput, state);

      const iteration: AgentIteration = {
        iterationNumber: state.currentIteration,
        thought,
        action: actionResult.action,
        actionInput: actionResult.actionInput,
        observation,
        timestamp: new Date()
      };

      state.iterations.push(iteration);

      if (this.onIterationCallback) {
        this.onIterationCallback(iteration);
      }

      if (actionResult.action === 'FINISH') {
        state.isComplete = true;
        state.finalAnswer = observation;
      }
    }

    if (!state.isComplete) {
      state.finalAnswer = await this.generateFinalAnswer(state);
      state.isComplete = true;
    }

    const executionTime = 0; // We don't track execution time in multi-pass yet
    const finalAnswer = state.finalAnswer || 'No answer generated';

    return {
      query: state.query,
      selectedTool: 'MultiPassAgent',
      reasoning: state.iterations.map(i => i.thought).join(' → '),
      result: {
        answer: finalAnswer,
        metadata: {
          toolName: 'MultiPassAgent'
        }
      },
      executionTime,
      iterations: state.iterations,
      totalIterations: state.currentIteration,
      reasoningSteps: state.iterations.map(i => i.thought)
    };
  }

  private async think(state: AgentState): Promise<string> {
    const memoryContext = this.formatMemory(state.workingMemory);
    
    const prompt = `Analyze this family data query.

QUERY: "${state.query}"
ITERATION: ${state.currentIteration} of ${state.maxIterations}

WHAT YOU KNOW:
${memoryContext || 'Nothing yet'}

Think: What specific information do you need to answer this query? Be brief.`;

    const response = await this.openai!.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 120
    });

    return response.choices[0].message.content || 'Analyzing...';
  }

  private async selectAction(state: AgentState, thought: string): Promise<{ action: string; actionInput: any }> {
    const memoryContext = this.formatMemory(state.workingMemory);
    
    const prompt = `Choose ONE action:

ACTIONS:
- getFamily: Get all members (use {})
- getEvents: Get events for person (use {"name": "Name"})
- getDPOCH: Get oldest birthdate
- FINISH: Answer with what you have

KNOWN:
${memoryContext || 'Nothing'}

THOUGHT: ${thought}

RULES:
- Can answer? → FINISH
- Need birthdates? → getFamily
- Need events? → getEvents
- Don't repeat actions

JSON only:
{"action": "getFamily", "input": {}}`;

    const response = await this.openai!.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 60
    });

    const content = response.choices[0].message.content || '{"action": "FINISH", "input": {}}';
    
    try {
      const parsed = JSON.parse(content);
      return { action: parsed.action, actionInput: parsed.input };
    } catch {
      return { action: 'FINISH', actionInput: {} };
    }
  }

  private async executeAction(action: string, input: any, state: AgentState): Promise<string> {
    try {
      if (action === 'FINISH') {
        return await this.generateFinalAnswer(state);
      }

      if (action === 'getFamily') {
        const result = await this.mcpClient.getFamily();
        const members = result.data || [];
        state.workingMemory.set('familyMembers', members);
        const sample = members.slice(0, 2).map((m: any) => `${m.name} (${m.birthdate})`).join(', ');
        return `Got ${members.length} members: ${sample}...`;
      }

      if (action === 'getEvents') {
        const name = input.name;
        if (!name) return 'ERROR: Need name';
        
        const result = await this.mcpClient.getEvents(name);
        const events = result.data?.events || [];
        state.workingMemory.set(`events_${name}`, events);
        
        if (events.length === 0) return `No events for ${name}`;
        
        const list = events.map((e: any) => `${e.type} (${e.date})`).join(', ');
        return `${name}: ${list}`;
      }

      if (action === 'getDPOCH') {
        const result = await this.mcpClient.getDPOCH();
        const dpoch = result.data;
        state.workingMemory.set('dpoch', dpoch);
        return `DPOCH: ${dpoch}`;
      }

      return `Unknown: ${action}`;
    } catch (error: any) {
      return `ERROR: ${error.message}`;
    }
  }

  private async generateFinalAnswer(state: AgentState): Promise<string> {
    const context: any = {};
    
    if (state.workingMemory.has('familyMembers')) {
      context.members = state.workingMemory.get('familyMembers');
    }
    
    const allEvents: any[] = [];
    for (const [key, value] of state.workingMemory.entries()) {
      if (key.startsWith('events_')) {
        allEvents.push(...value);
      }
    }
    if (allEvents.length > 0) {
      context.events = { events: allEvents };
    }
    
    if (state.workingMemory.has('dpoch')) {
      context.dpoch = state.workingMemory.get('dpoch');
    }

    const result = await this.answerGenerator.answerGeneralQuery(state.query, context, state.conversationHistory);
    
    // Extract the answer string from the result
    return result.data?.answer || result.error || 'Unable to generate answer';
  }

  private formatMemory(memory: Map<string, any>): string {
    if (memory.size === 0) return '';

    const parts: string[] = [];
    
    if (memory.has('familyMembers')) {
      const members = memory.get('familyMembers');
      parts.push(`FAMILY MEMBERS (${members.length}):`);
      members.forEach((m: any) => {
        parts.push(`  - ${m.name}: born ${m.birthdate}, role: ${m.role}`);
      });
    }
    
    for (const [key, value] of memory.entries()) {
      if (key.startsWith('events_')) {
        const name = key.replace('events_', '');
        parts.push(`\nEVENTS FOR ${name.toUpperCase()}:`);
        if (value.length === 0) {
          parts.push(`  - No events found`);
        } else {
          value.forEach((e: any) => {
            parts.push(`  - ${e.type} on ${e.date}`);
          });
        }
      }
    }
    
    if (memory.has('dpoch')) {
      parts.push(`\nDPOCH: ${memory.get('dpoch')}`);
    }
    
    return parts.join('\n');
  }
}