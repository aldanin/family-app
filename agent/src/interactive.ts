/**
 * Interactive Demo
 * Shows how to use the agent with custom queries
 */

import dotenv from "dotenv";
dotenv.config();
import './config';
import { SinglePassAgent } from './agents/singlePassAgent';
import * as readline from 'readline';

async function runInteractive() {
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:6402/sse';
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  
  const agent = new SinglePassAgent(mcpServerUrl, openaiApiKey, openaiModel);

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
  console.log('  • "What is DPOCH?"');
  console.log('  • "Show Maya\'s events"');
  console.log('  • "Explain artificial intelligence"');
  console.log('  • "Tell me about Maya\'s achievements"');
  console.log('\nType "exit" to quit\n');

  const askQuestion = () => {
    rl.question('You: ', async (query) => {
      query = query.trim();

      if (query.toLowerCase() === 'exit') {
        console.log('\nGoodbye! 👋\n');
        rl.close();
        return;
      }

      if (!query) {
        askQuestion();
        return;
      }

      try {
        const response = await agent.processQuery(query);
        
        console.log('\n' + '─'.repeat(60));
        console.log('🤖 Agent:');
        console.log('─'.repeat(60));
        
        // Unified response - just print the answer!
        console.log(response.result.answer);
        
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
