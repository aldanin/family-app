# Complete Setup Guide - ChatGPT-Style Angular Client

## Prerequisites

- Node.js 18+ and npm
- Your family-mcp-server running on port 6402
- OpenAI API key

## Step-by-Step Setup

### Part 1: Backend API Server

#### 1. Navigate to API directory
```cmd
cd "e:\D F G\_ProfessionalProgramming\SideProjects\MCP\MCP1\family-app\agent-api"
```

#### 2. Install dependencies
```cmd
npm install
```

#### 3. Configure environment
```cmd
copy .env.example .env
```

Edit `.env`:
```env
API_PORT=3001
MCP_SERVER_URL=http://localhost:6402
OPENAI_API_KEY=sk-your-actual-key-here
OPENAI_MODEL=gpt-4o-mini
```

#### 4. Build the API server
```cmd
npm run build
```

#### 5. Start the API server
```cmd
npm start
```

You should see:
```
🤖 Family AI Agent API Server
================================
MCP Server: http://localhost:6402
OpenAI Model: gpt-4o-mini
OpenAI Configured: ✅ Yes

🚀 Server running on http://localhost:3001
📡 API endpoints:
   GET  /api/health - Health check
   GET  /api/capabilities - Agent capabilities
   POST /api/query - Process a query
   GET  /api/examples - Example queries

Ready to accept requests! 🎉
```

**Leave this terminal running!**

### Part 2: Angular Frontend

#### 1. Open a NEW terminal and navigate to UI directory
```cmd
cd "e:\D F G\_ProfessionalProgramming\SideProjects\MCP\MCP1\family-app\family-agent-ui"
```

#### 2. Install Angular dependencies
```cmd
npm install
```

This will install Angular 17 and all required dependencies.

#### 3. Start the development server
```cmd
npm start
```

You should see:
```
** Angular Live Development Server is listening on localhost:4200 **
✔ Compiled successfully.
```

#### 4. Open your browser
Navigate to: **http://localhost:4200**

You should see the chat interface!

## 🎯 Testing the Setup

### 1. Test the Backend API First

Open a new terminal:
```cmd
curl http://localhost:3001/api/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-08T...",
  "openai": true,
  "mcpServer": "http://localhost:6402"
}
```

### 2. Test the Frontend

In your browser at http://localhost:4200:

1. **Welcome screen appears** ✅
2. **Click an example query**
3. **See the response** ✅
4. **Toggle hybrid mode** ✅
5. **Type your own message** ✅

## 🎨 What You Should See

### Welcome Screen
```
╔══════════════════════════════════════╗
║     🤖 Family AI Agent               ║
║     Powered by OpenAI + MCP Server   ║
╚══════════════════════════════════════╝

       👋 Welcome!

Ask me anything about your family
or general questions.

Try these examples:
┌────────────────────────────────────┐
│ What is DPOC?                      │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ Show me Maya's events              │
└────────────────────────────────────┘
...
```

### Chat Interface
```
┌────────────────────────────────────┐
│ 👤 You          10:30 AM           │
│ What is DPOC?                      │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 🤖 Agent        10:30 AM           │
│ DPOC: January 1, 1962              │
│ EPOCH timestamp of the oldest      │
│ birthdate in the members table     │
│                                    │
│ Tool: getDPOC | 45ms              │
└────────────────────────────────────┘
```

## 📝 Quick Commands Reference

### Backend API
```cmd
cd agent-api
npm install          # Install dependencies
npm run build        # Build TypeScript
npm start            # Start server (port 3001)
npm run dev          # Build and start
```

### Frontend
```cmd
cd family-agent-ui
npm install          # Install Angular and deps
npm start            # Start dev server (port 4200)
npm run build        # Build for production
```

## 🐛 Troubleshooting

### Error: "Cannot find module '@angular/core'"

**Solution:**
```cmd
cd family-agent-ui
npm install
```

### Error: "Port 3001 already in use"

**Solution:**
```cmd
# Find and kill the process using port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Or change the port in agent-api/.env
API_PORT=3002
```

### Error: "API not responding"

**Solution:**
1. Make sure backend is running (terminal 1)
2. Check http://localhost:3001/api/health in browser
3. Verify .env configuration

### Error: "CORS policy"

**Solution:**
The API has CORS enabled. If you still see errors:
1. Make sure API is on port 3001
2. Check browser console for exact error
3. Restart both backend and frontend

### Blank Screen in Browser

**Solution:**
1. Check browser console (F12) for errors
2. Make sure `npm install` completed successfully
3. Try `npm start` again
4. Clear browser cache and refresh

## 🎯 Full System Check

All three components must be running:

1. ✅ **MCP Server** (port 6402)
   ```cmd
   # Check if running
   curl http://localhost:6402
   ```

2. ✅ **Backend API** (port 3001)
   ```cmd
   cd agent-api
   npm start
   ```

3. ✅ **Frontend UI** (port 4200)
   ```cmd
   cd family-agent-ui
   npm start
   ```

## 📊 Project Layout

```
family-app/
├── agent/              # Original TypeScript agent
├── agent-api/          # Backend API server ⭐
│   ├── src/
│   │   └── server.ts   # Express server
│   ├── .env            # Configuration (you create this)
│   └── package.json
└── family-agent-ui/    # Angular frontend ⭐
    ├── src/
    │   ├── app/
    │   │   ├── app.component.ts     # Main UI
    │   │   └── services/
    │   │       └── agent.service.ts # API client
    │   ├── main.ts
    │   └── index.html
    └── package.json
```

## 🎉 Success Checklist

- [ ] Backend API running on http://localhost:3001
- [ ] Frontend UI running on http://localhost:4200
- [ ] Can see welcome screen in browser
- [ ] Can click example queries and see responses
- [ ] Can type custom messages and get responses
- [ ] Hybrid mode toggle works
- [ ] Messages show tool used and execution time

## 💡 Next Steps

Once everything is working:

1. **Try different queries** - Test family, general, and hybrid modes
2. **Customize the UI** - Change colors, add features
3. **Add your family members** - Update the MCP server data
4. **Deploy** - Build for production and deploy to a server

## 📚 Documentation

- **README.md** - Full UI documentation
- **../agent/README.md** - Agent documentation
- **../agent/SUMMARY.md** - What you built
- **../agent/ARCHITECTURE.md** - Architecture diagrams

## 🚀 Production Deployment

### Build for Production

**Backend:**
```cmd
cd agent-api
npm run build
# Deploy dist/ folder + .env to your server
```

**Frontend:**
```cmd
cd family-agent-ui
ng build
# Deploy dist/family-agent-ui/ to your web server
```

You now have a complete ChatGPT-style interface for your AI agent! 🎉
