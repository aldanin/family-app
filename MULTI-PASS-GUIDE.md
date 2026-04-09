# Multi-Pass ReACT Agent - Learning Guide

This document explains the difference between **Single-Pass** and **Multi-Pass ReACT** agents and how to study agent concepts.

---

## 📚 **What You'll Learn**

1. **Single-Pass Architecture** - Fast, direct agent decisions
2. **Multi-Pass ReACT Pattern** - Iterative reasoning and acting
3. **When to use each approach**
4. **How to observe agent behavior**

---

## 🎯 **Architecture Comparison**

### **Single-Pass Agent** (Current Default)

```
User Query
    ↓
┌─────────────────────┐
│  Tool Selector (LLM) │  ← Decides ONCE which tool to use
└─────────────────────┘
    ↓
┌─────────────────────┐
│  Execute Tool       │  ← Runs selected tool
└─────────────────────┘
    ↓
┌─────────────────────┐
│  Answer Generator   │  ← Generates final answer
└─────────────────────┘
    ↓
Final Answer
```

**Characteristics:**
- ⚡ **Fast** - One decision, one tool call
- 🎯 **Direct** - Best for simple queries
- 💰 **Cheap** - Fewer LLM calls
- ❌ **Limited** - Can't gather data from multiple sources

**Example:**
```
Query: "Who is Maya?"
→ Tool: getFamily(name: "Maya")
→ Answer: "Maya is..."
```

---

### **Multi-Pass ReACT Agent** (New!)

```
User Query
    ↓
    ┌─────────────────────────────────────┐
    │        ReACT LOOP (max 5x)          │
    │                                      │
    │  ┌──────────────────────────┐       │
    │  │ 1. THOUGHT (Reasoning)    │       │
    │  │   "What do I know?"       │       │
    │  │   "What do I need?"       │       │
    │  │   "What should I do?"     │       │
    │  └──────────────────────────┘       │
    │            ↓                         │
    │  ┌──────────────────────────┐       │
    │  │ 2. ACTION (Tool Selection)│       │
    │  │   Select tool or FINISH   │       │
    │  └──────────────────────────┘       │
    │            ↓                         │
    │  ┌──────────────────────────┐       │
    │  │ 3. OBSERVATION (Execute)  │       │
    │  │   Run tool, get results   │       │
    │  │   Store in working memory │       │
    │  └──────────────────────────┘       │
    │            ↓                         │
    │     Continue or Finish?              │
    │            ↓                         │
    └─────────────────────────────────────┘
    ↓
Final Answer
```

**Characteristics:**
- 🧠 **Intelligent** - Reasons at each step
- 🔄 **Iterative** - Can gather data from multiple sources
- 👁️ **Transparent** - You see the thinking process
- 💡 **Complex** - Handles multi-step problems
- 💰 **Expensive** - More LLM calls per query

**Example:**
```
Query: "When is Liad's wedding?"

Iteration 1:
  THOUGHT: "I need to find Liad's wedding. First, get Liad's data to find spouse."
  ACTION: getFamily(name: "Liad")
  OBSERVATION: "Liad is married to Maya"

Iteration 2:
  THOUGHT: "Now I know Liad's spouse is Maya. Get events for Liad."
  ACTION: getEvents(name: "Liad")
  OBSERVATION: "Found wedding event on 2024-06-15"

Iteration 3:
  THOUGHT: "I have all the info I need!"
  ACTION: FINISH
  OBSERVATION: "Liad's wedding was on June 15, 2024"
```

---

## 🔬 **How to Study Agent Behavior**

### **Step 1: Build the Project**

```bash
# From the family-app root
yarn build:agent
yarn build:api
yarn build:ui
```

### **Step 2: Start Services**

```bash
# Terminal 1: Start MCP Server (family data)
cd family-mcp-server
yarn dev

# Terminal 2: Start Agent API from family-app/
yarn start:api

# Terminal 3: Start UI from family-app/
yarn start:ui
```

### **Step 3: Test Queries**

Open `http://localhost:4200` and try these:

#### **Simple Queries** (Single-Pass is faster)
- ✅ "Who is Maya?"
- ✅ "What is DPOCH?"
- ✅ "Show me Agam's events"

#### **Complex Queries** (Multi-Pass shows iterations)
- 🔄 "When is Liad's wedding?" (needs member data + events)
- 🔄 "Does Maya have a degree?" (needs events, then reasoning)
- 🔄 "Tell me about all family graduations" (needs all events)

### **Step 4: Observe the Console**

When Multi-Pass is enabled, the **agent-api terminal** shows:

