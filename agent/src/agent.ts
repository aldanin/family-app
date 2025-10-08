/**
 * Main Agent Class
 * Orchestrates tool selection and execution
 */

import { FamilyMCPClient } from './familyMCPClient';
import { GeneralKnowledgeTool } from './generalKnowledgeTool';
import { ToolSelector } from './toolSelector';
import { AgentQuery, AgentResponse, ToolDefinition } from './types';

export class FamilyAgent {
  private familyClient: FamilyMCPClient;
  private generalTool: GeneralKnowledgeTool;
  private toolSelector: ToolSelector;

  constructor(mcpServerUrl?: string) {
    this.familyClient = new FamilyMCPClient(mcpServerUrl);
    this.generalTool = new GeneralKnowledgeTool();
    
    // Gather all available tools
    const allTools: ToolDefinition[] = [
      ...this.familyClient.getAvailableTools(),
      ...this.generalTool.getAvailableTools()
    ];
    
    this.toolSelector = new ToolSelector(allTools);
  }

  /**
   * Process a query - this is the main entry point
   */
  async processQuery(query: string): Promise<AgentResponse> {
    const startTime = Date.now();
    
    console.log('\n' + '='.repeat(80));
    console.log('🚀 AGENT EXECUTION STARTED');
    console.log('='.repeat(80));
    
    try {
      // Step 1: Select the appropriate tool
      const selection = this.toolSelector.selectTool(query);
      
      console.log('📊 TOOL SELECTION RESULT:');
      console.log(`   Selected Tool: ${selection.selectedTool}`);
      console.log(`   Confidence: ${(selection.confidence * 100).toFixed(0)}%`);
      console.log(`   Reasoning: ${selection.reasoning}`);
      console.log('');
      
      // Step 2: Execute the selected tool
      console.log('⚙️  EXECUTING TOOL...\n');
      
      let result;
      
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
          
        case 'answerGeneralQuery':
          result = await this.generalTool.answerGeneralQuery(query);
          break;
          
        default:
          throw new Error(`Unknown tool: ${selection.selectedTool}`);
      }
      
      const executionTime = Date.now() - startTime;
      
      console.log('✅ TOOL EXECUTION COMPLETED');
      console.log(`   Success: ${result.success}`);
      console.log(`   Execution Time: ${executionTime}ms`);
      console.log('');
      
      const response: AgentResponse = {
        query,
        selectedTool: selection.selectedTool,
        reasoning: selection.reasoning,
        result: result.data,
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
      
      return {
        query,
        selectedTool: 'error',
        reasoning: 'Execution failed',
        result: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        executionTime
      };
    }
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
      console.log(`   Result Preview: ${JSON.stringify(response.result).substring(0, 100)}...`);
      console.log('');
      
      // Small delay for readability
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '█'.repeat(80));
    console.log('✅ DEMONSTRATION COMPLETE');
    console.log('█'.repeat(80) + '\n');
  }
}
