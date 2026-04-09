# Family Agent Application

A conversational AI agent that answers questions about your family using a Model Context Protocol (MCP) server as the data source.

## 🎯 What Does It Do?

Ask natural language questions about your family, and the AI agent:
- Fetches data from a family database (via MCP server)
- Uses GPT to generate natural, conversational answers
- Combines family data with general knowledge when needed

**Examples:**
- "When was Agam born?" → Gets birthdate from database
- "Does Maya have a degree?" → Checks family events for education
- "If I have a stutter, who should I call?" → Recommends Maya (communication therapist)
- "What world events happened when Roy was born?" → Combines Roy's birth year with historical knowledge

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE (UI)                          │
│                     Angular App (Port 4200)                          │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ • Chat interface (ChatGPT-style)                           │    │
│  │ • Sends queries to API                                      │    │
│  │ • Displays natural language responses                       │    │
│  └────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP POST /api/query
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENT API (Backend)                          │
│                     Express.js (Port 3001)                           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ • Receives user queries                                     │    │
│  │ • Forwards to FamilyAgent                                   │    │
│  │ • Returns unified responses                                 │    │
│  └────────────────────────────┬───────────────────────────────┘    │
└────────────────────────────────┼────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FAMILY AGENT (Core Logic)                       │
│                         TypeScript Agent                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  1. TOOL SELECTOR (LLM-based decision making)              │    │
│  │     • Analyzes query using GPT                              │    │
│  │     • Decides what data to fetch (members/events/none)      │    │
│  │     • No hard-coded rules - fully LLM-driven               │    │
│  │                                                              │    │
│  │  2. DATA FETCHER                                            │    │
│  │     • Fetches from MCP server based on selector decision    │    │
│  │     • Can fetch: members, events, DPOCH                     │    │
│  │                                                              │    │
│  │  3. ANSWER GENERATOR (GPT with context)                     │    │
│  │     • Receives: query + optional family data                │    │
│  │     • Generates natural language answer                     │    │
│  │     • Combines family data + general knowledge              │    │
│  └────────────────────────────┬───────────────────────────────┘    │
└────────────────────────────────┼────────────────────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                ▼                                  ▼
    ┌───────────────────────┐        ┌───────────────────────┐
    │   MCP SERVER          │        │   OPENAI API          │
   │   (Port 6402)         │        │   (gpt-5.4-mini)      │
    │                       │        │                       │
    │ • getFamily()         │        │ • Tool selection      │
    │ • getEvents(name)     │        │ • Answer generation   │
    │ • getDPOCH()          │        │                       │
    └───────────────────────┘        └───────────────────────┘
            │
            ▼
    ┌───────────────────────┐
    │  FAMILY DATABASE      │
    │  (SQLite)             │
    │                       │
    │ • members table       │
    │ • events table        │
    └───────────────────────┘
```

---

## 🔄 Request Flow (Step by Step)

### Example: "When was Agam born?"

```
1. USER types in UI → "When was Agam born?"

2. UI sends HTTP POST → http://localhost:3001/api/query
   Body: { "query": "When was Agam born?" }

3. AGENT-API receives query → forwards to FamilyAgent.processQuery()

4. TOOL SELECTOR (GPT-5.4-mini) analyzes query:
   Input: "When was Agam born?"
   Decision: {
     tool: "answerGeneralQuery",
     fetchMembers: true,    ← Needs member data
     fetchEvents: false,
     reasoning: "Query asks for birthdate, needs member data"
   }

5. AGENT fetches data from MCP:
   → Calls familyMCPClient.getFamily()
   → MCP server queries database
   ← Returns: [{ name: "Agam", birthdate: "2024-11-20", ... }, ...]

6. ANSWER GENERATOR (GPT-5.4-mini) creates response:
   Input: 
     - Query: "When was Agam born?"
     - Context: Family members data
   Output: "Agam was born on November 20, 2024."

7. AGENT-API returns to UI:
   {
     "query": "When was Agam born?",
     "selectedTool": "answerGeneralQuery",
     "result": {
       "answer": "Agam was born on November 20, 2024."
     }
   }

8. UI displays the answer in chat interface
```

### Example: "If I have a stutter, who should I call?"

```
1. USER types → "If I have a stutter, who should I call?"

2. UI → API → Agent

