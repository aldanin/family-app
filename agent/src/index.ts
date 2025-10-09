/**
 * Main Entry Point - Demonstrates the AI Agent
 * Run this to see how the agent selects tools based on queries
 */

import './config'; // Load environment variables
import { FamilyAgent } from './agent';

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      FAMILY AI AGENT DEMONSTRATION                         ║');
  console.log('║                                                                            ║');
  console.log('║  This agent demonstrates intelligent tool selection:                      ║');
  console.log('║  • Family queries → family-mcp-server tools                               ║');
  console.log('║  • General queries → OpenAI GPT API                                       ║');
  console.log('║  • Hybrid queries → GPT + Family data combined!                           ║');
  console.log('║                                                                            ║');
  console.log('║  Watch the decision-making process as the agent chooses the right tool!   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Initialize the agent with OpenAI
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:6402';
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  
  const agent = new FamilyAgent(mcpServerUrl, openaiApiKey, openaiModel);

  // Show capabilities
  console.log('📋 AGENT CAPABILITIES:\n');
  const capabilities = agent.getCapabilities();
  
  console.log('Family Tools:');
  capabilities.familyTools.forEach(tool => {
    console.log(`  • ${tool.name}: ${tool.description}`);
  });
  
  console.log('\nGeneral Tools (OpenAI Powered):');
  capabilities.generalTools.forEach(tool => {
    console.log(`  • ${tool.name}: ${tool.description}`);
  });
  
  console.log('\n' + capabilities.selectionStrategy);
  
  // Demonstration queries showing different tool selections
  const demoQueries = [
    // Family queries - use MCP server
    "What is DPOCH?",
    "Show me Maya's events",
    
    // General queries - use OpenAI
    "Explain what artificial intelligence is in simple terms",
    "What are the benefits of learning TypeScript?",
    
    // Hybrid queries - combine both!
    "Tell me about Maya's achievements and explain why university graduation is important",
    "What can you tell me about weddings? Also, when did Maya get married?"
  ];

  // Run the demonstration
  await agent.demonstrateToolSelection(demoQueries);

  // Show hybrid query example
  console.log('\n\n' + '█'.repeat(80));
  console.log('🌟 HYBRID QUERY DEMONSTRATION');
  console.log('█'.repeat(80));
  console.log('\nHybrid queries combine family data with GPT intelligence!\n');
  
  const hybridQuery = "Tell me an interesting fact about Maya based on her events";
  console.log(`Query: "${hybridQuery}"\n`);
  
  const hybridResponse = await agent.processQuery(hybridQuery, true);
  console.log('\n📤 HYBRID RESPONSE:');
  console.log(JSON.stringify(hybridResponse.result, null, 2));

  // Interactive mode hint
  console.log('\n\n💡 TIP: Configure your OpenAI API key in .env to enable GPT responses!');
  console.log('   Copy .env.example to .env and add: OPENAI_API_KEY=sk-your-key-here');
  console.log('\n💡 TIP: You can extend this to create an interactive mode or HTTP API!');
  console.log('   See the README.md for examples.\n');
}

// Run the demonstration
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
