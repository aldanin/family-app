# Multi-Pass Agent Debugging Guide

## Issue
Multi-pass agent says "database does not provide Alon's birthdate" even though single-pass agent finds it correctly.

## Debugging Steps Added

### 1. **Log Data Reception (`getFamily` action)**
Added logging in `executeAction` when `getFamily` is called:
```typescript
console.log(`🔍 DEBUG getFamily: Received ${members.length} members`);
console.log('   → Sample member keys:', Object.keys(members[0]));
console.log('   → Sample member data:', JSON.stringify(members[0], null, 2));
```

**What to check:**
- Are members being received from MCP?
- Do members have `birthdate` field?
- What's the exact format of the data?

### 2. **Log Final Answer Context (`generateFinalAnswer` method)**
Added logging before passing to AnswerGenerator:
```typescript
console.log('🔍 DEBUG: Generating final answer with context:');
console.log('   → Members:', context.members ? `${context.members.length} found` : 'NONE');
console.log('   → Sample member:', JSON.stringify(context.members[0], null, 2));
console.log('   → Events:', (context.events.events || []).length, 'total');
```

**What to check:**
- Is `context.members` populated?
- Does it contain the birthdates?
- Is the data structure correct for AnswerGenerator?

## Expected Console Output

When you run a query like "How many years after the oldest family member was born did Roy get married?":

```
┌─ ITERATION 1/5 ───────────────────────────────────────┐
│ 💭 THOUGHT: I need to get all family members...
│ 🎯 ACTION: getFamily
│ 📋 INPUT: {}

🔍 DEBUG getFamily: Received 5 members
   → Sample member keys: ['id', 'name', 'birthdate', 'role', 'father', 'mother', ...]
   → Sample member data: {
     "id": 1,
     "name": "Alon",
     "birthdate": "1962-01-11",
     "role": "father",
     ...
   }

│ 👁️  OBSERVATION: Found 5 family member(s): Alon (born: 1962-01-11, role: father), Roy (born: 1990-01-01, role: son)...
└────────────────────────────────────────────────────────┘

┌─ ITERATION 2/5 ───────────────────────────────────────┐
│ 🎯 ACTION: getEvents
│ 📋 INPUT: {"name": "Roy"}
...
└────────────────────────────────────────────────────────┘

┌─ ITERATION 3/5 ───────────────────────────────────────┐
│ 🎯 ACTION: FINISH

🔍 DEBUG: Generating final answer with context:
   → Members: 5 found
   → Sample member: {
     "name": "Alon",
     "birthdate": "1962-01-11",
     "role": "father"
   }
   → Events: 2 total
└────────────────────────────────────────────────────────┘
```

## Possible Issues & Solutions

### Issue 1: Members array is empty
**Symptom:** `DEBUG getFamily: Received 0 members`
**Solution:** Check MCP server is running and getFamily tool works

### Issue 2: Members missing birthdate field
**Symptom:** Sample member shows `birthdate: null` or field is missing
**Solution:** Check database schema - field might be named differently (e.g., `birth_date`, `dob`)

### Issue 3: Context.members is undefined in generateFinalAnswer
**Symptom:** `Members: NONE`
**Solution:** Check working memory - data might not be stored correctly

### Issue 4: Data is stored but AnswerGenerator doesn't see it
**Symptom:** Members found but answer says "not provided"
**Solution:** Check AnswerGenerator.askGPT - might need to adjust how context is formatted

## Next Steps

1. **Run the query** with multi-pass mode
2. **Check terminal logs** for the DEBUG output
3. **Compare the logs** with expected output above
4. **Identify the exact point** where data is lost or malformed
5. **Apply targeted fix** based on the findings

## Quick Test Query

```
"How many years after the oldest family member was born did Roy get married?"
```

Expected result:
- Should find Alon (born 1962-01-11)
- Should find Roy's wedding (2020-05-22)
- Should calculate: 2020 - 1962 = 58 years

## Files to Monitor

1. **Terminal running agent-api** - Will show agent execution logs
2. **Browser console** - Will show UI streaming logs
3. **MCP server terminal** - Will show if tools are being called correctly
