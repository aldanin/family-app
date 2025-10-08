"use strict";
/**
 * Tools for interacting with the Family MCP Server
 * This demonstrates how an agent connects to external MCP servers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FamilyMCPClient = void 0;
class FamilyMCPClient {
    constructor(baseUrl = 'http://localhost:6402') {
        this.baseUrl = baseUrl;
    }
    /**
     * Get the Date Point of Commencement (oldest birthdate)
     */
    async getDPOC() {
        try {
            console.log('🔧 [Tool: getDPOC] Fetching oldest family member birthdate...');
            // Note: This is a placeholder - in a real MCP implementation,
            // you would use the MCP protocol to call the tool
            // For now, we'll simulate the response based on what we know works
            const result = {
                dpoc: '-255139200',
                description: 'EPOCH timestamp of the oldest birthdate in the members table'
            };
            return {
                toolName: 'getDPOC',
                success: true,
                data: result,
                reasoning: 'Retrieved the family timeline reference point (DPOC)'
            };
        }
        catch (error) {
            return {
                toolName: 'getDPOC',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                reasoning: 'Failed to connect to family MCP server'
            };
        }
    }
    /**
     * Get events for a specific family member
     */
    async getEvents(name, refDate) {
        try {
            console.log(`🔧 [Tool: getEvents] Fetching events for ${name}...`);
            // Note: This is a placeholder - in a real MCP implementation,
            // you would use the MCP protocol to call the tool
            // For demonstration, we'll simulate based on known data
            // Simulated response - in production this would call the actual MCP server
            const mockData = {
                'Maya': {
                    name: 'Maya',
                    refDate: refDate?.toString() || '-255139200',
                    events: [
                        {
                            event_date: '2023-06-11T21:00:00.000Z',
                            event_type: 'University Graduation',
                            name: 'Maya',
                            event_epoch: '1686528000'
                        },
                        {
                            event_date: '2024-06-06T21:00:00.000Z',
                            event_type: 'Wedding date',
                            name: 'Maya',
                            event_epoch: '1717718400'
                        }
                    ],
                    count: 2
                }
            };
            const data = mockData[name];
            if (!data) {
                return {
                    toolName: 'getEvents',
                    success: false,
                    error: `No events found for ${name}`,
                    reasoning: `Family member ${name} not found in database`
                };
            }
            return {
                toolName: 'getEvents',
                success: true,
                data,
                reasoning: `Retrieved ${data.count} event(s) for ${name} from family database`
            };
        }
        catch (error) {
            return {
                toolName: 'getEvents',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                reasoning: 'Failed to retrieve family events'
            };
        }
    }
    /**
     * Get available family-related tools
     */
    getAvailableTools() {
        return [
            {
                name: 'getDPOC',
                description: 'Get the Date Point of Commencement (oldest family member birthdate)',
                category: 'family',
                parameters: {}
            },
            {
                name: 'getEvents',
                description: 'Get timeline events for a specific family member',
                category: 'family',
                parameters: {
                    name: { type: 'string', required: true, description: 'Name of the family member' },
                    refDate: { type: 'number', required: false, description: 'Reference date as EPOCH number' }
                }
            }
        ];
    }
}
exports.FamilyMCPClient = FamilyMCPClient;
