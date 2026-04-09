import { FamilyMCPClient } from '../familyMCPClient';
import { AnswerGenerator } from '../answerGenerator';
import { AgentIteration, AgentState, MultiPassAgentResponse } from '../types';
import { EmbeddingStore, EmbeddingEntry } from '../embeddingStore';

type AgentAction = 'getFamily' | 'getEvents' | 'FINISH';

interface QueryInsights {
  normalized: string;
  mentionsFamily: boolean;
  needsEvents: boolean;
  referencedNames: Set<string>;
  keywords: string[];
}

interface PlannedStep {
  thought: string;
  action: AgentAction;
  input?: any;
}

const EVENT_KEYWORDS = [
  'wedding',
  'wed',
  'wedded',
  'married',
  'marriage',
  'marry',
  'ceremony',
  'anniversary',
  'attended',
  'guest',
  'celebration',
  'graduation',
  'graduated',
  'graduate',
  'degree',
  'achievement',
  'accomplish',
  'milestone'
];

const FAMILY_KEYWORDS = [
  'family',
  'relative',
  'dad',
  'mom',
  'mother',
  'father',
  'sister',
  'brother',
  'cousin',
  'aunt',
  'uncle',
  'grand',
  'children',
  'kids',
  'son',
  'daughter',
  'who in my family',
  'how many people are in my family'
];

const DEFAULT_SIMILARITY_THRESHOLD = 0.25;

export class MultiPassAgent {
  private mcpClient: FamilyMCPClient;
  private answerGenerator: AnswerGenerator;
  private embeddingStore: EmbeddingStore;
  private maxIterations: number;
  private onIterationCallback?: (iteration: AgentIteration) => void;

  constructor(
    mcpServerUrl: string,
    openaiApiKey?: string,
    openaiModel: string = 'gpt-5.4-mini',
    maxIterations: number = 5,
    embeddingPath?: string
  ) {
    this.mcpClient = new FamilyMCPClient(mcpServerUrl);
    this.answerGenerator = new AnswerGenerator(openaiApiKey, openaiModel);
    this.embeddingStore = new EmbeddingStore(embeddingPath);
    this.maxIterations = maxIterations;
  }

  setOnIterationCallback(callback: (iteration: AgentIteration) => void): void {
    this.onIterationCallback = callback;
  }

  async processQuery(query: string, conversationHistory: any[] = []): Promise<MultiPassAgentResponse> {
    const startedAt = Date.now();
    const insights = this.analyzeQuery(query);
    const embeddingResults = await this.lookupSemanticMemories(query);

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

    if (embeddingResults.length > 0) {
      state.workingMemory.set('embeddings', embeddingResults.map((entry) => entry.text));
    }

    while (!state.isComplete && state.currentIteration < state.maxIterations) {
      state.currentIteration += 1;

      const step = this.planNextStep(state, insights);
      const observation = await this.executeStep(step, state, insights);

      const iteration: AgentIteration = {
        iterationNumber: state.currentIteration,
        thought: step.thought,
        action: step.action,
        actionInput: step.input,
        observation,
        timestamp: new Date()
      };

      state.iterations.push(iteration);
      if (this.onIterationCallback) {
        this.onIterationCallback(iteration);
      }

      if (step.action === 'FINISH') {
        state.isComplete = true;
        state.finalAnswer = observation;
      }
    }



    if (!state.isComplete) {
      state.finalAnswer = await this.generateFinalAnswer(state);
      state.isComplete = true;
    }

    const executionTime = Date.now() - startedAt;

    return {
      query: state.query,
      selectedTool: 'MultiPassAgent',
      reasoning: state.iterations.map((iteration) => iteration.thought).join(' → '),
      result: {
        answer: state.finalAnswer || 'No answer generated',
        metadata: {
          toolName: 'MultiPassAgent',
          embeddingResults
        }
      },
      executionTime,
      iterations: state.iterations,
      totalIterations: state.iterations.length,
      reasoningSteps: state.iterations.map((iteration) => iteration.thought)
    };
  }

