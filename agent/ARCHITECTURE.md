# Agent Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER QUERY                                 │
│                    "Tell me about Maya's achievements"                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FAMILY AGENT (agent.ts)                         │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │             TOOL SELECTOR (toolSelector.ts)                     │   │
│  │                   "The Brain" 🧠                                │   │
│  │                                                                 │   │
│  │  1. Analyzes query                                             │   │
│  │  2. Detects keywords ("Maya", "achievements")                  │   │
│  │  3. Scores confidence for each tool                            │   │
│  │  4. Selects best tool                                          │   │
│  │  5. Logs reasoning                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                         Decision Made ✓                                │
│                                                                         │
│            ┌──────────────┬─────────────┬──────────────┐               │
│            │              │             │              │               │
│            ▼              ▼             ▼              │               │
│   ┌────────────┐  ┌────────────┐  ┌──────────┐       │               │
│   │   Family   │  │  OpenAI    │  │  Hybrid  │       │               │
│   │    Query   │  │   Query    │  │  Query   │       │               │
│   └────────────┘  └────────────┘  └──────────┘       │               │
└─────────────────────────────────────────────────────────────────────────┘
         │                   │               │
         ▼                   ▼               ▼
┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐
│  Family MCP     │  │  General         │  │  HYBRID MODE!              │
│  Client         │  │  Knowledge       │  │                            │
│                 │  │  Tool            │  │  1. Fetch from MCP         │
│  getDPOCH()      │  │                  │  │  2. Pass to OpenAI         │
│  getEvents()    │  │  askGPT()        │  │  3. Combine results        │
│                 │  │                  │  │                            │
│  📊 Mock data   │  │  🤖 OpenAI API   │  │  📊 + 🤖 = 🌟             │
└────────┬────────┘  └────────┬─────────┘  └──────────┬─────────────────┘
         │                    │                       │
         │                    │                       │
         ▼                    ▼                       ▼
┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐
│  MCP Server     │  │  OpenAI API      │  │  MCP Server + OpenAI       │
│                 │  │                  │  │                            │
│  localhost:6402 │  │  api.openai.com  │  │  Both sources!             │
│                 │  │                  │  │                            │
│  Returns:       │  │  Returns:        │  │  Returns:                  │
│  {             │  │  {              │  │  {                        │
│    events: [...] │  │    answer: "..." │  │    answer: "Maya has      │
│    count: 2     │  │    model: "..."  │  │      achieved university  │
│  }             │  │    tokens: 287   │  │      graduation in 2023   │
│                 │  │  }              │  │      and got married in   │
│                 │  │                  │  │      2024. These          │
│                 │  │                  │  │      milestones..."       │
│                 │  │                  │  │    hasContext: true       │
│                 │  │                  │  │  }                        │
└─────────────────┘  └──────────────────┘  └────────────────────────────┘


TOOL SELECTION FLOW
═══════════════════

Query: "What is DPOCH?"
  └─> Keywords: ["dpoch"]
      └─> Tool: getDPOCH
          └─> Source: Family MCP Server
              └─> Result: Date Point of Commencement

Query: "Explain AI"
  └─> Keywords: ["explain"]
      └─> Pattern: General knowledge
          └─> Tool: answerGeneralQuery
              └─> Source: OpenAI GPT
                  └─> Result: AI explanation

Query: "Tell me about Maya's achievements"
  └─> Keywords: ["Maya", "achievements"]
      └─> Detected: Family member name
          └─> Mode: Hybrid (combineWithContext = true)
              └─> Step 1: getEvents("Maya") → Family data
                  └─> Step 2: askGPT(query, familyData) → Analysis
                      └─> Result: Intelligent response with context!


HYBRID MODE DETAILED FLOW
═════════════════════════

1. User asks: "Tell me about Maya's achievements"
   
2. Tool Selector detects:
   ✓ Family keyword: "Maya"
   ✓ Analysis needed: "achievements", "tell me about"
   → Decision: Use OpenAI with family context
   
