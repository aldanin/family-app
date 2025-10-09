# 🚀 How to Run the Agent and Client

## Quick Start - 3 Steps

### Step 1: Start the Backend API Server

```cmd
cd agent-api
npm install
copy .env.example .env
```

Edit `.env` and add your OpenAI API key:
```env
API_PORT=3001
MCP_SERVER_URL=http://localhost:6402
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

Build and run:
```cmd
npm run build
npm start
```

✅ You should see:
```
🤖 Family AI Agent API Server
================================
MCP Server: http://localhost:6402
OpenAI Model: gpt-4o-mini
OpenAI Configured: ✅ Yes

🚀 Server running on http://localhost:3001
Ready to accept requests! 🎉
```

**Keep this terminal open!**

---

### Step 2: Start the Angular Frontend

**Open a NEW terminal:**

```cmd
cd family-agent-ui
npm install
npm start
```

✅ You should see:
```
** Angular Live Development Server is listening on localhost:4200 **
✔ Compiled successfully.
```

**Keep this terminal open too!**

---

### Step 3: Open in Browser

Navigate to: **http://localhost:4200**

🎉 **You should see the chat interface!**

---

## Full System Overview

You need **3 services** running:

### 1. Family MCP Server (Port 6402)
Your existing MCP server must be running.

**Check if it's running:**
```cmd
curl http://localhost:6402
```

If not running, start it according to your MCP server documentation.

### 2. Backend API (Port 3001)
The Express API that connects your agent to the web.

**Start command:**
```cmd
cd agent-api
npm start
```

**Test it:**
```cmd
curl http://localhost:3001/api/health
```

### 3. Angular Frontend (Port 4200)
The ChatGPT-style web interface.

**Start command:**
```cmd
cd family-agent-ui
npm start
```

**Access it:**
Open http://localhost:4200 in your browser

---

## Visual Guide

```
┌─────────────────────────────────────────────────────┐
│  Terminal 1: Family MCP Server (port 6402)          │
│  → Your existing server                             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Terminal 2: Backend API (port 3001)                │
│  $ cd agent-api                                     │
│  $ npm start                                        │
│  🚀 Server running on http://localhost:3001         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Terminal 3: Angular UI (port 4200)                 │
│  $ cd family-agent-ui                               │
│  $ npm start                                        │
│  ✔ Compiled successfully                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Browser: http://localhost:4200                     │
│  🎨 ChatGPT-style interface                         │
└─────────────────────────────────────────────────────┘
```

---

## Alternative: Run Just the Agent (No UI)

If you want to test the agent without the web interface:

### Option A: Demo Mode
```cmd
cd agent
npm install
copy .env.example .env
# Edit .env and add OPENAI_API_KEY
npm run build
npm start
```

This runs the demo with example queries.

### Option B: Interactive Mode
```cmd
cd agent
npm run interactive
```

This lets you type queries in the terminal.

---

## First Time Setup Checklist

### Backend API Setup
```cmd
cd agent-api
npm install                        ← Install dependencies
copy .env.example .env            ← Create config file
notepad .env                      ← Edit and add API key
npm run build                     ← Build TypeScript
npm start                         ← Start server
```

### Frontend Setup
```cmd
cd family-agent-ui
npm install                        ← Install Angular
npm start                         ← Start dev server
```

---

## Testing Your Setup

### 1. Test Backend API

**Health check:**
```cmd
curl http://localhost:3001/api/health
```

**Send a query:**
```cmd
curl -X POST http://localhost:3001/api/query ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"What is DPOCH?\",\"hybridMode\":false}"
```

### 2. Test Frontend

1. Open http://localhost:4200
2. You should see the welcome screen
3. Click an example query
4. See the response appear

---

## Common Issues & Solutions

### ❌ "Cannot find module"

**Solution:**
```cmd
# For backend
cd agent-api
npm install

# For frontend
cd family-agent-ui
npm install
```

### ❌ "Port already in use"

**Solution:**
```cmd
# Find what's using the port
netstat -ano | findstr :3001

