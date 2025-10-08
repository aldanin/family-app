/**
 * Tool Selection Engine
 * This is the "brain" of the agent - it decides which tool to use based on the query
 */

import { ToolDefinition } from './types';

export interface ToolSelectionResult {
  selectedTool: string;
  reasoning: string;
  confidence: number;
  parameters?: Record<string, any>;
}

export class ToolSelector {
  private availableTools: ToolDefinition[];

  constructor(tools: ToolDefinition[]) {
    this.availableTools = tools;
  }

  /**
   * Main tool selection logic
   * This demonstrates how an agent analyzes a query and picks the right tool
   */
  selectTool(query: string): ToolSelectionResult {
    console.log('\n🤖 [Agent Decision Process] Analyzing query...');
    console.log(`📝 Query: "${query}"`);
    console.log(`🔍 Available tools: ${this.availableTools.map(t => t.name).join(', ')}\n`);

    const lowerQuery = query.toLowerCase();
    
    // Step 1: Check for family-related keywords
    const familyKeywords = ['maya', 'family', 'event', 'wedding', 'graduation', 'birthday', 'dpoc', 'timeline'];
    const hasFamilyKeyword = familyKeywords.some(keyword => lowerQuery.includes(keyword));
    
    if (hasFamilyKeyword) {
      console.log('✓ Detected family-related keywords');
      
      // Check if asking about DPOC
      if (lowerQuery.includes('dpoc') || lowerQuery.includes('oldest') || lowerQuery.includes('first family member')) {
        console.log('  → Decision: Use getDPOC tool');
        console.log('  → Reason: Query is about the Date Point of Commencement\n');
        return {
          selectedTool: 'getDPOC',
          reasoning: 'Query asks about DPOC (oldest family member birthdate)',
          confidence: 0.95
        };
      }
      
      // Check if asking about specific person's events
      const personMatch = this.extractPersonName(query);
      if (personMatch) {
        console.log(`  → Detected person name: "${personMatch}"`);
        console.log('  → Decision: Use getEvents tool');
        console.log(`  → Reason: Query is about events for ${personMatch}\n`);
        return {
          selectedTool: 'getEvents',
          reasoning: `Query asks about events for family member "${personMatch}"`,
          confidence: 0.9,
          parameters: { name: personMatch }
        };
      }
      
      // Generic family query
      console.log('  → Decision: Use getDPOC tool (default for family queries)');
      console.log('  → Reason: Family-related but no specific person identified\n');
      return {
        selectedTool: 'getDPOC',
        reasoning: 'Family-related query, defaulting to DPOC',
        confidence: 0.6
      };
    }
    
    // Step 2: Check for general knowledge queries
    const generalPatterns = [
      /what is \d+/i,  // Math queries
      /calculate/i,
      /what time/i,
      /what date/i,
      /today/i,
      /define/i,
      /what is (ai|agent|mcp)/i
    ];
    
    const isGeneralQuery = generalPatterns.some(pattern => pattern.test(query));
    
    if (isGeneralQuery) {
      console.log('✓ Detected general knowledge query pattern');
      console.log('  → Decision: Use GeneralKnowledge tool');
      console.log('  → Reason: Query matches general knowledge patterns (math, time, definitions)\n');
      return {
        selectedTool: 'answerGeneralQuery',
        reasoning: 'Query is a general knowledge question (math, time, or definition)',
        confidence: 0.85,
        parameters: { query }
      };
    }
    
    // Step 3: Default to general knowledge for unknown queries
    console.log('⚠ No specific pattern matched');
    console.log('  → Decision: Use GeneralKnowledge tool (fallback)');
    console.log('  → Reason: Could not classify query, using general handler\n');
    return {
      selectedTool: 'answerGeneralQuery',
      reasoning: 'Query type unclear, using general knowledge handler as fallback',
      confidence: 0.5,
      parameters: { query }
    };
  }

  /**
   * Extract person name from query
   * Simple implementation - in production, use NER (Named Entity Recognition)
   */
  private extractPersonName(query: string): string | null {
    // Known family members (in production, this would come from the MCP server)
    const knownNames = ['Maya', 'John', 'Sarah', 'David', 'Emma'];
    
    for (const name of knownNames) {
      if (query.toLowerCase().includes(name.toLowerCase())) {
        return name;
      }
    }
    
    // Try to extract capitalized words (simple name detection)
    const words = query.split(' ');
    for (const word of words) {
      if (/^[A-Z][a-z]+$/.test(word) && word.length > 2) {
        return word;
      }
    }
    
    return null;
  }

  /**
   * Get explanation of how tool selection works
   */
  getSelectionStrategy(): string {
    return `
Tool Selection Strategy:
========================

1. FAMILY QUERIES (Priority 1)
   - Keywords: family member names, events, dpoc, timeline
   - Tools: getDPOC, getEvents
   - Examples:
     * "What is DPOC?" → getDPOC
     * "Show Maya's events" → getEvents(name: "Maya")
     * "When did Maya graduate?" → getEvents(name: "Maya")

2. GENERAL KNOWLEDGE (Priority 2)
   - Patterns: math, time/date, definitions
   - Tool: answerGeneralQuery
   - Examples:
     * "What is 5 + 3?" → Math handler
     * "What time is it?" → DateTime handler
     * "What is AI?" → Definition handler

3. FALLBACK (Priority 3)
   - When query doesn't match any pattern
   - Tool: answerGeneralQuery (general handler)
   - The agent explains it needs more context

The agent logs its decision process so you can see WHY it chose each tool!
    `.trim();
  }
}
