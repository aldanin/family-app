# Complete Setup Instructions

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- OpenAI API account (get free credits at https://platform.openai.com)
- Your family-mcp-server running on port 6402

## Step-by-Step Setup

### 1. Navigate to Agent Directory

```bash
cd "e:\D F G\_ProfessionalProgramming\SideProjects\MCP\MCP1\family-app\agent"
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web server framework
- `node-fetch` - HTTP client
- `openai` - OpenAI SDK
- `dotenv` - Environment variables
- TypeScript and type definitions

### 3. Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create account (you get $5 free credits!)
3. Click "Create new secret key"
4. Name it "family-agent" or similar
5. **Copy the key immediately** (you won't see it again!)

### 4. Configure Environment

```bash
copy .env.example .env
```

Open `.env` in your editor and paste your API key:

```env
# Family Agent Configuration
MCP_SERVER_URL=http://localhost:6402
AGENT_PORT=3000

# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
```

**Important:** Keep your API key secret! Don't commit it to git.

### 5. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 6. Run the Demo

```bash
npm start
```

You should see:
```
╔════════════════════════════════════════════════════════════════════════════╗
║                      FAMILY AI AGENT DEMONSTRATION                         ║
║                                                                            ║
║  This agent demonstrates intelligent tool selection:                      ║
║  • Family queries → family-mcp-server tools                               ║
║  • General queries → OpenAI GPT API                                       ║
║  • Hybrid queries → GPT + Family data combined!                           ║
...
```

The demo will run several example queries showing all three modes!

### 7. Try Interactive Mode

```bash
npm run interactive
```

Now you can chat with the agent:

```
You: What is DPOC?
🤖 Agent: [Shows DPOC information from family database]

You: Explain what AI agents are
🤖 Agent: [GPT response explaining AI agents]

You: Tell me about Maya's achievements
🤖 Agent: [Hybrid response combining Maya's data with GPT analysis]
```

Type `exit` to quit or `hybrid` to toggle hybrid mode.

## Troubleshooting

### Error: "Cannot find module 'openai'"

**Solution:** Run `npm install` again

### Error: "OpenAI API key not configured"

**Solution:** 
1. Make sure you created the `.env` file (copy from `.env.example`)
2. Add your actual API key to `.env`
3. Restart the application

### Error: "MCP server not responding"

**Solution:**
1. Make sure your family-mcp-server is running
2. Check it's on the correct port (default: 6402)
3. Update `MCP_SERVER_URL` in `.env` if using a different port

### Warning: "Using fallback responses"

This means OpenAI isn't configured. The agent will still work but use simple pattern matching instead of GPT.

**Solution:** Add your OpenAI API key to `.env`

### TypeScript Compilation Errors

**Solution:** 
```bash
npm install --save-dev @types/node
npm run build
```

## Verification

To verify everything is working:

1. **Check build output:**
   ```bash
   dir dist
   ```
   You should see `.js` files

2. **Test OpenAI connection:**
   Run the demo - if you see `✅ OpenAI initialized`, it's working

3. **Test MCP connection:**
   The demo will try to fetch family data. Check for errors.

4. **Check API usage:**
   Go to https://platform.openai.com/usage to see your token usage

## Development Workflow

### Make Changes

1. Edit TypeScript files in `src/`
2. Run `npm run build` to compile
3. Run `npm start` to test

### Watch Mode (Auto-rebuild)

```bash
npm run watch
```

Opens a watcher that auto-recompiles when you save files.

### VS Code Setup

Recommended extensions:
- **TypeScript and JavaScript Language Features** (built-in)
- **ESLint** for code quality
- **Prettier** for formatting

## Project Scripts

- `npm run build` - Compile TypeScript
- `npm start` - Run the demo
- `npm run dev` - Build + run in one command
- `npm run watch` - Auto-rebuild on changes
- `npm run interactive` - Chat with the agent

## File Structure After Build

```
agent/
├── src/                    # Your TypeScript source
│   ├── agent.ts
│   ├── toolSelector.ts
│   └── ...
├── dist/                   # Compiled JavaScript (created after build)
│   ├── agent.js
│   ├── toolSelector.js
│   └── ...
├── node_modules/           # Dependencies (created after npm install)
├── .env                    # Your configuration (you create this)
├── .env.example            # Template
├── package.json
├── tsconfig.json
├── README.md
├── QUICKSTART.md
└── SUMMARY.md
```

## Next Steps

1. ✅ Run the demo to see all features
2. ✅ Try interactive mode to experiment
3. ✅ Read SUMMARY.md to understand what you built
4. ✅ Study the code to learn the patterns
5. ✅ Modify and extend to make it your own!

## Getting Help

1. Check the logs - they show exactly what's happening
2. Read the error messages carefully
3. Verify your `.env` configuration
4. Make sure all services are running
5. Check the documentation files (README, QUICKSTART, SUMMARY)

## Clean Start

If something goes wrong, start fresh:

```bash
# Remove generated files
rd /s /q node_modules
rd /s /q dist

# Remove config (keep .env.example!)
del .env

# Reinstall
npm install
copy .env.example .env
# Edit .env with your API key
npm run build
npm start
```

Happy coding! 🚀