    // Simple timeout helper to avoid hanging on network/LLM calls
    private withTimeout<T>(p: Promise<T>, ms: number, label = 'operation'): Promise<T> {
      let timeoutId: NodeJS.Timeout;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      });
      return Promise.race([p, timeout]).then((res) => {
        clearTimeout(timeoutId!);
        return res as T;
      });
    }

  private analyzeQuery(query: string): QueryInsights {
    const normalized = query.toLowerCase();
    const familyHits = FAMILY_KEYWORDS.filter((keyword) => normalized.includes(keyword));
    const eventHits = EVENT_KEYWORDS.filter((keyword) => normalized.includes(keyword));

    console.log('\n📋 QUERY ANALYSIS');
    console.log(`   Query: "${query}"`);
    console.log(`   Family keywords: ${familyHits.join(', ') || 'none'}`);
    console.log(`   Event keywords: ${eventHits.join(', ') || 'none'}\n`);

    return {
      normalized,
      mentionsFamily: familyHits.length > 0,
      needsEvents: eventHits.length > 0,
      referencedNames: new Set<string>(),
      keywords: [...new Set([...familyHits, ...eventHits])]
    };
  }

  private async lookupSemanticMemories(query: string): Promise<EmbeddingEntry[]> {
    if (!this.embeddingStore) {
      return [];
    }

    try {
      const queryEmbedding = await this.answerGenerator.generateEmbedding(query);
      if (!queryEmbedding) {
        return [];
      }

      const results = this.embeddingStore.findMostSimilar(queryEmbedding, 3);
      results.forEach((entry, index) => {
        console.log(`   🔍 Semantic memory #${index + 1}: similarity ${entry.similarity?.toFixed(3)}`);
      });

      const filtered = results.filter((entry) => (entry.similarity ?? 0) >= DEFAULT_SIMILARITY_THRESHOLD);
      console.log(`   → ${filtered.length} embeddings above threshold (${DEFAULT_SIMILARITY_THRESHOLD})`);
      return filtered;
    } catch (error) {
      console.error('   ❌ Failed to search semantic memory:', error);
      return [];
    }
  }

  private planNextStep(state: AgentState, insights: QueryInsights): PlannedStep {
    const hasFamily = state.workingMemory.has('familyMembers');
    const familyFetchFailed = state.workingMemory.get('familyFetchFailed') === true;
    const shouldFetchFamily = !hasFamily && !familyFetchFailed && insights.mentionsFamily;

    if (shouldFetchFamily) {
      return {
        thought: 'I should fetch the current family roster before making assumptions.',
        action: 'getFamily'
      };
    }

    const pendingEvents = this.getPendingEventTargets(state, insights);
    if (pendingEvents.length > 0) {
      return {
        thought: `The question references events, so I still need the timeline for ${pendingEvents[0]}.`,
        action: 'getEvents',
        input: { name: pendingEvents[0] }
      };
    }

    if (!hasFamily && !familyFetchFailed && insights.needsEvents) {
      return {
        thought: 'The user asked about events, so I need the family roster before I know whose timeline to inspect.',
        action: 'getFamily'
      };
    }

    return {
      thought: 'I have enough context. Time to synthesize a final answer.',
      action: 'FINISH'
    };
  }

  private async executeStep(step: PlannedStep, state: AgentState, insights: QueryInsights): Promise<string> {
    try {
      switch (step.action) {
        case 'getFamily':
          return await this.fetchFamilyRoster(state, insights);
        case 'getEvents':
          return await this.fetchEvents(step.input?.name, state, insights);
        case 'FINISH':
          return await this.generateFinalAnswer(state);
        default:
          return `Unknown action ${step.action}`;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Step ${step.action} failed:`, message);
      return `ERROR executing ${step.action}: ${message}`;
    }
  }

  private async fetchFamilyRoster(state: AgentState, insights: QueryInsights): Promise<string> {
    let result;
    try {
      // protect against hanging MCP server
      result = await this.withTimeout(this.mcpClient.getFamily(), 10000, 'getFamily');
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('   ❌ getFamily timed out or failed:', msg);
      state.workingMemory.set('familyFetchFailed', true);
      state.workingMemory.set('familyFetchError', msg);
      return `Failed to retrieve family roster from MCP server: ${msg}`;
    }
    if (!result.success) {
      state.workingMemory.set('familyFetchFailed', true);
      if (result.error) {
        state.workingMemory.set('familyFetchError', result.error);
      }
      return result.data?.answer || 'Failed to retrieve family roster from MCP server.';
    }

    const members = Array.isArray(result.data?.members) ? result.data.members : [];
    state.workingMemory.set('familyMembers', members);
    this.markReferencedNames(insights, members);

    const preview = members
      .slice(0, 3)
      .map((member: any) => `${member.name} (${member.birthdate})`)
      .join(', ');

    return members.length > 0
      ? `Fetched ${members.length} family members: ${preview}${members.length > 3 ? '...' : ''}`
      : 'Family roster is empty.';
  }

  private async fetchEvents(name: string | undefined, state: AgentState, insights: QueryInsights): Promise<string> {
    if (!name) {
      return 'Cannot fetch events without a target name.';
    }

    let result;
    try {
      result = await this.withTimeout(this.mcpClient.getEvents(name), 10000, `getEvents(${name})`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`   ❌ getEvents(${name}) timed out or failed:`, msg);
      this.getFetchedEventNames(state).add(name);
      return `Failed to retrieve events for ${name}: ${msg}`;
    }
    const fetched = this.getFetchedEventNames(state);
    fetched.add(name);

    if (!result.success) {
      const spouseName = this.findSpouseName(name, state.workingMemory);
      if (spouseName && !insights.referencedNames.has(spouseName)) {
        insights.referencedNames.add(spouseName);
        return `${result.data?.answer || `No events found for ${name}.`} I'll inspect ${spouseName}'s events next.`;
      }
      return result.data?.answer || `No events found for ${name}.`;
    }

    const events = Array.isArray(result.data?.events) ? result.data.events : [];
    state.workingMemory.set(`events_${name}`, events);

    const mirrored = this.mirrorEventsForSpouses(name, events, state, insights);

    if (events.length === 0) {
      return `No events found for ${name}.`;
    }

    const summary = events
      .map((event: any) => `${event.event_type ?? event.type} on ${event.event_date ?? event.date}`)
      .join(', ');

    const mirrorNote = mirrored.length ? ` Mirrored for ${mirrored.join(', ')}.` : '';
    return `Retrieved ${events.length} event(s) for ${name}: ${summary}.${mirrorNote}`;
  }

  private getPendingEventTargets(state: AgentState, insights: QueryInsights): string[] {
    if (!insights.needsEvents) {
      return [];
    }

    const members = state.workingMemory.get('familyMembers');
    if (!Array.isArray(members) || members.length === 0) {
      return [];
    }

    if (insights.referencedNames.size === 0) {
      this.markReferencedNames(insights, members);
    }

    const fetched = this.getFetchedEventNames(state);
    const pending = Array.from(insights.referencedNames).filter((name) => !fetched.has(name));

    if (pending.length === 0 && insights.needsEvents) {
      // If no explicit names matched, inspect everyone sequentially until we satisfy the question
      for (const member of members) {
        const memberName = member.name;
        if (memberName && !fetched.has(memberName)) {
          pending.push(memberName);
          break;
        }
      }
    }

    return pending;
  }

  private markReferencedNames(insights: QueryInsights, members: any[]): void {
    const normalized = insights.normalized;

    members.forEach((member: any) => {
      const memberName = String(member.name || '').trim();
      if (!memberName) {
        return;
      }
      const pattern = new RegExp(`\\b${memberName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}('s)?\\b`, 'i');
      if (pattern.test(normalized)) {
        insights.referencedNames.add(memberName);
      }
    });
  }

  private getFetchedEventNames(state: AgentState): Set<string> {
    let fetched = state.workingMemory.get('fetchedEvents');
    if (!(fetched instanceof Set)) {
      fetched = new Set<string>();
      state.workingMemory.set('fetchedEvents', fetched);
    }
    return fetched;
  }

  private mirrorEventsForSpouses(
    name: string,
    events: any[],
    state: AgentState,
    insights: QueryInsights
  ): string[] {
    const mirrored: string[] = [];
    const members = state.workingMemory.get('familyMembers');
    if (!Array.isArray(members) || members.length === 0) {
      return mirrored;
    }

    const normalizedTarget = name.trim().toLowerCase();

    members.forEach((member: any) => {
      const memberName = String(member.name || '').trim();
      if (!memberName) {
        return;
      }

      const spouseName = this.extractSpouseName(member);
      if (!spouseName) {
        return;
      }

      if (spouseName.trim().toLowerCase() === normalizedTarget && memberName.trim().toLowerCase() !== normalizedTarget) {
        state.workingMemory.set(`events_${memberName}`, events);
        this.getFetchedEventNames(state).add(memberName);
        insights.referencedNames.add(memberName);
        mirrored.push(memberName);
      }
    });

    return mirrored;
  }

  private findSpouseName(name: string, memory: Map<string, any>): string | null {
    const members = memory.get('familyMembers');
    if (!Array.isArray(members) || members.length === 0) {
      return null;
    }

    const normalized = name.trim().toLowerCase();
    for (const member of members) {
      const memberName = String(member.name || '').trim().toLowerCase();
      if (memberName === normalized) {
        return this.extractSpouseName(member);
      }
    }
    return null;
  }

  private extractSpouseName(member: any): string | null {
    if (!member) {
      return null;
    }

    const raw = member.spouse ?? member.spouse_name ?? member.partner ?? member.partner_name;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      return trimmed.length ? trimmed : null;
    }

    if (Array.isArray(raw) && raw.length > 0) {
      const candidate = String(raw[0] ?? '').trim();
      return candidate.length ? candidate : null;
    }

    return null;
  }

  private async generateFinalAnswer(state: AgentState): Promise<string> {
    const context: Record<string, any> = {};

    if (state.workingMemory.has('familyMembers')) {
      context.members = state.workingMemory.get('familyMembers');
    }

    const events: any[] = [];
    for (const [key, value] of state.workingMemory.entries()) {
      if (key.startsWith('events_') && Array.isArray(value)) {
        const owner = key.replace('events_', '');
        value.forEach((event: any) => events.push({ ...event, person: event.person ?? owner }));
      }
    }
    if (events.length > 0) {
      context.events = { name: 'Family', events };
    }

    if (state.workingMemory.has('embeddings')) {
      context.embeddings = state.workingMemory.get('embeddings');
    }

    let result;
    try {
      result = await this.withTimeout(
        this.answerGenerator.answerGeneralQuery(state.query, context, state.conversationHistory),
        20000,
        'answerGeneralQuery'
      );
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('   ❌ answerGeneralQuery timed out or failed:', msg);
      return `Unable to generate answer: ${msg}`;
    }

    if (result.success && result.data?.answer) {
      return result.data.answer;
    }

    return result.data?.answer || result.error || 'Unable to generate answer.';
  }
}
