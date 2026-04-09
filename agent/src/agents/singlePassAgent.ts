/**
 * Single-Pass agent backed by the GitHub Copilot SDK.
 * Handles conversational queries, performs lightweight RAG, and exposes
 * the Family MCP tools directly to the Copilot agent runtime.
 */

import { approveAll } from '@github/copilot-sdk';
import type { CopilotClient, CopilotSession, AssistantMessageEvent, SessionEventPayload, Tool } from '@github/copilot-sdk';
import OpenAI from 'openai';
import { FamilyMCPClient } from '../familyMCPClient';
import { EmbeddingStore, type EmbeddingEntry } from '../embeddingStore';
import { AgentResponse, UnifiedResult } from '../types';

type ConversationMessage = {
  role: string;
  content: string;
};

type EmbeddingMatch = EmbeddingEntry & {
  similarity?: number;
};

export class SinglePassAgent {
  private copilotClientPromise?: Promise<CopilotClient>;
  private copilotModulePromise?: Promise<CopilotSdkModule>;
  private readonly familyClient: FamilyMCPClient;
  private readonly embeddingStore: EmbeddingStore;
  private readonly openai: OpenAI | null;
  private tools?: Tool[];
  private readonly similarityThreshold = 0.25;
  private readonly maxEmbeddingResults = 3;
  private readonly sessionModel: string;
  private readonly embeddingModel: string;

  constructor(mcpServerUrl?: string, openaiApiKey?: string, sessionModel: string = 'gpt-4.1-mini', embeddingPath?: string) {
    this.familyClient = new FamilyMCPClient(mcpServerUrl);
    this.embeddingStore = new EmbeddingStore(embeddingPath);
    this.openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
    this.sessionModel = sessionModel;
    this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  }