3. TOOL SELECTOR (GPT) decides:
   {
     tool: "answerGeneralQuery",
     fetchMembers: true,     ← Needs to check occupations
     fetchEvents: false,
     reasoning: "Implicit family context - looking for skills/expertise"
   }

4. AGENT fetches members from MCP:
   Returns: [
     { name: "Maya", occupation: ["Communication Therapist"] },
     { name: "Alon", occupation: ["Musician"] },
     ...
   ]

5. ANSWER GENERATOR (GPT) matches:
   - Sees Maya is a Communication Therapist
   - Matches with "stutter" problem
   Output: "You should contact Maya, who is a communication therapist."

6. Response → API → UI → User sees answer
```

---

## 📁 Project Structure

```
family-app/
├── agent/                          # Core TypeScript agent
│   ├── src/
│   │   ├── agent.ts                # Main orchestrator
│   │   ├── toolSelector.ts         # LLM-based tool selection
│   │   ├── answerGenerator.ts      # GPT answer generation
│   │   ├── familyMCPClient.ts      # MCP server communication
│   │   └── types.ts                # TypeScript interfaces
│   └── package.json
│
├── agent-api/                      # Express.js REST API
│   ├── src/
│   │   └── server.ts               # HTTP endpoint for UI
│   ├── .env                        # MCP_SERVER_URL, OPENAI_API_KEY
│   └── package.json
│
├── family-agent-ui/                # Angular frontend
│   ├── src/app/
│   │   ├── app.component.ts        # Main chat component
│   │   ├── app.component.html      # Chat UI template
│   │   └── app.component.css       # Styles
│   └── package.json
│
├── package.json                    # Root scripts (npm start/stop)
└── README.md                       # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- MCP Family Server running on `http://localhost:6402/sse`
- OpenAI API key

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API keys:**
   ```bash
   # Create .env file in agent-api/
   echo MCP_SERVER_URL=http://localhost:6402/sse > agent-api\.env
   echo OPENAI_API_KEY=your-key-here >> agent-api\.env
   echo OPENAI_MODEL=gpt-5.4-mini >> agent-api\.env
   ```

3. **Start everything:**
   ```bash
   npm start
   ```
   This will:
   - Build the agent
   - Build the agent-api
   - Start agent-api (port 3001)
   - Start UI (port 4200)

4. **Open browser:**
   ```
   http://localhost:4200
   ```

### Stop Everything
```bash
npm stop
```
(Kills all Node.js processes)

---

## 🧠 How Intelligence Works

### LLM-Based Tool Selection
**NO hard-coded keywords or rules!** The agent uses GPT to decide what to do:

```typescript
// ❌ OLD WAY (hard-coded):
if (query.includes("born") || query.includes("birthdate")) {
  fetchMembers = true;
}

// ✅ NEW WAY (LLM decides):
const decision = await gpt.analyze({
  query: "When was Agam born?",
  tools: ["answerGeneralQuery", "getFamily", "getEvents", "getDPOCH"]
});
// Returns: { tool: "answerGeneralQuery", fetchMembers: true }
```

**Benefits:**
- Works with ANY phrasing ("born", "birthday", "birth year", etc.)
- Understands context ("who can help with X?" → fetch members)
- Adapts to new family members automatically
- Handles complex queries naturally

### Schema-Agnostic Data Formatting
The agent doesn't assume field names - it dynamically reads the MCP schema:

```typescript
// Formats ANY fields returned by MCP:
const membersList = members.map(m => 
  Object.entries(m)
    .filter(([key]) => !excludeTechnical.includes(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
);
```

This means if the database schema changes, the agent keeps working!

---

## 🔧 Key Components Explained

### 1. Tool Selector (`toolSelector.ts`)
**Purpose:** Decide what data to fetch for a query

**Process:**
1. Receives user query
2. Sends to GPT with available tools description
3. GPT returns: `{ tool, fetchMembers, fetchEvents, reasoning }`
4. Agent uses these flags to fetch appropriate data

**Example Decision:**
```json
{
  "tool": "answerGeneralQuery",
  "fetchMembers": true,
  "fetchEvents": true,
  "reasoning": "Query about education requires both member info and event data"
}
```

### 2. Answer Generator (`answerGenerator.ts`)
**Purpose:** Generate natural language answers

