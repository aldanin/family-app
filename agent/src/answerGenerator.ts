/**
 * Answer Generator
 * Uses OpenAI's GPT to generate natural language answers
 * Combines GPT intelligence with optional family data context from MCP server
 */

import OpenAI from 'openai';
import { ToolResult } from './types';

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
    context?: any,
    conversationHistory: Array<{role: string, content: string}> = []
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
   * Use OpenAI GPT to answer the query
   */
  private async askGPT(
    query: string, 
    context?: any,
    conversationHistory: Array<{role: string, content: string}> = []
  ): Promise<ToolResult> {
    try {
      console.log('   → Calling OpenAI API...');
      if (context) {
        console.log('   → WITH family context:', context.members?.length || 0, 'members');
      }
      
      // Build the prompt with optional context from MCP tools
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are a helpful AI assistant that can answer both general knowledge questions AND family-specific questions.

CRITICAL INSTRUCTIONS:
- You can answer ANY question - general knowledge, history, science, world events, etc.
- When family data is provided in context, you MUST use the EXACT data from the database
- DO NOT make up family information - ONLY use what's provided in the database
- For questions about the world (history, events, science) - use your training data freely
- Calculate ages based on today's date (${new Date().toISOString().split('T')[0]})
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

      // Add context if available (e.g., family data from MCP server)
      if (context && context.members) {
        // Dynamically format member data based on actual fields (schema-agnostic)
        const membersList = context.members.map((m: any) => {
          // Convert object to readable format, excluding technical fields
          const excludeFields = ['birth_epoch', 'member_id', 'id'];
          const entries = Object.entries(m)
            .filter(([key]) => !excludeFields.includes(key))
            .map(([key, value]) => {
              // Format field names nicely (e.g., father_name -> father)
              const displayKey = key.replace(/_name$/, '').replace(/_/g, ' ');
              return `${displayKey}: ${value}`;
            });
          
          return `- ${entries.join(', ')}`;
        }).join('\n');
        
        console.log('   → Formatted member data (schema-agnostic):\n', membersList.substring(0, 300) + '...');
        
        let contextMessage = `FAMILY DATABASE (USE THIS EXACT DATA):

${membersList}`;

        // Add events if available (schema-agnostic)
        if (context.events && context.events.events) {
          const eventsList = context.events.events.map((e: any) => {
            // Dynamically format events based on actual fields
            const excludeFields = ['event_epoch', 'name']; // Exclude technical/redundant fields
            const entries = Object.entries(e)
              .filter(([key]) => !excludeFields.includes(key))
              .map(([key, value]) => {
                // Special handling for dates
                if (key.includes('date') && value) {
                  const date = new Date(value as string);
                  return date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  });
                }
                // Format field names nicely
                const displayKey = key.replace(/^event_/, '').replace(/_/g, ' ');
                return `${value}`;
              });
            
            return `  - ${entries.join(': ')}`;
          }).join('\n');
          
          contextMessage += `\n\nEVENTS for ${context.events.name}:
${eventsList}`;
          
          console.log('   → Including events (schema-agnostic)');
        }

        contextMessage += `\n\nIMPORTANT: 
- For FAMILY data (people, birthdates, relationships, family events) → use ONLY the exact information from the database above
- For GENERAL KNOWLEDGE (world events, history, science, etc.) → use your training data
- If the question combines both → use database for family info + your knowledge for general info`;

        // Add semantic memory embeddings if available
        if (context.embeddings && Array.isArray(context.embeddings) && context.embeddings.length > 0) {
          contextMessage += `\n\nSEMANTIC MEMORY (relevant historical/biographical information):
${context.embeddings.map((text: string, i: number) => `${i + 1}. ${text}`).join('\n')}

Use this information to provide rich, detailed answers about historical figures and events.`;
          console.log(`   → Including ${context.embeddings.length} semantic memory embeddings`);
        }
        
        messages.push({
          role: 'system',
          content: contextMessage
        });
        
        console.log('   → Sending family data to GPT (schema-agnostic formatting)');
        if (context.events) {
          console.log(`   → Including ${context.events.events?.length || 0} events`);
        }
      }

      // Add conversation history for context-aware responses
      if (conversationHistory.length > 0) {
        console.log(`   → Including ${conversationHistory.length} previous messages for context`);
        conversationHistory.forEach((msg) => {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          });
        });
      }

      messages.push({
        role: 'user',
        content: query
      });

      const completion = await this.openai!.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.1,  // Lower temperature for more factual responses
        max_tokens: 500
      });

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
          hasContext: !!context
        },
        reasoning: context 
          ? 'Answered using OpenAI GPT with family context'
          : 'Answered using OpenAI GPT'
      };
      
    } catch (error) {
      console.error('   ✗ OpenAI API error:', error);
      
      // Fallback if OpenAI fails
      return this.fallbackHandler(query);
    }
  }

  /**
   * Fallback handler when OpenAI is not available
   */
  private fallbackHandler(query: string): ToolResult {
    console.log('   → Using fallback handler (no OpenAI)');
    
    const lowerQuery = query.toLowerCase();
    
    // Math queries
    if (lowerQuery.includes('calculate') || /\d+\s*[\+\-\*\/]\s*\d+/.test(query)) {
      return this.handleMathQuery(query);
    }
    
    // Date/time queries
    if (lowerQuery.includes('what time') || lowerQuery.includes('what date') || lowerQuery.includes('today')) {
      return this.handleDateTimeQuery(query);
    }
    
    // Default response
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
          case '+': result = num1 + num2; break;
          case '-': result = num1 - num2; break;
          case '*': result = num1 * num2; break;
          case '/': result = num1 / num2; break;
          default: throw new Error('Invalid operator');
        }
        
        return {
          toolName: 'AnswerGenerator-Math',
          success: true,
          data: { calculation: `${num1} ${op} ${num2} = ${result}`, result },
          reasoning: 'Performed mathematical calculation'
        };
      }
    } catch (error) {
      // Fall through
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
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      const embedding = response.data[0].embedding;
      console.log(`   ✓ Generated embedding vector (${embedding.length} dimensions)`);
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
}
