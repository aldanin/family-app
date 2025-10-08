/**
 * Main Entry Point - Demonstrates the AI Agent
 * Run this to see how the agent selects tools based on queries
 */

import { FamilyAgent } from './agent';

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      FAMILY AI AGENT DEMONSTRATION                         ║');
  console.log('║                                                                            ║');
  console.log('║  This agent demonstrates intelligent tool selection:                      ║');
  console.log('║  • Family queries → family-mcp-server tools                               ║');
  console.log('║  • General queries → built-in knowledge tools                             ║');
  console.log('║                                                                            ║');
  console.log('║  Watch the decision-making process as the agent chooses the right tool!   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Initialize the agent
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:6402';
  const agent = new FamilyAgent(mcpServerUrl);

  // Show capabilities
  console.log('📋 AGENT CAPABILITIES:\n');
  const capabilities = agent.getCapabilities();
  
  console.log('Family Tools:');
  capabilities.familyTools.forEach(tool => {
    console.log(`  • ${tool.name}: ${tool.description}`);
  });
  
  console.log('\nGeneral Tools:');
  capabilities.generalTools.forEach(tool => {
    console.log(`  • ${tool.name}: ${tool.description}`);
  });
  
  console.log('\n' + capabilities.selectionStrategy);
  
  // Demonstration queries showing different tool selections
  const demoQueries = [
    // Family queries
    "What is DPOC?",
    "Show me Maya's events",
    "When did Maya graduate?",
    
    // General queries
    "What is 15 + 27?",
    "What time is it?",
    "What is AI?",
    
    // Mixed/ambiguous
    "Tell me about the family timeline"
  ];

  // Run the demonstration
  await agent.demonstrateToolSelection(demoQueries);

  // Interactive mode hint
  console.log('\n💡 TIP: You can extend this to create an interactive mode or HTTP API!');
  console.log('   See the README.md for examples.\n');
}

// Run the demonstration
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
