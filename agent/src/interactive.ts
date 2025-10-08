/**
 * Interactive Demo
 * Shows how to use the agent with custom queries
 */

import './config';
import { FamilyAgent } from './agent';
import * as readline from 'readline';

async function runInteractive() {
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:6402';
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  
  const agent = new FamilyAgent(mcpServerUrl, openaiApiKey, openaiModel);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         FAMILY AI AGENT - INTERACTIVE MODE            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  if (!openaiApiKey) {
    console.log('⚠️  Warning: OpenAI API key not configured');
    console.log('   Add OPENAI_API_KEY to .env for GPT-powered responses\n');
  } else {
    console.log(`✅ OpenAI configured (model: ${openaiModel})\n`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('Type your queries below. Examples:');
  console.log('  • "What is DPOC?"');
  console.log('  • "Show Maya\'s events"');
  console.log('  • "Explain artificial intelligence"');
  console.log('  • "Tell me about Maya\'s achievements" (hybrid!)');
  console.log('\nType "exit" to quit, "hybrid" to toggle hybrid mode\n');

  let hybridMode = false;

  const askQuestion = () => {
    const prefix = hybridMode ? '[HYBRID] ' : '';
    rl.question(`${prefix}You: `, async (query) => {
      query = query.trim();

      if (query.toLowerCase() === 'exit') {
        console.log('\nGoodbye! 👋\n');
        rl.close();
        return;
      }

      if (query.toLowerCase() === 'hybrid') {
        hybridMode = !hybridMode;
        console.log(`\n🔀 Hybrid mode: ${hybridMode ? 'ON' : 'OFF'}\n`);
        askQuestion();
        return;
      }

      if (!query) {
        askQuestion();
        return;
      }

      try {
        const response = await agent.processQuery(query, hybridMode);
        
        console.log('\n' + '─'.repeat(60));
        console.log('🤖 Agent:');
        console.log('─'.repeat(60));
        
        if (response.result.answer) {
          console.log(response.result.answer);
        } else if (response.result.events) {
          console.log(`\nFound ${response.result.count} events for ${response.result.name}:`);
          response.result.events.forEach((event: any, i: number) => {
            const date = new Date(event.event_date).toLocaleDateString();
            console.log(`  ${i + 1}. ${event.event_type} - ${date}`);
          });
        } else if (response.result.dpoc) {
          console.log(`DPOC: ${response.result.dpoc}`);
          console.log(response.result.description);
        } else {
          console.log(JSON.stringify(response.result, null, 2));
        }
        
        console.log('\n' + '─'.repeat(60));
        console.log(`Tool: ${response.selectedTool} | Time: ${response.executionTime}ms`);
        console.log('─'.repeat(60) + '\n');
        
      } catch (error) {
        console.error('\n❌ Error:', error);
        console.log('');
      }

      askQuestion();
    });
  };

  askQuestion();
}

runInteractive().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
