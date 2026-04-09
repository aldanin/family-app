/**
 * HTTP API Server for Family AI Agent
 * Exposes the agent via REST API for the Angular frontend
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { SinglePassAgent } from '../../agent/dist/agents/singlePassAgent';
import { MultiPassAgent } from '../../agent/dist/agents/multiPassAgent';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for Angular frontend
app.use(express.json());

// Initialize the agent
const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:6402/sse';
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

// Embeddings path - use absolute path to avoid issues with compiled dist/ folder
const embeddingsPath = path.join(__dirname, '../../agent/assets/danin-embeddings.json');

// Create both agent types with embeddings path
const singlePassAgent = new SinglePassAgent(mcpServerUrl, openaiApiKey, openaiModel, embeddingsPath);
const multiPassAgent = new MultiPassAgent(mcpServerUrl, openaiApiKey, openaiModel, 5, embeddingsPath);

console.log('🤖 Family AI Agent API Server');
console.log('================================');
console.log(`MCP Server: ${mcpServerUrl}`);
console.log(`OpenAI Model: ${openaiModel}`);
console.log(`OpenAI Configured: ${openaiApiKey ? '✅ Yes' : '⚠️  No (fallback mode)'}`);
console.log(`Agents: Single-Pass + Multi-Pass ReACT`);
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
    const capabilities = singlePassAgent.getCapabilities();
    res.json(capabilities);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get capabilities',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Streaming query endpoint (SSE)
app.post('/api/query/stream', async (req: Request, res: Response) => {
  try {
    const { query, conversationHistory = [], mode = 'single-pass' } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter is required and must be a string'
      });
    }

    console.log(`📝 Received streaming query: "${query}" (mode: ${mode})`);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Only multi-pass mode supports streaming
    if (mode !== 'multi-pass') {
      // For single-pass, just send the result at once
      const selectedAgent = singlePassAgent;
      const response = await selectedAgent.processQuery(query, conversationHistory);
      res.write(`data: ${JSON.stringify({ type: 'complete', data: response })}\n\n`);
      res.end();
      return;
    }

    // Multi-pass with streaming
    // Set up callback to stream iterations as they happen
    multiPassAgent.setOnIterationCallback((iteration) => {
      res.write(`data: ${JSON.stringify({ type: 'iteration', data: iteration })}\n\n`);
    });

    const response = await multiPassAgent.processQuery(query, conversationHistory);
    
    // Send final complete message
    res.write(`data: ${JSON.stringify({ type: 'complete', data: response })}\n\n`);
    res.end();

  } catch (error) {
    console.error('❌ Error in streaming query:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })}\n\n`);
    res.end();
  }
});

// Main query endpoint (non-streaming, original)
app.post('/api/query', async (req: Request, res: Response) => {
  try {
    const { query, conversationHistory = [], mode = 'single-pass' } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter is required and must be a string'
      });
    }

    console.log(`📝 Received query: "${query}" (mode: ${mode}, history: ${conversationHistory.length} messages)`);

    // Select agent based on mode
    const selectedAgent = mode === 'multi-pass' ? multiPassAgent : singlePassAgent;
    const response = await selectedAgent.processQuery(query, conversationHistory);

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
      "What is DPOCH?",
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
