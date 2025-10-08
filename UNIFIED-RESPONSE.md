# 🎯 Unified Response Structure

## Overview

All agent responses now return a **consistent, unified structure** regardless of which tool was used (OpenAI, Family MCP Server, etc.). This makes the frontend code much simpler and more maintainable.

---

## The Unified Response Format

### TypeScript Interface

```typescript
interface AgentResponse {
  query: string;              // Original user query
  selectedTool: string;       // Which tool was used
  reasoning: string;          // Why this tool was selected
  result: UnifiedResult;      // ⭐ The unified result
  executionTime: number;      // How long it took (ms)
}

interface UnifiedResult {
  // The main answer (ALWAYS present)
  answer: string;
  
  // Original data (optional, for advanced use)
  rawData?: any;
  
  // Metadata about the response
  metadata?: {
    toolName?: string;
    model?: string;           // e.g., "gpt-4o"
    usage?: {                 // OpenAI token usage
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    hasContext?: boolean;     // Was family context included?
    eventCount?: number;      // For event queries
    personName?: string;      // For person-specific queries
  };
}
```

---

## Key Benefits

### ✅ Before (Complex)

```typescript
// Frontend had to handle many different structures
if (response.result?.data?.answer) {
  content = response.result.data.answer;
} else if (response.result?.answer) {
  content = response.result.answer;
} else if (response.result?.events) {
  // Format events...
} else if (response.result?.dpoc) {
  // Format DPOC...
} else {
  // Fallback...
}
```

### ✅ After (Simple)

```typescript
// Now it's just one line!
const content = response.result.answer;
```

---

## How It Works

### 1. OpenAI Response

**Raw OpenAI data:**
```json
{
  "data": {
    "answer": "There are 5 grandchildren in the Danin family.",
    "model": "gpt-4o",
    "usage": { "total_tokens": 120 }
  }
}
```

**Normalized to:**
```json
{
  "answer": "There are 5 grandchildren in the Danin family.",
  "rawData": { ... },
  "metadata": {
    "toolName": "GeneralKnowledge-OpenAI",
    "model": "gpt-4o",
    "usage": { "total_tokens": 120 }
  }
}
```

---

### 2. Family Events Response

**Raw MCP data:**
```json
{
  "name": "Maya",
  "count": 2,
  "events": [
    { "event_type": "University Graduation", "event_date": "2023-06-11" },
    { "event_type": "Wedding", "event_date": "2024-06-06" }
  ]
}
```

**Normalized to:**
```json
{
  "answer": "Found 2 event(s) for Maya:\n\n1. University Graduation - 6/11/2023\n2. Wedding - 6/6/2024",
  "rawData": { ... },
  "metadata": {
    "toolName": "FamilyMCP-getEvents",
    "eventCount": 2,
    "personName": "Maya"
  }
}
```

---

### 3. DPOC Response

**Raw MCP data:**
```json
{
  "dpoc": "-255139200",
  "description": "Date of oldest person in clan (EPOCH format)"
}
```

**Normalized to:**
```json
{
  "answer": "DPOC (Date of Oldest Person in Clan): 11/30/1961\nDate of oldest person in clan (EPOCH format)",
  "rawData": { ... },
  "metadata": {
    "toolName": "FamilyMCP-getDPOC"
  }
}
```

---

## Usage Examples

### Frontend (Angular)

```typescript
async sendMessage(message: string) {
  const response = await this.agentService.query(message, this.hybridMode);
  
  // Simple! Just get the answer
  const content = response.result.answer;
  
  // Optional: access metadata
  if (response.result.metadata?.model) {
    console.log(`Used model: ${response.result.metadata.model}`);
  }
  
  this.messages.push({
    role: 'assistant',
    content,
    toolUsed: response.selectedTool,
    executionTime: response.executionTime
  });
}
```

### Backend (API Server)

```typescript
app.post('/api/query', async (req, res) => {
  const { query, hybridMode } = req.body;
  
  // Agent returns unified response automatically
  const response = await agent.processQuery(query, hybridMode);
  
  // Just send it - frontend knows what to do!
  res.json(response);
});
```