**Capabilities:**
- Pure general knowledge (no family context)
- Family-specific questions (with context)
- Combined questions (family + world knowledge)

**System Prompt Highlights:**
```
- You can answer ANY question (general or family-specific)
- When family data is provided → use EXACT data from database
- For world knowledge → use your training data
- Combine both when needed
```

### 3. Family MCP Client (`familyMCPClient.ts`)
**Purpose:** Communicate with MCP server

**Methods:**
- `getFamily(name?)` - Get all members or specific member
- `getEvents(name, refDate?)` - Get events for a person
- `getDPOCH()` - Get oldest birthdate in database

**Features:**
- Schema discovery (fetches tool definitions on connect)
- Caches schemas for reference
- Real MCP SDK integration

---

## 🎨 UI Features

### Chat Interface (`app.component.ts/html/css`)
- ChatGPT-style conversation UI
- Message history
- Typing indicator while processing
- Error handling with retry
- Responsive design

### Message Flow:
1. User types and presses Enter/Send
2. Message added to chat (user bubble)
3. "Thinking..." indicator shown
4. API call to agent-api
5. Response added to chat (assistant bubble)

---

## ⚙️ Configuration

### Environment Variables (`.env` in `agent-api/`)
```bash
MCP_SERVER_URL=http://localhost:6402/sse   # MCP server endpoint
OPENAI_API_KEY=sk-...                       # Your OpenAI key
OPENAI_MODEL=gpt-5.4-mini                  # GPT model to use
```

### Ports
- **UI:** 4200 (Angular dev server)
- **API:** 3001 (Express.js)
- **MCP Server:** 6402 (External - must be running separately)

---

## 🧪 Testing Queries

Try these to see different capabilities:

**Basic Family Info:**
- "When was Agam born?"
- "How old is Maya?"
- "Who is Alon's father?"

**Events & Timeline:**
- "Does Maya have a degree?"
- "What events happened in 2019?"
- "What family events do we have?"

**Implicit Context (shows LLM intelligence):**
- "If I have a stutter, who should I call?" → Recommends Maya (therapist)
- "Who can help me record a song?" → Recommends Alon (musician)

**Combined Knowledge:**
- "What world events happened when Roy was born?" → Roy's birth year + historical events
- "What world and family events happened in 2019?" → Both types

**Special Queries:**
- "What is DPOCH?" → Direct MCP tool call

---

## 🐛 Troubleshooting

### "Connection refused" or MCP errors
- Ensure MCP server is running on port 6402
- Check MCP_SERVER_URL in `.env` has `/sse` suffix

### "OpenAI API error"
- Verify OPENAI_API_KEY is set correctly
- Check API quota/billing

### Build errors
- Delete `node_modules` and reinstall: `npm install`
- Rebuild agent: `cd agent && yarn build`

### UI not loading
- Check if ports 3001 and 4200 are available
- Restart with `npm stop` then `npm start`

---

## 📝 Development Notes

### Architecture Principles
1. **LLM-First:** Let GPT make decisions, avoid hard-coded logic
2. **Schema-Agnostic:** Don't assume database field names
3. **Separation of Concerns:** UI → API → Agent → MCP/OpenAI
4. **Unified Responses:** Consistent format across all tools

### Why "AnswerGenerator" not "GeneralKnowledgeTool"?
The component generates ALL natural language answers (family + general knowledge), not just "general" questions. The name was updated to reflect its true purpose.

---

## 📚 Learn More

**Key Technologies:**
- **MCP SDK:** [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- **OpenAI API:** [platform.openai.com](https://platform.openai.com)
- **Angular:** [angular.io](https://angular.io)
- **Express.js:** [expressjs.com](https://expressjs.com)

**Design Pattern:**
This is an **Agentic AI** system where:
- An LLM acts as the "brain" (tool selector)
- Tools provide capabilities (MCP data, GPT answers)
- The agent orchestrates the flow
- No hard-coded decision trees!

---

## 🤝 Contributing

This is a learning project demonstrating:
- LLM-based agent architecture
- Model Context Protocol (MCP) integration
- Separation of concerns (UI/API/Agent/Data)
- Schema-agnostic data handling

Feel free to extend with:
- More MCP tools
- Additional agent capabilities
- Enhanced UI features
- Better error handling

---

**Happy querying! 🎉**
