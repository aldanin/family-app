import OpenAI from 'openai';
import { ToolResult } from '../types';

type ConversationMessage = { role: string; content: string };

type ContextPayload = {
  members?: any[];
  events?: { name: string; events: any[] };
  embeddings?: string[];
  [key: string]: any;
};

export class AnswerGenerator {
  private openai: OpenAI | null = null;
  private model: string;

  constructor(apiKey?: string, model: string = 'gpt-4o-mini') {
    this.model = model;

    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log(`✅ OpenAI initialized with model: ${model}`);
    } else {
      console.log('⚠️  OpenAI API key not provided. Using fallback responses.');
    }
  }

  /**
   * Answer general questions using OpenAI GPT
   */
  async answerGeneralQuery(
    query: string,
    context?: ContextPayload,
    conversationHistory: ConversationMessage[] = []
  ): Promise<ToolResult> {
    console.log(`🔧 [Tool: AnswerGenerator/OpenAI] Processing query: "${query}"`);
    if (conversationHistory.length > 0) {
      console.log(`   → With conversation history: ${conversationHistory.length} messages`);
    }

    try {
      // If OpenAI is available, use it
      if (this.openai) {
        return await this.askGPT(query, context, conversationHistory);
      }

      // Fallback to simple pattern matching if no API key
      return this.fallbackHandler(query);
    } catch (error) {
      return {
        toolName: 'AnswerGenerator',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        reasoning: 'Failed to process general query'
      };
    }
  }

  /**
   * Generate embedding vector for a text query using OpenAI's embedding API
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) {
      console.warn('⚠️  Cannot generate embedding: OpenAI not initialized');
      return null;
    }

    try {
      console.log(`   → Generating embedding for query: "${text.substring(0, 50)}..."`);
      const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
      const response = await this.openai.embeddings.create({
        model: embeddingModel,
        input: text
      });

      const embedding = response.data[0].embedding;
      console.log(`   ✓ Generated embedding vector (${embedding.length} dimensions) using ${embeddingModel}`);
      return embedding;
    } catch (error) {
      console.error('   ✗ Failed to generate embedding:', error);
      return null;
    }
  }

  getAvailableTools() {
    return [
      {
        name: 'answerGeneralQuery',
        description: 'Answer general questions using OpenAI GPT (can be combined with family data context)',
        category: 'general' as const,
        parameters: {
          query: { type: 'string', required: true, description: 'The question to answer' },
          context: { type: 'object', required: false, description: 'Optional context from other tools' }
        }
      }
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GPT helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private async askGPT(
    query: string,
    context?: ContextPayload,
    conversationHistory: ConversationMessage[] = []
  ): Promise<ToolResult> {
    try {
      this.logContextSummary(context);
      const messages = this.composeMessages(query, context, conversationHistory);
      const completion = await this.createCompletion(messages);
      return this.buildCompletionResult(completion, !!context);
    } catch (error) {
      console.error('   ✗ OpenAI API error:', error);
      return this.fallbackHandler(query);
    }
  }

  private logContextSummary(context?: ContextPayload) {
    console.log('   → Calling OpenAI API...');
    if (context) {
      const memberCount = Array.isArray(context.members) ? context.members.length : 0;
      console.log('   → WITH family context:', memberCount, 'members');
    }
  }

  private composeMessages(
    query: string,
    context: ContextPayload | undefined,
    conversationHistory: ConversationMessage[]
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages = this.buildBaseMessages();

    const contextMessage = this.buildContextMessage(context);
    if (contextMessage) {
      messages.push({ role: 'system', content: contextMessage });
    }

    if (conversationHistory.length > 0) {
      console.log(`   → Including ${conversationHistory.length} previous messages for context`);
      this.appendConversationHistory(messages, conversationHistory);
    }

    messages.push({ role: 'user', content: query });
    return messages;
  }

  private buildBaseMessages(): OpenAI.Chat.ChatCompletionMessageParam[] {
    return [
      {
        role: 'system',
        content: `You are a helpful AI assistant that can answer both general knowledge questions AND family-specific questions.

CRITICAL INSTRUCTIONS:
- You can answer ANY question - general knowledge, history, science, world events, etc.
- When family data is provided in context, you MUST use the EXACT data from the database
- DO NOT make up family information - ONLY use what's provided in the database
- For questions about the world (history, events, science) - use your training data freely
- Calculate ages based on today's date (${this.getTodayISODate()})
- When the user asks who can help with a need ("who should I call", "who can help me with"), scan the family data and recommend the best matching person based on occupations, skills, or notes. Name them explicitly and explain why they fit.
- You have access to complete family data (members + events for everyone). Analyze relationships and events to answer complex queries.

Examples:
- "Amit was born on February 26, 1994" (using exact date from database when provided)
- "Maya is 26 years old" (calculated from birthdate: 1998-12-08 when provided)
- "In 2019, major world events included..." (using general knowledge when no specific family context)
- "If I have a stutter, contact Maya who is a communication therapist" (matching occupation from family data)
- "When is Liad's wedding?" → You'll see Liad's spouse is Maya in member data, and wedding events in the events list

Keep answers concise, friendly, and ACCURATE.`
      }
    ];
  }

  private buildContextMessage(context?: ContextPayload): string | null {
    if (!context) {
      return null;
    }

    const sections: string[] = [];

    const membersSection = this.formatMembersSection(context.members);
    if (membersSection) {
      console.log('   → Sending family data to GPT (schema-agnostic formatting)');
      sections.push(`FAMILY DATABASE (USE THIS EXACT DATA):\n\n${membersSection}`);
    }

    const eventsSection = this.formatEventsSection(context.events);
    if (eventsSection) {
      sections.push(eventsSection);
    }

    if (sections.length > 0) {
      sections.push(`IMPORTANT: 
- For FAMILY data (people, birthdates, relationships, family events) → use ONLY the exact information from the database above
- For GENERAL KNOWLEDGE (world events, history, science, etc.) → use your training data
- If the question combines both → use database for family info + your knowledge for general info`);
    }

    const embeddingsSection = this.formatEmbeddingsSection(context.embeddings);
    if (embeddingsSection) {
      sections.push(embeddingsSection);
    }

    return sections.length > 0 ? sections.join('\n\n') : null;
  }

  private formatMembersSection(members?: any[]): string | null {
    if (!Array.isArray(members) || members.length === 0) {
      return null;
    }

    const excludeFields = ['birth_epoch', 'member_id', 'id'];
    const formattedMembers = members
      .map(member => {
        const entries = Object.entries(member)
          .filter(([key]) => !excludeFields.includes(key))
          .map(([key, value]) => `${this.formatMemberKey(key)}: ${value}`);

        return entries.length > 0 ? `- ${entries.join(', ')}` : null;
      })
      .filter(Boolean)
      .join('\n');

    if (formattedMembers) {
      const preview = formattedMembers.length > 300
        ? `${formattedMembers.substring(0, 300)}...`
        : formattedMembers;
      console.log('   → Formatted member data (schema-agnostic):\n', preview);
    }

    return formattedMembers || null;
  }

  private formatEventsSection(eventsContext?: { name: string; events: any[] }): string | null {
    if (!eventsContext || !Array.isArray(eventsContext.events) || eventsContext.events.length === 0) {
      return null;
    }

    const excludeFields = ['event_epoch', 'name'];
    const eventCount = eventsContext.events.length;
    const eventsList = eventsContext.events
      .map(event => {
        const entries = Object.entries(event)
          .filter(([key]) => !excludeFields.includes(key))
          .map(([key, value]) => {
            if (key.includes('date') && value) {
              const displayKey = key.replace(/^event_/, '').replace(/_/g, ' ');
              return `${displayKey}: ${this.formatEventDate(value as string)}`;
            }
            const displayKey = key.replace(/^event_/, '').replace(/_/g, ' ');
            return `${displayKey}: ${value}`;
          });

        return entries.length > 0 ? `  - ${entries.join(', ')}` : null;
      })
      .filter(Boolean)
      .join('\n');

    if (eventsList) {
      console.log('   → Including events (schema-agnostic)');
      console.log(`   → Including ${eventCount} events`);
      return `EVENTS for ${eventsContext.name}:\n${eventsList}`;
    }

    return null;
  }

  private formatEmbeddingsSection(embeddings?: string[]): string | null {
    if (!Array.isArray(embeddings) || embeddings.length === 0) {
      return null;
    }

    console.log(`   → Including ${embeddings.length} semantic memory embeddings`);

    const formatted = embeddings
      .map((text, index) => `${index + 1}. ${text}`)
      .join('\n');

    return `SEMANTIC MEMORY (relevant historical/biographical information):\n${formatted}\n\nUse this information to provide rich, detailed answers about historical figures and events.`;
  }

  private appendConversationHistory(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    history: ConversationMessage[]
  ) {
    history.forEach(msg => {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    });
  }

  private async createCompletion(messages: OpenAI.Chat.ChatCompletionMessageParam[]) {
    return this.openai!.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.1,
      max_tokens: 500
    });
  }

  private buildCompletionResult(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    hasContext: boolean
  ): ToolResult {
    const answer = completion.choices[0]?.message?.content || 'No response generated';
    const usage = completion.usage;

    console.log(`   ✓ GPT response received (${usage?.total_tokens || 0} tokens)`);
    console.log(`   📝 GPT Answer: "${answer.substring(0, 200)}${answer.length > 200 ? '...' : ''}"`);

    return {
      toolName: 'AnswerGenerator-OpenAI',
      success: true,
      data: {
        answer,
        model: this.model,
        usage: {
          prompt_tokens: usage?.prompt_tokens,
          completion_tokens: usage?.completion_tokens,
          total_tokens: usage?.total_tokens
        },
        hasContext
      },
      reasoning: hasContext
        ? 'Answered using OpenAI GPT with family context'
        : 'Answered using OpenAI GPT'
    };
  }

  private formatMemberKey(key: string): string {
    return key.replace(/_name$/, '').replace(/_/g, ' ');
  }

  private formatEventDate(value: string): string {
    const date = new Date(value);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private getTodayISODate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Fallback handlers
  // ─────────────────────────────────────────────────────────────────────────────

  private fallbackHandler(query: string): ToolResult {
    console.log('   → Using fallback handler (no OpenAI)');

    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('calculate') || /\d+\s*[\+\-\*\/]\s*\d+/.test(query)) {
      return this.handleMathQuery(query);
    }

    if (lowerQuery.includes('what time') || lowerQuery.includes('what date') || lowerQuery.includes('today')) {
      return this.handleDateTimeQuery(query);
    }

    return {
      toolName: 'AnswerGenerator-Fallback',
      success: true,
      data: {
        answer: `I understand you're asking: "${query}". To get intelligent AI responses, please configure your OpenAI API key in the .env file.`,
        type: 'fallback'
      },
      reasoning: 'Fallback response (OpenAI not configured)'
    };
  }

  private handleMathQuery(query: string): ToolResult {
    try {
      const match = query.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
      if (match) {
        const [, a, op, b] = match;
        const num1 = parseFloat(a);
        const num2 = parseFloat(b);
        let result: number;

        switch (op) {
          case '+':
            result = num1 + num2;
            break;
          case '-':
            result = num1 - num2;
            break;
          case '*':
            result = num1 * num2;
            break;
          case '/':
            result = num1 / num2;
            break;
          default:
            throw new Error('Invalid operator');
        }

        return {
          toolName: 'AnswerGenerator-Math',
          success: true,
          data: { calculation: `${num1} ${op} ${num2} = ${result}`, result },
          reasoning: 'Performed mathematical calculation'
        };
      }
    } catch (error) {
      // Fall through to default message below
    }

    return {
      toolName: 'AnswerGenerator-Math',
      success: true,
      data: { answer: 'I can help with simple math queries like "what is 2 + 2"' },
      reasoning: 'Math query format not recognized'
    };
  }

  private handleDateTimeQuery(query: string): ToolResult {
    const now = new Date();
    const lowerQuery = query.toLowerCase();

    let answer = '';
    if (lowerQuery.includes('time')) {
      answer = `Current time: ${now.toLocaleTimeString()}`;
    } else if (lowerQuery.includes('date') || lowerQuery.includes('today')) {
      answer = `Today's date: ${now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`;
    }

    return {
      toolName: 'AnswerGenerator-DateTime',
      success: true,
      data: { answer, timestamp: now.toISOString() },
      reasoning: 'Provided current date/time information'
    };
  }
}