3. Agent executes hybrid mode:
   
   Step A: Fetch Context
   ┌─────────────────────────────────────┐
   │ familyClient.getEvents("Maya")      │
   │                                     │
   │ Returns:                            │
   │ {                                   │
   │   events: [                         │
   │     {                               │
   │       type: "University Graduation",│
   │       date: "2023-06-11"           │
   │     },                              │
   │     {                               │
   │       type: "Wedding",             │
   │       date: "2024-06-06"           │
   │     }                               │
   │   ]                                 │
   │ }                                   │
   └─────────────────────────────────────┘
   
   Step B: Build GPT Prompt
   ┌─────────────────────────────────────┐
   │ System: "You are a helpful AI"      │
   │                                     │
   │ Context: "Family data:              │
   │   Maya's events:                    │
   │   - University Graduation (2023)    │
   │   - Wedding (2024)"                 │
   │                                     │
   │ User: "Tell me about Maya's         │
   │        achievements"                │
   └─────────────────────────────────────┘
   
   Step C: Call OpenAI
   ┌─────────────────────────────────────┐
   │ POST https://api.openai.com/...     │
   │                                     │
   │ Model: gpt-4o-mini                  │
   │ Temperature: 0.7                    │
   │ Max tokens: 500                     │
   └─────────────────────────────────────┘
   
   Step D: GPT Analyzes
   ┌─────────────────────────────────────┐
   │ GPT sees the family data and        │
   │ generates intelligent response:     │
   │                                     │
   │ "Maya has accomplished two          │
   │  significant milestones. Her        │
   │  university graduation in 2023      │
   │  represents academic achievement... │
   │  Her wedding in 2024 marks a        │
   │  beautiful personal milestone..."   │
   └─────────────────────────────────────┘

4. Agent returns combined result to user!


DATA FLOW COMPARISON
═══════════════════

FAMILY QUERY (MCP Only):
User → Agent → ToolSelector → FamilyMCPClient → MCP Server → Response

GENERAL QUERY (OpenAI Only):
User → Agent → ToolSelector → GeneralKnowledgeTool → OpenAI API → Response

HYBRID QUERY (Best of Both!):
User → Agent → ToolSelector → [
    FamilyMCPClient → MCP Server → Family Data
    ↓
    GeneralKnowledgeTool(with context) → OpenAI API → Intelligent Analysis
] → Combined Response


KEY COMPONENTS
═════════════

📝 types.ts
   Defines data structures (TypeScript interfaces)

🧠 toolSelector.ts
   The "brain" - decides which tool to use
   - Pattern matching
   - Keyword detection
   - Confidence scoring

📊 familyMCPClient.ts
   Connects to family-mcp-server
   - getDPOCH()
   - getEvents(name)

🤖 generalKnowledgeTool.ts
   OpenAI integration
   - askGPT(query, context)
   - Hybrid mode support

🎯 agent.ts
   Main orchestrator
   - processQuery()
   - Combines all tools
   - Handles hybrid mode

🎬 index.ts
   Demo runner
   - Shows examples
   - Demonstrates all modes

💬 interactive.ts
   Interactive chat mode
   - Real-time queries
   - Toggle hybrid mode


COST BREAKDOWN (GPT-4o-mini)
═══════════════════════════

Input tokens:  $0.150 / 1M tokens
Output tokens: $0.600 / 1M tokens

Typical queries:
- Family query:     $0.00    (no OpenAI call)
- General query:    $0.0003  (100 tokens in + 200 out)
- Hybrid query:     $0.0005  (200 tokens in + 300 out)

1000 hybrid queries ≈ $0.50

Very affordable! 💰


EXAMPLE SESSION
═══════════════

$ npm run interactive

You: What is DPOCH?
🤖 Agent: DPOCH (Date Point of Commencement) is -255139200 
         (Jan 1, 1962) - the oldest family member birthdate.
         [Tool: getDPOCH | Time: 15ms]

You: hybrid
🔀 Hybrid mode: ON

[HYBRID] You: Tell me about Maya
🤖 Agent: Maya is a remarkable person who has achieved 
         significant milestones in recent years. She 
         graduated from university in June 2023, 
         demonstrating her dedication to education and 
         personal growth. Just a year later, in June 2024, 
         she celebrated her wedding, marking a beautiful 
         new chapter in her life...
         [Tool: answerGeneralQuery | Time: 1247ms]

You: exit
Goodbye! 👋
```