# Kill the process
taskkill /PID <PID> /F

# Or change the port in .env
```

### ❌ "API not responding"

**Solution:**
1. Make sure backend is running (check Terminal 2)
2. Test: `curl http://localhost:3001/api/health`
3. Check for errors in backend terminal

### ❌ "Blank screen in browser"

**Solution:**
1. Check browser console (F12) for errors
2. Make sure frontend is running (check Terminal 3)
3. Refresh the page
4. Clear cache and try again

### ❌ "OpenAI API error"

**Solution:**
1. Check your API key in `agent-api/.env`
2. Verify you have credits: https://platform.openai.com/usage
3. Check backend terminal for error details

---

## Daily Workflow

### Starting Up

**Morning checklist:**
```cmd
# Terminal 1
cd agent-api
npm start

# Terminal 2 (new window)
cd family-agent-ui
npm start

# Browser
# Open http://localhost:4200
```

### Shutting Down

**Press `Ctrl+C` in each terminal:**
- Terminal 1 (Backend API)
- Terminal 2 (Angular Frontend)

---

## Development Mode

### Auto-rebuild Backend
```cmd
cd agent-api
npm run dev
```
Changes to `server.ts` will require manual restart.

### Auto-reload Frontend
```cmd
cd family-agent-ui
npm start
```
Changes automatically reload in browser!

---

## Production Build

### Backend
```cmd
cd agent-api
npm run build
# Deploy dist/ folder + .env to your server
```

### Frontend
```cmd
cd family-agent-ui
ng build
# Deploy dist/family-agent-ui/ to web server
```

---

## Ports Summary

| Service | Port | URL |
|---------|------|-----|
| MCP Server | 6402 | http://localhost:6402 |
| Backend API | 3001 | http://localhost:3001 |
| Angular UI | 4200 | http://localhost:4200 |

---

## Example Session

```cmd
# Terminal 1
E:\...\family-app> cd agent-api
E:\...\agent-api> npm start
🚀 Server running on http://localhost:3001

# Terminal 2
E:\...\family-app> cd family-agent-ui
E:\...\family-agent-ui> npm start
✔ Compiled successfully.

# Browser
Opening http://localhost:4200...

# Chat Interface Opens!
[Welcome screen with example queries]

# Type: "What is DPOCH?"
# Response appears in chat!
```

---

## Quick Commands Cheat Sheet

```cmd
# Backend
cd agent-api
npm install          # First time only
npm run build        # Build TypeScript
npm start            # Start server
npm run dev          # Build + start

# Frontend
cd family-agent-ui
npm install          # First time only
npm start            # Start dev server
ng build             # Build for production

# Original Agent (without UI)
cd agent
npm start            # Run demo
npm run interactive  # Interactive mode
```

---

## 🎯 Success Checklist

After running everything:

- [ ] Backend API shows "Ready to accept requests!"
- [ ] Frontend shows "Compiled successfully"
- [ ] Browser opens to http://localhost:4200
- [ ] Welcome screen appears with example queries
- [ ] Can click an example and see response
- [ ] Can type custom message and get response
- [ ] Hybrid mode toggle works
- [ ] Messages show tool info and execution time

---

## 🆘 Need Help?

1. **Check logs** - Look at terminal output for errors
2. **Test each layer** - MCP Server → API → Frontend
3. **Verify ports** - Make sure nothing else is using 3001/4200
4. **Check .env** - Ensure API key is correct
5. **Read error messages** - They usually tell you what's wrong

---

## 📚 More Information

- **SETUP-UI.md** - Complete setup guide
- **family-agent-ui/README.md** - UI documentation
- **agent/README.md** - Agent documentation
- **agent/SUMMARY.md** - Architecture overview

---

## 🎉 You're Ready!

Your ChatGPT-style AI agent interface is now running!

**Try these queries:**
- "What is DPOCH?"
- "Show me Maya's events"
- Toggle hybrid mode 🔗 and ask: "Tell me about Maya's achievements"

Enjoy! 🚀