```
═══════════════════════════════════════════════════════════════
🔄 MULTI-PASS REACT AGENT
═══════════════════════════════════════════════════════════════
📝 Query: "When is Liad's wedding?"
🔢 Max Iterations: 5
═══════════════════════════════════════════════════════════════

┌─ ITERATION 1/5 ──────────────────────────────────────────┐
│ 💭 THOUGHT: I need to find Liad's wedding date. First...│
│ 🎯 ACTION: getFamily                                     │
│ 📋 INPUT: {"name":"Liad"}                                │
│ 👁️  OBSERVATION: Found 1 family member(s)...             │
└──────────────────────────────────────────────────────────┘

┌─ ITERATION 2/5 ──────────────────────────────────────────┐
│ 💭 THOUGHT: Liad is married to Maya. Now get events...  │
│ 🎯 ACTION: getEvents                                     │
│ 📋 INPUT: {"name":"Liad"}                                │
│ 👁️  OBSERVATION: Found 2 event(s) for Liad...            │
└──────────────────────────────────────────────────────────┘

┌─ ITERATION 3/5 ──────────────────────────────────────────┐
│ 💭 THOUGHT: Found the wedding! I can answer now.        │
│ 🎯 ACTION: FINISH                                        │
│ 👁️  OBSERVATION: Liad's wedding was on June 15, 2024    │
│ ✅ STATUS: COMPLETE                                      │
└──────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════
✅ COMPLETE - 3 iterations in 2847ms
═══════════════════════════════════════════════════════════
```

---

## 🎛️ **UI Controls**

The UI has two toggles:

### **💬 Allow History** (Conversation Memory)
- ✅ **ON** (default): Agent remembers previous messages
  - Example: "How old is Agam?" → "And Maya?" (remembers context)
- ❌ **OFF**: Each query is independent

### **🔄 Multi-Pass** (Agent Mode)
- ❌ **OFF** (default): Single-Pass (fast, simple)
- ✅ **ON**: Multi-Pass ReACT (iterative, complex)

---

## 📊 **Performance Comparison**

| Query Type | Single-Pass | Multi-Pass |
|------------|-------------|------------|
| "Who is Maya?" | ~500ms, 1 LLM call | ~2000ms, 3 LLM calls |
| "When is Liad's wedding?" | May fail or be incomplete | ~3000ms, 3-4 iterations |
| Token Usage | ~1000 tokens | ~3000 tokens |
| Cost | $0.0001 | $0.0003 |

---

## 🧪 **Experiment Ideas**

1. **Compare Modes:**
   - Try "When is Liad's wedding?" in both modes
   - Observe: Single-pass might miss connections, Multi-pass shows reasoning

2. **Watch Iterations:**
   - Enable Multi-Pass
   - Check agent-api terminal
   - See how agent thinks step-by-step

3. **Test Complexity:**
   - Simple: "Who is Maya?" (Single-Pass wins)
   - Complex: "Find all family members with degrees" (Multi-Pass wins)

4. **Break It:**
   - Try impossible queries: "When is Batman's birthday?"
   - See how Multi-Pass agent realizes it can't answer

---

## 💡 **Key Takeaways**

### **ReACT Pattern** (Reasoning + Acting)
- **THOUGHT**: Agent reasons about current state
- **ACTION**: Agent decides what to do
- **OBSERVATION**: Agent observes results
- **REPEAT**: Until task is complete

### **When to Use Single-Pass:**
- ✅ Simple lookups ("Who is X?")
- ✅ Direct questions with one answer
- ✅ Speed is critical
- ✅ Cost-sensitive applications

### **When to Use Multi-Pass:**
- ✅ Complex queries needing multiple data sources
- ✅ Queries requiring reasoning about relationships
- ✅ When you want to see agent thinking
- ✅ Research/learning about agent behavior

---

## 🔗 **Code References**

- **Single-Pass**: `agent/src/agent.ts` (FamilyAgent class)
- **Multi-Pass**: `agent/src/multiPassAgent.ts` (MultiPassAgent class)
- **Types**: `agent/src/types.ts` (AgentIteration, AgentState)
- **API Integration**: `agent-api/src/server.ts` (mode selection)
- **UI Toggle**: `family-agent-ui/src/app/app.component.ts`

---

## 🚀 **Next Steps**

1. **Build and test** both agent modes
2. **Compare performance** with different queries
3. **Modify the agent** - try changing max iterations (line 34 in multiPassAgent.ts)
4. **Extend it** - add new tools, change reasoning prompts
5. **Study the logs** - understand how agents think

Happy learning! 🎓

---

## 📖 **Further Reading**

- [ReACT Paper](https://arxiv.org/abs/2210.03629) - Original research
- [LangChain Agents](https://python.langchain.com/docs/modules/agents/) - Similar patterns
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling) - Tool use

