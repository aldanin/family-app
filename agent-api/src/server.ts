/**
 * HTTP API Server for Family AI Agent
 * Exposes the agent via REST API for the Angular frontend
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { FamilyAgent } from '../../agent/src/agent';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for Angular frontend
app.use(express.json());

// Initialize the agent
const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:6402';
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const agent = new FamilyAgent(mcpServerUrl, openaiApiKey, openaiModel);

console.log('🤖 Family AI Agent API Server');
console.log('================================');
console.log(`MCP Server: ${mcpServerUrl}`);
console.log(`OpenAI Model: ${openaiModel}`);
console.log(`OpenAI Configured: ${openaiApiKey ? '✅ Yes' : '⚠️  No (fallback mode)'}`);
console.log('');

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    openai: !!openaiApiKey,
    mcpServer: mcpServerUrl
  });
});

// Get agent capabilities
app.get('/api/capabilities', (req: Request, res: Response) => {
  try {
    const capabilities = agent.getCapabilities();
    res.json(capabilities);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get capabilities',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Main query endpoint
app.post('/api/query', async (req: Request, res: Response) => {
  try {
    const { query, hybridMode = false } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter is required and must be a string'
      });
    }

    console.log(`📝 Received query: "${query}" (hybrid: ${hybridMode})`);

    const response = await agent.processQuery(query, hybridMode);

    console.log(`✅ Response generated (tool: ${response.selectedTool}, time: ${response.executionTime}ms)`);

    res.json(response);
  } catch (error) {
    console.error('❌ Error processing query:', error);
    res.status(500).json({
      error: 'Query processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Example queries endpoint
app.get('/api/examples', (req: Request, res: Response) => {
  res.json({
    family: [
      "What is DPOC?",
      "Show me Maya's events",
      "When did Maya graduate?"
    ],
    general: [
      "Explain what artificial intelligence is",
      "What are the benefits of learning TypeScript?",
      "Tell me about wedding traditions"
    ],
    hybrid: [
      "Tell me about Maya's achievements and why they matter",
      "Analyze Maya's timeline and give me insights",
      "What can you tell me about graduations? When did Maya graduate?"
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints:`);
  console.log(`   GET  /api/health - Health check`);
  console.log(`   GET  /api/capabilities - Agent capabilities`);
  console.log(`   POST /api/query - Process a query`);
  console.log(`   GET  /api/examples - Example queries`);
  console.log('');
  console.log('Ready to accept requests! 🎉\n');
});