  async processQuery(query: string, conversationHistory: ConversationMessage[] = []): Promise<AgentResponse> {
    const start = Date.now();
    const embeddingContext = await this.collectEmbeddingContext(query);
    const prompt = this.composePrompt(query, conversationHistory, embeddingContext);
    let finalAnswer = '';
    const streamedChunks: string[] = [];
    const toolsInvoked: string[] = [];
    let session: CopilotSession | null = null;
    let detachStream: (() => void) | null = null;
    let detachFinal: (() => void) | null = null;
    let detachTool: (() => void) | null = null;

    try {
      const client = await this.getCopilotClient();
      const tools = await this.ensureTools();
      session = await client.createSession({
        model: this.sessionModel,
        streaming: true,
        tools,
        onPermissionRequest: approveAll,
        systemMessage: {
          mode: 'append',
          content: this.buildSystemPrompt()
        }
      });

      detachStream = session.on('assistant.message_delta', (event) => {
        streamedChunks.push(event.data.deltaContent);
      });

      detachFinal = session.on('assistant.message', (event) => {
        finalAnswer = event.data.content;
      });

      detachTool = session.on('tool.execution_start', (event: SessionEventPayload<'tool.execution_start'>) => {
        toolsInvoked.push(event.data.toolName);
      });

      const messageEvent: AssistantMessageEvent | undefined = await session.sendAndWait({ prompt });
      const streamedAnswer = streamedChunks.join('');
      if (!finalAnswer && streamedAnswer) {
        finalAnswer = streamedAnswer;
      }
      if (!finalAnswer && messageEvent?.data.content) {
        finalAnswer = messageEvent.data.content;
      }

      const executionTime = Date.now() - start;
      const selectedTool = toolsInvoked.at(-1) || 'copilot-agent';
      const unifiedResult = this.buildUnifiedResult(finalAnswer, embeddingContext, toolsInvoked);

      return {
        query,
        selectedTool,
        reasoning: 'Answered via Copilot SDK agent',
        result: unifiedResult,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown error';

      return {
        query,
        selectedTool: 'error',
        reasoning: 'Copilot agent call failed',
        result: {
          answer: `❌ Error: ${message}`,
          rawData: { error: message },
          metadata: {
            toolName: 'error',
            embeddingResults: this.serializeEmbeddingContext(embeddingContext)
          }
        },
        executionTime
      };
    } finally {
      detachStream?.();
      detachFinal?.();
      detachTool?.();
      if (session) {
        try {
          await session.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  getCapabilities() {
    return {
      familyTools: this.familyClient.getAvailableTools(),
      answerGenerator: [],
      selectionStrategy: 'Delegates planning to Copilot SDK agent runtime'
    };
  }

  async demonstrateToolSelection(queries: string[]): Promise<void> {
    for (const query of queries) {
      const response = await this.processQuery(query);
      console.log('─'.repeat(60));
      console.log(`Query: ${query}`);
      console.log(`Selected tool: ${response.selectedTool}`);
      console.log(`Answer: ${response.result.answer}`);
    }
  }

  private buildFamilyTools(defineToolFn: CopilotSdkModule['defineTool']): Tool[] {
    const getDpoch = defineToolFn('family_get_dpoch', {
      description: 'Get the oldest birthdate epoch (DPOCH) from the family MCP server',
      handler: async () => {
        const result = await this.familyClient.getDPOCH();
        if (!result.success) {
          throw new Error(result.error || 'Unable to retrieve DPOCH');
        }
        return result.data;
      }
    });

    const getFamily = defineToolFn('family_get_family', {
      description: 'Get family members or search by name',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Optional name filter' }
        }
      },
      handler: async (args: { name?: string }) => {
        const result = await this.familyClient.getFamily(args?.name);
        if (!result.success) {
          throw new Error(result.error || 'Unable to retrieve family members');
        }
        return result.data;
      }
    });

    const getEvents = defineToolFn('family_get_events', {
      description: 'Get timeline events for a specific family member',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Family member name' },
          refDate: { type: 'number', description: 'Optional reference EPOCH' }
        },
        required: ['name']
      },
      handler: async (args: { name: string; refDate?: number }) => {
        const result = await this.familyClient.getEvents(args.name, args.refDate);
        if (!result.success) {
          throw new Error(result.error || 'Unable to retrieve events');
        }
        return result.data;
      }
    });

    return [getDpoch, getFamily as Tool, getEvents as Tool];
  }

  private buildSystemPrompt(): string {
    return [
      'You are the Family Knowledge Agent. Answer user questions clearly and concisely.',
      'Use the family_get_* tools for authoritative family data when needed.',
      'Blend semantic memory snippets with tool outputs, but prefer exact tool data for facts.',
      `Today is ${new Date().toISOString().split('T')[0]}.`
    ].join('\n');
  }

  private composePrompt(query: string, history: ConversationMessage[], embeddingContext: EmbeddingMatch[]): string {
    const sections: string[] = [];

    if (history.length > 0) {
      const formattedHistory = history
        .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
        .join('\n');
      sections.push('Conversation history:\n' + formattedHistory);
    }

    if (embeddingContext.length > 0) {
      const serialized = embeddingContext
        .map((entry, index) => {
          const score = entry.similarity !== undefined ? ` (similarity ${entry.similarity.toFixed(3)})` : '';
          return `${index + 1}. ${entry.text}${score}`;
        })
        .join('\n');
      sections.push('Relevant semantic memory:\n' + serialized);
    }

    sections.push('User request:\n' + query);
    sections.push('Respond with a helpful, factual answer.');

    return sections.join('\n\n');
  }

  private async collectEmbeddingContext(query: string): Promise<EmbeddingMatch[]> {
    if (!this.openai) {
      return [];
    }

    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) {
        return [];
      }
      const ranked = this.embeddingStore.findMostSimilar(embedding, this.maxEmbeddingResults);
      return ranked.filter((entry) => (entry.similarity ?? 0) >= this.similarityThreshold);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Embedding lookup failed:', message);
      return [];
    }
  }

  private async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) {
      return null;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text
      });
      return response.data[0]?.embedding ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Failed to generate embedding:', message);
      return null;
    }
  }

  private buildUnifiedResult(answer: string, embeddingContext: EmbeddingMatch[], toolsInvoked: string[]): UnifiedResult {
    const metadata: Record<string, unknown> = {
      toolName: toolsInvoked.at(-1) || 'copilot-agent'
    };

    const serializedContext = this.serializeEmbeddingContext(embeddingContext);
    if (serializedContext.length > 0) {
      metadata.embeddingResults = serializedContext;
    }

    return {
      answer: answer || 'No response produced.',
      rawData: {
        toolsInvoked,
        embeddingContext: serializedContext
      },
      metadata
    };
  }

  private serializeEmbeddingContext(embeddingContext: EmbeddingMatch[]) {
    return embeddingContext.map((entry) => ({
      text: entry.text,
      similarity: entry.similarity
    }));
  }

  private getCopilotModule(): Promise<CopilotSdkModule> {
    if (!this.copilotModulePromise) {
      this.copilotModulePromise = eval('import("@github/copilot-sdk")') as Promise<CopilotSdkModule>;
    }
    return this.copilotModulePromise;
  }

  private async getCopilotClient(): Promise<CopilotClient> {
    if (!this.copilotClientPromise) {
      this.copilotClientPromise = this.getCopilotModule().then(({ CopilotClient }) => new CopilotClient());
    }
    return this.copilotClientPromise;
  }

  private async ensureTools(): Promise<Tool[]> {
    if (!this.tools) {
      const module = await this.getCopilotModule();
      this.tools = this.buildFamilyTools(module.defineTool);
    }
    return this.tools;
  }
}

type CopilotSdkModule = typeof import('@github/copilot-sdk');
