import { FamilyMCPClient } from '../familyMCPClient';
import { AnswerGenerator } from '../answerGenerator';
import { AgentIteration, AgentState, MultiPassAgentResponse } from '../types';

type AgentAction = 'getFamily' | 'getEvents' | 'FINISH';

interface QueryPlan {
  originalQuery: string;
  normalizedQuery: string;
  needsEvents: boolean;
  referencedNames: Set<string>;
  fetchedEventNames: Set<string>;
}

const EVENT_KEYWORDS = [
  'wedding',
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
  'achievement'
];

export class MultiPassAgent {
  private mcpClient: FamilyMCPClient;
  private answerGenerator: AnswerGenerator;
  private maxIterations: number;
  private onIterationCallback?: (iteration: AgentIteration) => void;

  constructor(
    mcpServerUrl: string,
    openaiApiKey?: string,
    openaiModel: string = 'gpt-4o-mini',
    maxIterations: number = 5
  ) {
    this.mcpClient = new FamilyMCPClient(mcpServerUrl);
    this.answerGenerator = new AnswerGenerator(openaiApiKey, openaiModel);
    this.maxIterations = maxIterations;
  }

  setOnIterationCallback(callback: (iteration: AgentIteration) => void): void {
    this.onIterationCallback = callback;
  }

  async processQuery(query: string, conversationHistory: any[] = []): Promise<MultiPassAgentResponse> {
    const plan = this.createQueryPlan(query);

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

      const thought = this.generateThought(state, plan);
      const { action, actionInput } = this.decideNextAction(state, plan);
      const observation = await this.executeAction(action, actionInput, state, plan);

      const iteration: AgentIteration = {
        iterationNumber: state.currentIteration,
        thought,
        action,
        actionInput,
        observation,
        timestamp: new Date()
      };

      state.iterations.push(iteration);

      if (this.onIterationCallback) {
        this.onIterationCallback(iteration);
      }

      if (action === 'FINISH') {
        state.isComplete = true;
        state.finalAnswer = observation;
      }
    }

    if (!state.isComplete) {
      state.finalAnswer = await this.generateFinalAnswer(state);
      state.isComplete = true;
    }