### CLI (Interactive Mode)

```typescript
const response = await agent.processQuery(query, hybridMode);

// Simple display
console.log(response.result.answer);
```

---

## Advanced Usage

### Accessing Raw Data

If you need the original data structure for advanced processing:

```typescript
const response = await agent.processQuery("Show Maya's events");

// Get the formatted answer
console.log(response.result.answer);

// Access raw events data
if (response.result.rawData?.events) {
  response.result.rawData.events.forEach(event => {
    // Do custom processing
  });
}
```

### Checking Metadata

```typescript
const response = await agent.processQuery("How many grandchildren?");

// Check if OpenAI was used
if (response.result.metadata?.model) {
  console.log(`AI Model: ${response.result.metadata.model}`);
  console.log(`Tokens used: ${response.result.metadata.usage?.total_tokens}`);
}

// Check if family context was included (hybrid mode)
if (response.result.metadata?.hasContext) {
  console.log('Response included family data context');
}
```

---

## Tool-Specific Normalization

The agent's `normalizeResult()` method handles different tool outputs:

| Tool Output | How It's Normalized |
|-------------|-------------------|
| `{answer: "..."}` | Direct answer from OpenAI or fallback |
| `{dpoc: "...", description: "..."}` | Formatted date + description |
| `{events: [...], count: N, name: "..."}` | Formatted event list |
| `{calculation: "2 + 2 = 4"}` | Math result |
| Any other data | JSON.stringify() as fallback |

---

## Error Handling

Errors are also unified:

```typescript
// If something goes wrong
{
  "query": "Your query",
  "selectedTool": "error",
  "reasoning": "Execution failed",
  "result": {
    "answer": "❌ Error: Connection timeout",
    "rawData": { "error": "Connection timeout" },
    "metadata": { "toolName": "error" }
  },
  "executionTime": 1234
}
```

Frontend can still just display `result.answer` - error messages look consistent!

---

## Migration Guide

### If You Had Custom Response Handling

**Old Code:**
```typescript
if (response.result.data?.answer) {
  display(response.result.data.answer);
} else if (response.result.answer) {
  display(response.result.answer);
}
// ... many more conditions
```

**New Code:**
```typescript
display(response.result.answer);
```

That's it! 🎉

---

## Benefits Summary

✅ **Simpler Frontend Code** - No complex conditional logic  
✅ **Type Safety** - TypeScript interfaces ensure consistency  
✅ **Easier Testing** - Predictable response structure  
✅ **Better Maintainability** - Add new tools without changing frontend  
✅ **Consistent UX** - All responses display the same way  
✅ **Metadata Available** - Advanced users can access details  
✅ **Error Handling** - Errors follow the same structure  

---

## Complete Example

```typescript
// Query the agent
const response = await agent.processQuery(
  "How many grandchildren are in the Danin family?",
  true // hybrid mode
);

// Response structure (guaranteed):
{
  query: "How many grandchildren are in the Danin family?",
  selectedTool: "answerGeneralQuery",
  reasoning: "General question pattern detected",
  result: {
    answer: "There are 5 grandchildren in the Danin family.",
    rawData: {
      answer: "There are 5 grandchildren in the Danin family.",
      model: "gpt-4o",
      usage: { prompt_tokens: 85, completion_tokens: 12, total_tokens: 97 },
      hasContext: true
    },
    metadata: {
      toolName: "GeneralKnowledge-OpenAI",
      model: "gpt-4o",
      usage: { prompt_tokens: 85, completion_tokens: 12, total_tokens: 97 },
      hasContext: true
    }
  },
  executionTime: 1247
}

// Use it (same for ALL responses):
console.log(response.result.answer);
// Output: "There are 5 grandchildren in the Danin family."
```

---

## Summary

**One Structure. All Tools. Always Consistent.** 🎯

No matter which tool processes your query, you always get:
- `response.result.answer` - The formatted answer (always present)
- `response.result.rawData` - Original data (optional)
- `response.result.metadata` - Details about the response (optional)

This makes building clients incredibly simple!
