# Quick Start Guide - OpenAI + MCP Integration

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd agent
npm install
```

### 2. Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy it

### 3. Configure Environment

```bash
copy .env.example .env
```

Edit `.env`:
```env
OPENAI_API_KEY=sk-proj-your-actual-key-here
OPENAI_MODEL=gpt-4o-mini
MCP_SERVER_URL=http://localhost:6402
```

### 4. Build and Run

```bash
npm run build
npm start
```

## 🎓 Understanding the Agent

### Three Types of Queries

#### 1. Family Queries → MCP Server
```
"What is DPOC?"
"Show Maya's events"
```
- Uses family-mcp-server tools
- No OpenAI API call needed
- Fast and efficient

#### 2. General Queries → OpenAI GPT
```
"Explain artificial intelligence"
"What are the benefits of TypeScript?"
```
- Calls OpenAI API
- Uses GPT intelligence
- Can answer anything

#### 3. Hybrid Queries → Both Combined! 🌟
```
"Tell me about Maya's achievements and why they matter"
"Analyze Maya's timeline and give me insights"
```
- Step 1: Fetches family data from MCP
- Step 2: Passes data to GPT as context
- Step 3: GPT provides intelligent analysis
- **This is the powerful feature!**

## 💡 How Hybrid Mode Works

```typescript
// When you call with hybrid mode:
await agent.processQuery("Tell me about Maya", true);
//                                              ^^^^
//                                          hybrid mode!

// The agent:
// 1. Detects "Maya" in the query
// 2. Fetches Maya's events from MCP server
// 3. Passes events as context to OpenAI
// 4. GPT analyzes the data and responds
```

## 🔧 Code Example

```typescript
import { FamilyAgent } from './agent';

const agent = new FamilyAgent(
  'http://localhost:6402',  // MCP server URL
  'sk-your-openai-key',      // OpenAI API key
  'gpt-4o-mini'              // Model
);

// Regular query
const response1 = await agent.processQuery("What is DPOC?");

// Hybrid query (combines MCP + GPT)
const response2 = await agent.processQuery(
  "Tell me about Maya's achievements",
  true  // Enable hybrid mode
);

console.log(response2.result.answer);
// GPT response with Maya's actual event data as context!
```

## 📊 Cost Considerations

- **Family queries**: Free (uses your MCP server)
- **General queries**: ~$0.0001-0.0005 per query (GPT-4o-mini)
- **Hybrid queries**: ~$0.0002-0.001 per query (slightly more context)

GPT-4o-mini is very affordable! Most queries cost less than a cent.

## 🎯 Best Practices

1. **Use family queries** when you just need data
2. **Use general queries** when you need GPT intelligence
3. **Use hybrid queries** when you want GPT to analyze family data
4. **Monitor API usage** if running in production

## 🔍 Debugging

Enable detailed logging by checking the console output:
- `🔧 [Tool: ...]` shows which tool is running
- `→ Calling OpenAI API...` shows when GPT is used
- `✓ GPT response received (X tokens)` shows token usage

## ⚡ Next Steps

1. Run the demo: `npm start`
2. Try modifying queries in `src/index.ts`
3. Experiment with hybrid mode
4. Build your own interactive UI!

## 🤔 Troubleshooting

**"OpenAI not configured"**
- Add your API key to `.env`
- Restart the application

**"Cannot find module 'openai'"**
- Run `npm install`

**"MCP server not responding"**
- Make sure family-mcp-server is running on port 6402
- Check the URL in `.env`

## 📚 Learn More

- See `README.md` for full documentation
- Check `src/toolSelector.ts` to understand decision logic
- Study `src/generalKnowledgeTool.ts` for OpenAI integration
- Read `src/agent.ts` for hybrid query implementation
