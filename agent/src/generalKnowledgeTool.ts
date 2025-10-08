/**
 * General Knowledge Tool
 * Uses OpenAI's GPT API to answer general questions
 * This allows the agent to combine GPT intelligence with MCP server tools
 */

import OpenAI from 'openai';
import { ToolResult } from './types';

export class GeneralKnowledgeTool {
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
  async answerGeneralQuery(query: string, context?: any): Promise<ToolResult> {
    console.log(`🔧 [Tool: GeneralKnowledge/OpenAI] Processing query: "${query}"`);

    try {
      // If OpenAI is available, use it
      if (this.openai) {
        return await this.askGPT(query, context);
      }
      
      // Fallback to simple pattern matching if no API key
      return this.fallbackHandler(query);
      
    } catch (error) {
      return {
        toolName: 'GeneralKnowledge',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        reasoning: 'Failed to process general query'
      };
    }
  }

  /**
   * Use OpenAI GPT to answer the query
   */
  private async askGPT(query: string, context?: any): Promise<ToolResult> {
    try {
      console.log('   → Calling OpenAI API...');
      if (context) {
        console.log('   → WITH family context:', context.members?.length || 0, 'members');
      }
      
      // Build the prompt with optional context from MCP tools
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are a helpful AI assistant with access to a family database.

CRITICAL INSTRUCTIONS:
- When family data is provided, you MUST use the EXACT data from the database
- DO NOT make up dates, ages, or information - ONLY use what's in the database
- If you see family member data, use their EXACT birthdate from the database
- Calculate ages based on today's date (${new Date().toISOString().split('T')[0]}) and the birthdate in the database

Examples of correct answers:
- "Amit was born on February 26, 1994" (using exact date from database)
- "Maya is 26 years old" (calculated from birthdate: 1998-12-08)

Keep answers concise, friendly, and ACCURATE using the database.`
        }
      ];

      // Add context if available (e.g., family data from MCP server)
      if (context && context.members) {
        const membersList = context.members.map((m: any) => 
          `- ${m.name}: born ${m.birthdate}`
        ).join('\n');
        
        let contextMessage = `FAMILY DATABASE (USE THIS EXACT DATA):

${membersList}`;

        // Add events if available
        if (context.events && context.events.events) {
          console.log('   → DEBUG: context.events =', JSON.stringify(context.events, null, 2));
          
          const eventsList = context.events.events.map((e: any) => {
            // Format the date nicely
            const date = new Date(e.event_date);
            const dateStr = date.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
            
            return `  - ${dateStr}: ${e.event_type}`;
          }).join('\n');
          
          contextMessage += `\n\nEVENTS for ${context.events.name}:
${eventsList}`;
          
          console.log('   → DEBUG: Events list being sent to GPT:\n', eventsList);
        } else {
          console.log('   → DEBUG: No events found. context.events =', context.events);
        }

        contextMessage += `\n\nAnswer the user's question using ONLY the information above. Do not invent or guess data.`;
        
        messages.push({
          role: 'system',
          content: contextMessage
        });
        
        console.log('   → Sending family data to GPT');
        if (context.events) {
          console.log(`   → Including ${context.events.events?.length || 0} events`);
        }
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
        toolName: 'GeneralKnowledge-OpenAI',
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
      toolName: 'GeneralKnowledge-Fallback',
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
          toolName: 'GeneralKnowledge-Math',
          success: true,
          data: { calculation: `${num1} ${op} ${num2} = ${result}`, result },
          reasoning: 'Performed mathematical calculation'
        };
      }
    } catch (error) {
      // Fall through
    }
    
    return {
      toolName: 'GeneralKnowledge-Math',
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
      toolName: 'GeneralKnowledge-DateTime',
      success: true,
      data: { answer, timestamp: now.toISOString() },
      reasoning: 'Provided current date/time information'
    };
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
