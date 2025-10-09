# Family AI Agent

An educational TypeScript AI agent that demonstrates **intelligent tool selection** and **hybrid responses** by combining your family-mcp-server data with OpenAI's GPT.

## 🎯 What This Demonstrates

This agent shows how AI agents decide which tool to use and combine multiple data sources:

1. **Family Queries** → Uses family-mcp-server tools (getDPOCH, getEvents)
2. **General Queries** → Uses OpenAI GPT for intelligent responses
3. **Hybrid Queries** → Combines family data WITH GPT analysis! 🌟
4. **Decision Logging** → Shows WHY each tool was selected

### Why This Matters

Real-world AI agents need to:
- Select the right tool for each query
- Combine data from multiple sources
- Provide context-aware responses
- Make transparent decisions

This project shows you exactly how to build that!

## 🏗️ Architecture

```
User Query
    ↓
Tool Selector (Brain) ← Analyzes query type
    ↓
┌─────────────┬─────────────┬──────────────┐
│   Family    │   OpenAI    │   Hybrid     │
│     MCP     │     GPT     │  (Both!)     │
│   Client    │     API     │              │
└─────────────┴─────────────┴──────────────┘
    ↓
Combined Response
```

### Components

- **Agent** (`agent.ts`) - Main orchestrator
- **Tool Selector** (`toolSelector.ts`) - Decision engine (the "brain")
- **Family MCP Client** (`familyMCPClient.ts`) - Connects to family-mcp-server
- **General Knowledge Tool** (`generalKnowledgeTool.ts`) - Handles non-family queries
- **Types** (`types.ts`) - TypeScript interfaces

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd agent
npm install
```

### 2. Configure Your API Keys

**Important:** Copy `.env.example` to `.env` and add your OpenAI API key:

```bash
copy .env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
MCP_SERVER_URL=http://localhost:6402
AGENT_PORT=3000

# Get your API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

**Note:** The agent will work without an API key (using fallback responses), but you'll miss the GPT-powered features!

### 3. Build

```bash
npm run build
```

### 4. Run the Demonstration

```bash
npm start
```

This will run several example queries and show you how the agent selects tools!

## 📚 Example Queries

### Family Queries (→ family-mcp-server)

- "What is DPOCH?" → `getDPOCH` tool
- "Show me Maya's events" → `getEvents` tool
- "When did Maya graduate?" → `getEvents` tool

### General Queries (→ OpenAI GPT)

- "Explain what artificial intelligence is" → GPT response
- "What are the benefits of TypeScript?" → GPT response
- "Tell me about wedding traditions" → GPT response

### 🌟 Hybrid Queries (→ MCP + GPT Combined!)

These are where it gets interesting! The agent fetches family data and asks GPT to analyze it:

- **"Tell me about Maya's achievements and explain why they're important"**
  - Step 1: Fetches Maya's events from MCP server
  - Step 2: Passes events to GPT for intelligent analysis
  - Result: Context-aware response combining both!

- **"What can you tell me about weddings? Also, when did Maya get married?"**
  - Combines general knowledge about weddings with Maya's specific wedding date

- **"Tell me an interesting fact about Maya based on her events"**
  - GPT analyzes Maya's timeline and generates insights

## 🔍 Understanding Tool Selection

The agent logs its decision-making process:

```
🤖 [Agent Decision Process] Analyzing query...
📝 Query: "Show me Maya's events"
🔍 Available tools: getDPOCH, getEvents, answerGeneralQuery

✓ Detected family-related keywords
  → Detected person name: "Maya"
  → Decision: Use getEvents tool
  → Reason: Query is about events for Maya

⚙️  EXECUTING TOOL...
🔧 [Tool: getEvents] Fetching events for Maya...
   ✓ Retrieved 2 event(s) for Maya from family database
```

### Hybrid Query Example

```
Query: "Tell me about Maya's achievements"

🔗 HYBRID MODE: Fetching family context first...
   ✓ Retrieved family context for Maya

🔧 [Tool: GeneralKnowledge/OpenAI] Processing query...
   → Calling OpenAI API...
   → Passing family context: Maya's graduation and wedding events
   ✓ GPT response received (324 tokens)

Result: GPT analyzes Maya's actual events and provides
        intelligent commentary about her achievements!
```

### Selection Logic

1. **Keyword Detection** - Looks for family terms (names, events, dpoch)
2. **Pattern Matching** - Matches general patterns (math, time, definitions)
3. **Confidence Scoring** - Assigns confidence to each decision
4. **Fallback** - Uses general handler when uncertain

## 🛠️ Development

### Watch Mode

```bash
npm run watch
```

### Project Structure

```
agent/
├── src/
│   ├── agent.ts              # Main orchestrator
│   ├── toolSelector.ts       # Tool selection logic ⭐
│   ├── familyMCPClient.ts    # Family MCP server client
│   ├── generalKnowledgeTool.ts # General knowledge handler
│   ├── types.ts              # TypeScript interfaces
│   └── index.ts              # Entry point / demo
├── dist/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Extending the Agent

### Add a New Tool

1. Create tool class (see `generalKnowledgeTool.ts` as example)
2. Add tool detection logic in `toolSelector.ts`
3. Register tool in `agent.ts` constructor
4. Add execution case in `agent.ts` processQuery

### Connect to Real MCP Server

Currently, the family MCP client uses mock data. To connect to a real server:

1. Implement MCP protocol HTTP calls in `familyMCPClient.ts`
2. Update the `getDPOCH()` and `getEvents()` methods
3. Point `MCP_SERVER_URL` to your running server

### Add Interactive Mode

```typescript
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Your query: ', async (query) => {
  const response = await agent.processQuery(query);
  console.log(response.result);
  rl.close();
});
```

### Create HTTP API

```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/query', async (req, res) => {
  const response = await agent.processQuery(req.body.query);
  res.json(response);
});

app.listen(3000);
```

## 📖 Learning Objectives

By studying this code, you'll learn:

1. ✅ How agents select appropriate tools
2. ✅ Pattern matching and keyword detection
3. ✅ Confidence scoring in AI decisions
4. ✅ Graceful fallback strategies
5. ✅ TypeScript for AI agent development
6. ✅ MCP (Model Context Protocol) integration

## 🤝 Integration with Your Family MCP Server

This agent is designed to work with your existing family-mcp-server:

- **Endpoint**: `http://localhost:6402/sse`
- **Tools Used**: `getDPOCH`, `getEvents`

Make sure your family-mcp-server is running before starting the agent!

## 💡 Next Steps

1. **Run the demo** to see tool selection in action
2. **Modify queries** in `index.ts` to test different scenarios
3. **Add logging** to understand the decision process better
4. **Extend with LLM** integration for smarter query understanding
5. **Build a UI** to interact with the agent

## 📝 License

MIT
