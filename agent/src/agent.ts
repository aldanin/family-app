/**
 * Main Agent Class
 * Orchestrates tool selection and execution
 */

import { FamilyMCPClient } from './familyMCPClient';
import { GeneralKnowledgeTool } from './generalKnowledgeTool';
import { ToolSelector } from './toolSelector';
import { AgentQuery, AgentResponse, ToolDefinition, UnifiedResult, ToolResult } from './types';

export class FamilyAgent {
  private familyClient: FamilyMCPClient;
  private generalTool: GeneralKnowledgeTool;
  private toolSelector: ToolSelector;

  constructor(mcpServerUrl?: string, openaiApiKey?: string, openaiModel?: string) {
    this.familyClient = new FamilyMCPClient(mcpServerUrl);
    this.generalTool = new GeneralKnowledgeTool(openaiApiKey, openaiModel);
    
    // Gather all available tools
    const allTools: ToolDefinition[] = [
      ...this.familyClient.getAvailableTools(),
      ...this.generalTool.getAvailableTools()
    ];
    
    // Pass OpenAI key to tool selector for LLM-based selection!
    this.toolSelector = new ToolSelector(allTools, openaiApiKey);
  }

  /**
   * Process a query - this is the main entry point
   */
  async processQuery(query: string, combineWithContext: boolean = false): Promise<AgentResponse> {
    const startTime = Date.now();
    
    console.log('\n' + '='.repeat(80));
    console.log('🚀 AGENT EXECUTION STARTED');
    console.log('='.repeat(80));
    
    try {
      // Step 1: Select the appropriate tool (LLM-based selection!)
      const selection = await this.toolSelector.selectTool(query);
      
      console.log('📊 TOOL SELECTION RESULT:');
      console.log(`   Selected Tool: ${selection.selectedTool}`);
      console.log(`   Confidence: ${(selection.confidence * 100).toFixed(0)}%`);
      console.log(`   Reasoning: ${selection.reasoning}`);
      console.log(`   Parameters:`, JSON.stringify(selection.parameters, null, 2));
      console.log('');
      
      // Step 2: Execute the selected tool
      console.log('⚙️  EXECUTING TOOL...\n');
      
      let result;
      let familyContext;
      
      // If this is a family query, fetch relevant family data and let GPT reason about it
      if (selection.selectedTool === 'answerGeneralQuery' && selection.parameters?.needsFamilyContext) {
        console.log('🔗 FETCHING FAMILY CONTEXT for GPT...');
        console.log(`   needsFamilyContext = ${selection.parameters.needsFamilyContext}\n`);
        
        const lowerQuery = selection.parameters.query?.toLowerCase() || '';
        const isEventQuery = lowerQuery.includes('event') || lowerQuery.includes('graduation') || 
                            lowerQuery.includes('wedding') || lowerQuery.includes('timeline');
        
        // Always get family members for context
        const familyResult = await this.familyClient.getFamily();
        if (familyResult.success) {
          familyContext = familyResult.data;
          console.log(`   ✓ Retrieved family database (${familyContext.count} members)`);
          console.log(`   ✓ Family members:`, familyContext.members.map((m: any) => m.name).join(', '));
          
          // If it's an event query, also fetch events for the mentioned person
          if (isEventQuery) {
            console.log('   → Detected EVENT query, fetching events...');
            
            // Try to find person name in query
            const personName = familyContext.members.find((m: any) => 
              lowerQuery.includes(m.name.toLowerCase())
            )?.name;
            
            if (personName) {
              console.log(`   → Fetching events for: ${personName}`);
              const eventsResult = await this.familyClient.getEvents(personName);
              
              if (eventsResult.success) {
                // Add events to context
                familyContext.events = eventsResult.data;
                console.log(`   ✓ Retrieved ${eventsResult.data.events?.length || 0} events for ${personName}`);
              }
            }
          }
          
          console.log('   ✓ GPT will analyze this data and answer the query\n');
        } else {
          console.error('   ❌ Failed to fetch family data:', familyResult.error);
        }
      } else {
        console.log('⚠️  NO FAMILY CONTEXT - needsFamilyContext =', selection.parameters?.needsFamilyContext);
        console.log('   GPT will answer WITHOUT family database access\n');
      }
      
      switch (selection.selectedTool) {
        case 'getDPOC':
          result = await this.familyClient.getDPOC();
          break;
          
        case 'getEvents':
          const name = selection.parameters?.name;
          if (!name) {
            throw new Error('Missing required parameter: name');
          }
          result = await this.familyClient.getEvents(name, selection.parameters?.refDate);
          break;
          
        case 'getFamily':
          result = await this.familyClient.getFamily(selection.parameters?.name);
          break;
          
        case 'answerGeneralQuery':
          // Pass family context to GPT if available - GPT does ALL the intelligence!
          result = await this.generalTool.answerGeneralQuery(query, familyContext);
          break;
          
        default:
          throw new Error(`Unknown tool: ${selection.selectedTool}`);
      }
      
      const executionTime = Date.now() - startTime;
      
      console.log('✅ TOOL EXECUTION COMPLETED');
      console.log(`   Success: ${result.success}`);
      console.log(`   Execution Time: ${executionTime}ms`);
      console.log('');
      
      // Normalize the result into unified format
      const unifiedResult = this.normalizeResult(result, selection.selectedTool);
      
      const response: AgentResponse = {
        query,
        selectedTool: selection.selectedTool,
        reasoning: selection.reasoning,
        result: unifiedResult,
        executionTime
      };
      
      console.log('='.repeat(80));
      console.log('✨ AGENT EXECUTION FINISHED');
      console.log('='.repeat(80) + '\n');
      
      return response;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      console.error('❌ ERROR:', error);
      console.log('='.repeat(80) + '\n');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        query,
        selectedTool: 'error',
        reasoning: 'Execution failed',
        result: {
          answer: `❌ Error: ${errorMessage}`,
          rawData: { error: errorMessage },
          metadata: {
            toolName: 'error'
          }
        },
        executionTime
      };
    }
  }

  /**
   * Normalize tool results into unified format
   * All tools return different data structures - this unifies them
   */
  private normalizeResult(toolResult: ToolResult, selectedTool: string): UnifiedResult {
    const data = toolResult.data || {};
    
    // Handle errors first (when success is false)
    if (!toolResult.success) {
      // If error has an answer field, use it
      if (data.answer) {
        return {
          answer: data.answer,
          rawData: data,
          metadata: {
            toolName: toolResult.toolName
          }
        };
      }
      // Otherwise create error message from error field
      const errorMsg = toolResult.error || 'Unknown error occurred';
      return {
        answer: `❌ Error: ${errorMsg}`,
        rawData: data,
        metadata: {
          toolName: toolResult.toolName
        }
      };
    }
    
    // Handle OpenAI/General Knowledge responses (has 'answer' field)
    if (data.answer) {
      return {
        answer: data.answer,
        rawData: data,
        metadata: {
          toolName: toolResult.toolName,
          model: data.model,
          usage: data.usage,
          hasContext: data.hasContext
        }
      };
    }
    
    // Handle Family members response (has 'members' array) - CHECK THIS BEFORE EVENTS!
    if (data.members && Array.isArray(data.members)) {
      // Special case: single member query (e.g., birthdate question)
      if (data.members.length === 1) {
        const member = data.members[0];
        const birthdate = new Date(member.birthdate);
        const answer = `${member.name} was born on ${birthdate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })} (${birthdate.toLocaleDateString()})`;
        
        return {
          answer,
          rawData: data,
          metadata: {
            toolName: toolResult.toolName,
            memberCount: 1,
            personName: member.name
          }
        };
      }
      
      // Multiple members: show list
      let answer = `Found ${data.count} family member(s)${data.name ? ` matching "${data.name}"` : ''}:\n\n`;
      data.members.forEach((member: any, i: number) => {
        const birthdate = new Date(member.birthdate).toLocaleDateString();
        answer += `${i + 1}. ${member.name} - Born: ${birthdate}\n`;
      });
      
      return {
        answer: answer.trim(),
        rawData: data,
        metadata: {
          toolName: toolResult.toolName,
          memberCount: data.count
        }
      };
    }
    
    // Handle Events responses (has 'events' array)
    if (data.events && Array.isArray(data.events)) {
      let answer = `Found ${data.count} event(s) for ${data.name}:\n\n`;
      data.events.forEach((event: any, i: number) => {
        const date = new Date(event.event_date).toLocaleDateString();
        answer += `${i + 1}. ${event.event_type} - ${date}\n`;
      });
      
      return {
        answer: answer.trim(),
        rawData: data,
        metadata: {
          toolName: toolResult.toolName,
          eventCount: data.count,
          personName: data.name
        }
      };
    }
    
    // Handle DPOC responses (has 'dpoc' field)
    if (data.dpoc) {
      const date = new Date(parseInt(data.dpoc) * 1000);
      return {
        answer: `DPOC (Date of Oldest Person in Clan): ${date.toLocaleDateString()}\n${data.description}`,
        rawData: data,
        metadata: {
          toolName: toolResult.toolName
        }
      };
    }
    
    // Handle calculation/math responses
    if (data.calculation) {
      return {
        answer: data.calculation,
        rawData: data,
        metadata: {
          toolName: toolResult.toolName
        }
      };
    }
    
    // Fallback: convert data to string
    return {
      answer: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      rawData: data,
      metadata: {
        toolName: toolResult.toolName
      }
    };
  }

  /**
   * Get information about the agent's capabilities
   */
  getCapabilities() {
    return {
      familyTools: this.familyClient.getAvailableTools(),
      generalTools: this.generalTool.getAvailableTools(),
      selectionStrategy: this.toolSelector.getSelectionStrategy()
    };
  }

  /**
   * Process multiple queries in sequence to demonstrate tool selection
   */
  async demonstrateToolSelection(queries: string[]): Promise<void> {
    console.log('\n' + '█'.repeat(80));
    console.log('🎓 TOOL SELECTION DEMONSTRATION');
    console.log('█'.repeat(80) + '\n');
    
    console.log('This demonstration shows how the agent selects different tools');
    console.log('based on the type of query it receives.\n');
    
    for (let i = 0; i < queries.length; i++) {
      console.log(`\n${'▼'.repeat(40)}`);
      console.log(`Query ${i + 1}/${queries.length}`);
      console.log('▼'.repeat(40));
      
      const response = await this.processQuery(queries[i]);
      
      console.log('📤 RESPONSE SUMMARY:');
      console.log(`   Query: "${response.query}"`);
      console.log(`   Tool Used: ${response.selectedTool}`);
      
      const resultStr = JSON.stringify(response.result || {});
      const preview = resultStr.length > 100 ? resultStr.substring(0, 100) + '...' : resultStr;
      console.log(`   Result Preview: ${preview}`);
      console.log('');
      
      // Small delay for readability
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '█'.repeat(80));
    console.log('✅ DEMONSTRATION COMPLETE');
    console.log('█'.repeat(80) + '\n');
  }
}
