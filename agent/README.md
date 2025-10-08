# Family AI Agent

An educational TypeScript AI agent that demonstrates **intelligent tool selection** between family-specific queries (using your family-mcp-server) and general knowledge queries.

## 🎯 What This Demonstrates

This agent shows how AI agents decide which tool to use based on the query type:

1. **Family Queries** → Uses family-mcp-server tools (getDPOC, getEvents)
2. **General Queries** → Uses built-in knowledge (math, time, definitions)
3. **Decision Logging** → Shows WHY each tool was selected

## 🏗️ Architecture

```
User Query
    ↓
Tool Selector (Brain)
    ↓
┌─────────────┬─────────────┐
│   Family    │   General   │
│     MCP     │  Knowledge  │
│   Client    │    Tool     │
└─────────────┴─────────────┘
    ↓
Response
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

### 2. Configure (Optional)

Copy `.env.example` to `.env` and adjust if needed:

```bash
copy .env.example .env
```

Default settings:
- MCP Server: `http://localhost:6402`
- Agent Port: `3000`

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

- "What is DPOC?" → `getDPOC` tool
- "Show me Maya's events" → `getEvents` tool
- "When did Maya graduate?" → `getEvents` tool

### General Queries (→ built-in knowledge)

- "What is 15 + 27?" → Math handler
- "What time is it?" → DateTime handler
- "What is AI?" → Definition handler

## 🔍 Understanding Tool Selection

The agent logs its decision-making process:

```
🤖 [Agent Decision Process] Analyzing query...
📝 Query: "Show me Maya's events"
🔍 Available tools: getDPOC, getEvents, answerGeneralQuery

✓ Detected family-related keywords
  → Detected person name: "Maya"
  → Decision: Use getEvents tool
  → Reason: Query is about events for Maya
```

### Selection Logic

1. **Keyword Detection** - Looks for family terms (names, events, dpoc)
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
2. Update the `getDPOC()` and `getEvents()` methods
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
- **Tools Used**: `getDPOC`, `getEvents`

Make sure your family-mcp-server is running before starting the agent!

## 💡 Next Steps

1. **Run the demo** to see tool selection in action
2. **Modify queries** in `index.ts` to test different scenarios
3. **Add logging** to understand the decision process better
4. **Extend with LLM** integration for smarter query understanding
5. **Build a UI** to interact with the agent

## 📝 License

MIT
