# Multi-Pass Agent Fix: Improving Data Visibility

## Problem

The multi-pass agent was performing **worse** than single-pass for complex queries like:
> "How many years after the oldest family member was born did Roy get married, and who attended his wedding?"

**Multi-pass result:** ❌ "Cannot determine... Alon's birthdate not provided"  
**Single-pass result:** ✅ "Alon born Jan 11, 1962, Roy married May 22, 2020 = 58 years"

## Root Causes

### 1. **Incomplete Data Fetching** ⚠️ **PRIMARY ISSUE**
The agent was calling `getFamily(name)` with a specific name, which returns limited relationship data:
```json
{
  "name": "Roy",
  "father": "Alon",    // ❌ Just a name string, no birthdate!
  "mother": "Tova"     // ❌ Just a name string, no birthdate!
}
```

**The fix:** Call `getFamily()` WITHOUT a name parameter to get ALL members with COMPLETE data:
```json
[
  {"name": "Alon", "birthdate": "1962-01-11", "role": "father"},
  {"name": "Roy", "birthdate": "1990-01-01", "role": "son", "father": "Alon"},
  ...
]
```

### 2. **Vague Observations** 
The agent was returning generic summaries instead of actual data:
```typescript
// ❌ Before
return `Found ${members.length} family member(s). Data stored in working memory.`;
```

This meant the LLM couldn't reason about the actual data in subsequent iterations.

### 3. **Truncated Context**
Previous iterations were being truncated to only 100 characters:
```typescript
// ❌ Before
${state.iterations.map(i => `${i.action}: ${i.observation.substring(0, 100)}`)}
```

This cut off important details like birthdates and names.

## Solutions Applied

### 1. **Smart Data Fetching Instructions** 🎯 **CRITICAL FIX**
Updated prompts to instruct the agent to ALWAYS call `getFamily()` without parameters:

**THOUGHT Phase:**
```typescript
- When you call getFamily() without a name, you get ALL family members with their FULL data
- Each member includes: name, birthdate, role, father (name), mother (name), spouse (name)
- The "father", "mother", "spouse" fields are just STRING NAMES - to get their birthdates, 
  you need the full member list
```

**ACTION Phase:**
```typescript
CRITICAL DATA GATHERING RULES:
- For questions about ANY family member's birthdate or relationships → 
  Call getFamily() WITHOUT name parameter to get ALL members
- NEVER call getFamily with a name parameter unless explicitly searching for ONE specific person
- When you call getFamily(), you get COMPLETE data for ALL members (birthdates, relationships, roles)
```

### 2. **Detailed Observations**
Now return actual data summaries in observations:
```typescript
// ✅ After
const memberSummaries = members.map((m: any) => 
  `${m.name} (born: ${m.birthdate || 'unknown'}, role: ${m.role || 'unknown'})`
).join(', ');

return `Found ${members.length} family member(s): ${memberSummaries}. Full data stored in working memory.`;
```

**Example output:**
```
Found 3 family member(s): Alon (born: 1962-01-11, role: father), 
Roy (born: 1990-01-01, role: son), Maya (born: 1995-05-15, role: daughter). 
Full data stored in working memory.
```

### 3. **Increased Context Window**
Tripled the observation context from 100 to 300 characters:
```typescript
// ✅ After
${state.iterations.map(i => `${i.action}: ${i.observation.substring(0, 300)}`)}
```

This ensures critical details like dates, names, and relationships are preserved.

### 4. **Event Summaries**
Added event summaries to observations:
```typescript
// ✅ After
const eventSummaries = events.slice(0, 3).map((e: any) =>
  `${e.eventType} on ${e.eventDate || 'unknown date'}`
).join(', ');

return `Found ${events.length} event(s): ${eventSummaries}${moreText}. Full data stored.`;
```

### 5. **Debug Logging**
Added comprehensive logging to track data flow:
```typescript
console.log(`🔍 DEBUG getFamily: Received ${members.length} members`);
console.log('   → Sample member data:', JSON.stringify(members[0], null, 2));
console.log('🔍 DEBUG: Generating final answer with context:');
console.log('   → Members:', context.members ? `${context.members.length} found` : 'NONE');
```

## Impact

**Before:**
```
Iteration 1: getFamily("Roy") → "Found 1 member. Data stored."
                                 // Only gets Roy's data, father="Alon" is just a string
Iteration 2: getDPOCH → "DPOCH: -255139200. Data stored."
Iteration 3: FINISH → "Cannot determine Alon's birthdate..."
```

**After:**
```
Iteration 1: getFamily() → "Found 5 members: Alon (born: 1962-01-11, role: father), 
                            Roy (born: 1990-01-01, role: son)... Full data stored."
                            // Gets ALL members with complete birthdates!
Iteration 2: getEvents("Roy") → "Found 2 events: Wedding on 2020-05-22, Graduation on 2012-06-15"
Iteration 3: FINISH → "Alon was born Jan 11, 1962. Roy married May 22, 2020. That's 58 years."
```

## Key Learnings

1. **Relationship Strings vs. Full Data:** Database relationship fields (father, mother, spouse) are just names - you need the full dataset to get detailed info
2. **LLM Prompting is Critical:** The agent needs EXPLICIT instructions about how to fetch comprehensive data
3. **LLM Reasoning Needs Details:** The agent can only reason about what it "sees" in the observations
4. **Context Window Matters:** Truncating too aggressively loses critical information
5. **Transparency Helps:** Detailed observations make debugging easier and improve agent performance
6. **Multi-Pass ≠ Automatically Better:** Without proper instructions and context management, iterative agents can perform worse than single-pass

## Testing

Test with this query to verify the fix:
```
"How many years after the oldest family member was born did Roy get married?"
```

Expected iterations:
1. `getFamily()` → Returns ALL members with birthdates (including Alon with 1962-01-11)
2. `getEvents("Roy")` → Returns wedding event with date (2020-05-22)
3. `FINISH` → Calculates years: 2020 - 1962 = 58 years

## Files Changed

- `agent/src/agents/multiPassAgent.ts`:
  - Line 184-216: Enhanced THOUGHT prompt with data structure explanation
  - Line 245-268: Enhanced ACTION prompt with critical data gathering rules
  - Line 307-325: Enhanced `getFamily` observation with debug logging
  - Line 327-347: Enhanced `getEvents` observation with event summaries
  - Line 208-211: Increased context window from 100 to 300 chars
  - Line 388-397: Added debug logging in `generateFinalAnswer`