    return {
      query: state.query,
      selectedTool: 'MultiPassAgent',
      reasoning: state.iterations.map((i) => i.thought).join(' ? '),
      result: {
        answer: state.finalAnswer || 'No answer generated',
        metadata: {
          toolName: 'MultiPassAgent'
        }
      },
      executionTime: 0,
      iterations: state.iterations,
      totalIterations: state.iterations.length,
      reasoningSteps: state.iterations.map((i) => i.thought)
    };
  }

  private createQueryPlan(query: string): QueryPlan {
    const normalizedQuery = query.toLowerCase();
    const needsEvents = EVENT_KEYWORDS.some((keyword) => normalizedQuery.includes(keyword));

    return {
      originalQuery: query,
      normalizedQuery,
      needsEvents,
      referencedNames: new Set(),
      fetchedEventNames: new Set()
    };
  }

  private generateThought(state: AgentState, plan: QueryPlan): string {
    if (!state.workingMemory.has('familyMembers')) {
      return 'I need the full family roster before I can reason about this question.';
    }

    const pendingEvents = this.getPendingEventNames(plan, state.workingMemory);
    if (pendingEvents.length > 0) {
      return `I have the family data. The query references events, so I still need event history for ${pendingEvents.join(', ')}.`;
    }

    return 'All required data is available. Time to compose the final answer.';
  }

  private decideNextAction(state: AgentState, plan: QueryPlan): { action: AgentAction; actionInput?: any } {
    if (!state.workingMemory.has('familyMembers')) {
      return { action: 'getFamily' };
    }

    const pendingEvents = this.getPendingEventNames(plan, state.workingMemory);
    if (pendingEvents.length > 0) {
      const nextName = pendingEvents[0];
      return { action: 'getEvents', actionInput: { name: nextName } };
    }

    return { action: 'FINISH' };
  }

  private async executeAction(
    action: AgentAction,
    actionInput: any,
    state: AgentState,
    plan: QueryPlan
  ): Promise<string> {
    try {
      switch (action) {
        case 'getFamily': {
          const result = await this.mcpClient.getFamily();
          if (!result.success) {
            return result.data?.answer || 'Failed to retrieve family members.';
          }

          const members = Array.isArray(result.data?.members) ? result.data.members : [];
          state.workingMemory.set('familyMembers', members);
          this.updatePlanWithMembers(plan, members);

          const preview = members
            .slice(0, 3)
            .map((m: any) => `${m.name} (${m.birthdate})`)
            .join(', ');

          return members.length > 0
            ? `Retrieved ${members.length} family members: ${preview}${members.length > 3 ? '...' : ''}`
            : 'Retrieved family roster (no members listed).';
        }

        case 'getEvents': {
          const name = actionInput?.name;
          if (!name) {
            return 'Cannot fetch events without a name.';
          }

          const result = await this.mcpClient.getEvents(name);
          const events = Array.isArray(result.data?.events) ? result.data.events : [];
          state.workingMemory.set(`events_${name}`, events);
          plan.fetchedEventNames.add(name);

          if (events.length === 0) {
            return `No events found for ${name}.`;
          }

          const summary = events
            .map((event: any) => `${event.type || event.event_type} on ${event.date || event.event_date}`)
            .join(', ');

          return `Fetched ${events.length} event(s) for ${name}: ${summary}`;
        }

        case 'FINISH':
          return await this.generateFinalAnswer(state);

        default:
          return `Unknown action: ${action}`;
      }
    } catch (error: any) {
      return `ERROR executing ${action}: ${error?.message || error}`;
    }
  }

  private getPendingEventNames(plan: QueryPlan, memory: Map<string, any>): string[] {
    if (!plan.needsEvents) {
      return [];
    }

    const members = memory.get('familyMembers');
    if (!Array.isArray(members) || members.length === 0) {
      return [];
    }

    if (plan.referencedNames.size === 0) {
      this.updatePlanWithMembers(plan, members);
    }

    return Array.from(plan.referencedNames).filter((name) => !plan.fetchedEventNames.has(name));
  }

  private updatePlanWithMembers(plan: QueryPlan, members: any[]): void {
    const normalized = plan.normalizedQuery;
    members.forEach((member: any) => {
      const memberName = String(member.name || '')
        .trim()
        .toLowerCase();
      if (!memberName) {
        return;
      }

      if (normalized.includes(memberName)) {
        plan.referencedNames.add(member.name);
      }
    });

    if (plan.needsEvents && plan.referencedNames.size === 0) {
      if (normalized.includes('oldest')) {
        const sortedByBirth = [...members].sort((a, b) => {
          const aDate = new Date(a.birthdate ?? a.date ?? a.born ?? 0).getTime();
          const bDate = new Date(b.birthdate ?? b.date ?? b.born ?? 0).getTime();
          return aDate - bDate;
        });
        const oldest = sortedByBirth[0];
        if (oldest?.name) {
          plan.referencedNames.add(oldest.name);
        }
      }
    }
  }

  private async generateFinalAnswer(state: AgentState): Promise<string> {
    const context: any = {};

    if (state.workingMemory.has('familyMembers')) {
      context.members = state.workingMemory.get('familyMembers');
    }

    const allEvents: any[] = [];
    for (const [key, value] of state.workingMemory.entries()) {
      if (key.startsWith('events_') && Array.isArray(value)) {
        allEvents.push(...value);
      }
    }
    if (allEvents.length > 0) {
      context.events = { events: allEvents };
    }

    const result = await this.answerGenerator.answerGeneralQuery(
      state.query,
      context,
      state.conversationHistory
    );

    if (result.success && result.data?.answer) {
      return result.data.answer;
    }

    return result.data?.answer || result.error || 'Unable to generate answer.';
  }
}
