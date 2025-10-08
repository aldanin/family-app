/**
 * General Knowledge Tool
 * Handles queries that don't require family-specific data
 */

import { ToolResult } from './types';

export class GeneralKnowledgeTool {
  
  /**
   * Answer general questions using built-in knowledge
   */
  async answerGeneralQuery(query: string): Promise<ToolResult> {
    console.log(`🔧 [Tool: GeneralKnowledge] Processing general query: "${query}"`);

    try {
      // Simple pattern matching for demonstration
      // In a real agent, this would use an LLM or knowledge base
      
      const lowerQuery = query.toLowerCase();
      
      // Math queries
      if (lowerQuery.includes('calculate') || lowerQuery.includes('what is') && /[\d+\-*/]/.test(query)) {
        return this.handleMathQuery(query);
      }
      
      // Date/time queries
      if (lowerQuery.includes('what time') || lowerQuery.includes('what date') || lowerQuery.includes('today')) {
        return this.handleDateTimeQuery(query);
      }
      
      // Definition queries
      if (lowerQuery.startsWith('what is') || lowerQuery.startsWith('define')) {
        return this.handleDefinitionQuery(query);
      }
      
      // Default response
      return {
        toolName: 'GeneralKnowledge',
        success: true,
        data: {
          answer: `I understand you're asking: "${query}". This is a general query that doesn't require family data. In a production system, this would be answered by an LLM or knowledge base.`,
          type: 'general'
        },
        reasoning: 'General query handled with built-in knowledge'
      };
      
    } catch (error) {
      return {
        toolName: 'GeneralKnowledge',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        reasoning: 'Failed to process general query'
      };
    }
  }

  private handleMathQuery(query: string): ToolResult {
    try {
      // Extract simple math expressions (e.g., "what is 2 + 2")
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
      // Fall through to default handler
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

  private handleDefinitionQuery(query: string): ToolResult {
    // Simple definition lookup
    const definitions: Record<string, string> = {
      'ai': 'Artificial Intelligence - the simulation of human intelligence by machines',
      'agent': 'An autonomous entity that perceives its environment and takes actions to achieve goals',
      'mcp': 'Model Context Protocol - a protocol for AI models to interact with external tools and data sources',
      'dpoc': 'Date Point of Commencement - the oldest birthdate in a family timeline system'
    };
    
    const lowerQuery = query.toLowerCase();
    for (const [term, definition] of Object.entries(definitions)) {
      if (lowerQuery.includes(term)) {
        return {
          toolName: 'GeneralKnowledge-Definition',
          success: true,
          data: { term, definition },
          reasoning: `Provided definition for "${term}"`
        };
      }
    }
    
    return {
      toolName: 'GeneralKnowledge-Definition',
      success: true,
      data: { answer: 'Definition not found in knowledge base' },
      reasoning: 'Term not found in built-in definitions'
    };
  }

  getAvailableTools() {
    return [
      {
        name: 'answerGeneralQuery',
        description: 'Answer general questions using built-in knowledge (math, dates, definitions, etc.)',
        category: 'general' as const,
        parameters: {
          query: { type: 'string', required: true, description: 'The question to answer' }
        }
      }
    ];
  }
}
