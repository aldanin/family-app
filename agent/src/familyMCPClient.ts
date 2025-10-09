/**
 * Tools for interacting with the Family MCP Server
 * This connects to the SAME MCP server that GitHub Copilot uses!
 * Both your agent and GitHub Copilot connect to: http://localhost:6402/sse
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { ToolResult } from './types';

export class FamilyMCPClient {
  private client: Client | null = null;
  private baseUrl: string;
  private isConnected: boolean = false;
  private toolSchemas: Map<string, any> = new Map(); // Cache tool schemas

  constructor(baseUrl: string = 'http://localhost:6402/sse') {
    this.baseUrl = baseUrl;
  }

  /**
   * Connect to the MCP server and fetch schemas
   */
  private async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      console.log(`🔌 Connecting to MCP server at ${this.baseUrl}...`);
      
      // Create SSE transport (same as GitHub Copilot uses)
      const transport = new SSEClientTransport(new URL(this.baseUrl));
      
      // Create MCP client
      this.client = new Client({
        name: 'family-agent',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Connect to the server
      await this.client.connect(transport);
      this.isConnected = true;
      
      console.log('✅ Connected to MCP server!');
      
      // Fetch tool schemas from the server
      await this.fetchToolSchemas();
    } catch (error) {
      console.error('❌ Failed to connect to MCP server:', error);
      throw error;
    }
  }

  /**
   * Fetch tool schemas from MCP server
   */
  private async fetchToolSchemas(): Promise<void> {
    try {
      if (!this.client) return;
      
      const result = await this.client.listTools();
      const tools = result.tools || [];
      
      console.log(`📋 Discovered ${tools.length} tools from MCP server:`);
      
      for (const tool of tools) {
        this.toolSchemas.set(tool.name, tool);
        console.log(`   - ${tool.name}: ${tool.description || 'No description'}`);
        
        // Log schema information
        if (tool.inputSchema) {
          console.log(`     Input: ${JSON.stringify(tool.inputSchema.properties || {})}`);
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not fetch tool schemas:', error);
    }
  }

  /**
   * Get schema for a specific tool
   */
  getToolSchema(toolName: string): any | null {
    return this.toolSchemas.get(toolName) || null;
  }

  /**
   * Get the Date Point of Commencement (oldest birthdate)
   */
  async getDPOC(): Promise<ToolResult> {
    try {
      console.log('🔧 [Tool: getDPOC] Calling family MCP server...');
      
      // Ensure connected
      await this.connect();
      
      if (!this.client) {
        throw new Error('MCP client not initialized');
      }

      // Call the tool
      const result = await this.client.callTool({
        name: 'getDPOC',
        arguments: {}
      });

      // Parse response
      const resultData = result as any;
      const content = resultData.content?.[0];
      let dpocValue: string;
      
      if (content?.type === 'text') {
        // Try to parse JSON response
        try {
          const parsed = JSON.parse(content.text);
          dpocValue = parsed.dpoc || parsed;
        } catch {
          dpocValue = content.text;
        }
      } else {
        dpocValue = String(content);
      }

      return {
        toolName: 'getDPOC',
        success: true,
        data: {
          dpoc: dpocValue,
          description: 'EPOCH timestamp of the oldest birthdate in the members table'
        },
        reasoning: 'Retrieved the family timeline reference point (DPOC) from MCP server'
      };
    } catch (error) {
      console.error('❌ Error calling getDPOC:', error);
      return {
        toolName: 'getDPOC',
        success: false,
        data: {
          answer: `❌ Error connecting to family MCP server: ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure the family-mcp-server is running on ${this.baseUrl}`
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        reasoning: 'Failed to connect to family MCP server'
      };
    }
  }

  /**
   * Get events for a specific family member
   */
  async getEvents(name: string, refDate?: number): Promise<ToolResult> {
    try {
      console.log(`🔧 [Tool: getEvents] Fetching events for ${name} from MCP server...`);
      
      // Ensure connected
      await this.connect();
      
      if (!this.client) {
        throw new Error('MCP client not initialized');
      }

      // Build arguments
      const args: Record<string, any> = { name };
      if (refDate !== undefined) {
        args.refDate = refDate;
      }

      // Call the tool
      const result = await this.client.callTool({
        name: 'getEvents',
        arguments: args
      });

      // Parse response
      const resultData = result as any;
      const content = resultData.content?.[0];
      let eventsData: any;
      
      if (content?.type === 'text') {
        try {
          eventsData = JSON.parse(content.text);
        } catch {
          throw new Error(`Failed to parse events response: ${content.text}`);
        }
      } else {
        eventsData = content;
      }

      // Check if we got events
      if (!eventsData.events || eventsData.events.length === 0) {
        return {
          toolName: 'getEvents',
          success: false,
          data: {
            answer: `Sorry, I don't have any events for "${name}" in the family database.\n\nTry asking "What is DPOC?" or check if the name is spelled correctly.`
          },
          error: `No events found for ${name}`,
          reasoning: `Family member ${name} has no events or was not found`
        };
      }

      return {
        toolName: 'getEvents',
        success: true,
        data: {
          name: eventsData.name,
          refDate: eventsData.refDate || (refDate?.toString() || '-255139200'),
          events: eventsData.events,
          count: eventsData.events.length
        },
        reasoning: `Retrieved ${eventsData.events.length} event(s) for ${name} from MCP server`
      };
    } catch (error) {
      console.error('❌ Error calling getEvents:', error);
      return {
        toolName: 'getEvents',
        success: false,
        data: {
          answer: `❌ Error retrieving events from MCP server: ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure the family-mcp-server is running on ${this.baseUrl}`
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        reasoning: 'Failed to retrieve family events from MCP server'
      };
    }
  }

  /**
   * Get family members list
   */
  async getFamily(name?: string): Promise<ToolResult> {
    try {
      console.log(`🔧 [Tool: getFamily] Fetching family members${name ? ` matching "${name}"` : ''}...`);
      
      // Ensure connected
      await this.connect();
      
      if (!this.client) {
        throw new Error('MCP client not initialized');
      }

      // Build arguments
      const args: Record<string, any> = {};
      if (name) {
        args.name = name;
      }

      // Call the tool
      const result = await this.client.callTool({
        name: 'getFamily',
        arguments: args
      });

      // Parse response
      const resultData = result as any;
      const content = resultData.content?.[0];
      let familyData: any;
      
      if (content?.type === 'text') {
        try {
          familyData = JSON.parse(content.text);
        } catch {
          throw new Error(`Failed to parse family response: ${content.text}`);
        }
      } else {
        familyData = content;
      }

      // Check if we got members
      if (!familyData.members || familyData.members.length === 0) {
        return {
          toolName: 'getFamily',
          success: false,
          data: {
            answer: name 
              ? `Sorry, I couldn't find any family member matching "${name}".`
              : `No family members found in the database.`
          },
          error: 'No family members found',
          reasoning: name ? `No match for "${name}"` : 'Empty family database'
        };
      }

      return {
        toolName: 'getFamily',
        success: true,
        data: {
          name: familyData.name,
          members: familyData.members,
          count: familyData.count || familyData.members.length
        },
        reasoning: name 
          ? `Found ${familyData.count} family member(s) matching "${name}"`
          : `Retrieved ${familyData.count} family members from database`
      };
    } catch (error) {
      console.error('❌ Error calling getFamily:', error);
      return {
        toolName: 'getFamily',
        success: false,
        data: {
          answer: `❌ Error retrieving family members from MCP server: ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure the family-mcp-server is running on ${this.baseUrl}`
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        reasoning: 'Failed to retrieve family members from MCP server'
      };
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('🔌 Disconnected from MCP server');
    }
  }

  /**
   * List all available tools from the MCP server
   */
  async listTools(): Promise<any[]> {
    try {
      await this.connect();
      
      if (!this.client) {
        throw new Error('MCP client not initialized');
      }

      const result = await this.client.listTools();
      return result.tools || [];
    } catch (error) {
      console.error('❌ Error listing MCP tools:', error);
      return [];
    }
  }

  /**
   * Get available family-related tools (static list for tool selection)
   */
  getAvailableTools() {
    return [
      {
        name: 'getDPOC',
        description: 'Get the Date Point of Commencement (oldest family member birthdate)',
        category: 'family' as const,
        parameters: {}
      },
      {
        name: 'getEvents',
        description: 'Get timeline events for a specific family member',
        category: 'family' as const,
        parameters: {
          name: { type: 'string', required: true, description: 'Name of the family member' },
          refDate: { type: 'number', required: false, description: 'Reference date as EPOCH number' }
        }
      },
      {
        name: 'getFamily',
        description: 'Get list of all family members or search for a specific member by name',
        category: 'family' as const,
        parameters: {
          name: { type: 'string', required: false, description: 'Optional: name to filter family members' }
        }
      }
    ];
  }
}
