# Family AI Agent - ChatGPT-Style Angular Client

A beautiful, ChatGPT-style web interface for your Family AI Agent, built with Angular.

## 🎨 Features

- **ChatGPT-Like Interface** - Modern, clean design
- **Real-Time Chat** - Smooth messaging experience
- **Hybrid Mode Toggle** - Switch between normal and hybrid queries
- **Example Queries** - Quick-start suggestions
- **Message History** - See all your conversations
- **Loading States** - Visual feedback while processing
- **Error Handling** - Graceful error messages
- **Responsive Design** - Works on all screen sizes

## 📁 Project Structure

```
family-agent-ui/          # Angular Frontend
├── src/
│   ├── app/
│   │   ├── app.component.ts      # Main chat component
│   │   └── services/
│   │       └── agent.service.ts  # API service
│   ├── main.ts
│   ├── index.html
│   └── styles.css
├── angular.json
├── package.json
└── tsconfig.json

agent-api/               # Express Backend API
├── src/
│   └── server.ts       # API server
├── package.json
└── tsconfig.json
```

## 🚀 Quick Start

### 1. Install Backend API

```bash
cd agent-api
npm install
copy .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 2. Build & Start Backend API

```bash
npm run build
npm start
```

The API will run on http://localhost:3001

### 3. Install Frontend

```bash
cd ../family-agent-ui
npm install
```

### 4. Start Frontend

```bash
npm start
```

The UI will open at http://localhost:4200

## 🎯 How to Use

1. **Open your browser** to http://localhost:4200
2. **Type a message** in the input box
3. **Click Send** or press Enter
4. **Toggle Hybrid Mode** to combine family data with GPT analysis
5. **Try example queries** from the welcome screen

### Example Queries

**Family Queries:**
- "What is DPOCH?"
- "Show me Maya's events"
- "When did Maya graduate?"

**General Queries:**
- "Explain what AI is"
- "What are the benefits of TypeScript?"

**Hybrid Queries (🔗 toggle ON):**
- "Tell me about Maya's achievements"
- "Analyze Maya's timeline and give me insights"

## 🏗️ Architecture

```
┌─────────────────┐
│   Angular UI    │  (Port 4200)
│  (Browser)      │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  Express API    │  (Port 3001)
│  Server         │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│  MCP   │ │ OpenAI   │
│ Server │ │   API    │
└────────┘ └──────────┘
```

## 📡 API Endpoints

### GET /api/health
Health check endpoint
```json
{
  "status": "healthy",
  "timestamp": "2025-10-08T...",
  "openai": true,
  "mcpServer": "http://localhost:6402"
}
```

### POST /api/query
Send a query to the agent
```json
{
  "query": "What is DPOCH?",
  "hybridMode": false
}
```

Response:
```json
{
  "query": "What is DPOCH?",
  "selectedTool": "getDPOCH",
  "reasoning": "Query asks about DPOCH",
  "result": { ... },
  "executionTime": 45
}
```

### GET /api/examples
Get example queries
```json
{
  "family": ["What is DPOCH?", ...],
  "general": ["Explain what AI is", ...],
  "hybrid": ["Tell me about Maya's achievements", ...]
}
```

### GET /api/capabilities
Get agent capabilities
```json
{
  "familyTools": [...],
  "generalTools": [...],
  "selectionStrategy": "..."
}
```

## 🎨 UI Features

### Chat Interface
- **User Messages** - Purple gradient background (right-aligned)
- **Agent Messages** - Gray background (left-aligned)
- **Typing Indicator** - Animated dots while processing
- **Timestamps** - Show when each message was sent
- **Tool Info** - See which tool was used and execution time

### Header
- **Title** - "🤖 Family AI Agent"
- **Subtitle** - Shows it's powered by OpenAI + MCP
- **Hybrid Toggle** - Switch hybrid mode on/off
- **Clear Button** - Reset the conversation

### Input Area
- **Text Input** - Large, easy-to-use input field
- **Send Button** - Disabled while loading
- **Hybrid Hint** - Shows when hybrid mode is active

### Welcome Screen
- **Greeting** - Friendly welcome message
- **Examples** - Clickable example queries to get started

## 🔧 Configuration

### Backend (.env)
```env
API_PORT=3001
MCP_SERVER_URL=http://localhost:6402
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

### Frontend
The frontend automatically connects to http://localhost:3001. To change this, edit `agent.service.ts`:

```typescript
private apiUrl = 'http://localhost:3001/api';
```

## 🎨 Customization

### Change Colors

Edit `app.component.ts` styles section:

```typescript
// Header gradient
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

// User message gradient
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

// Assistant message
background: #f0f0f0;
```

### Add New Example Queries

Edit `app.component.ts`:

```typescript
exampleQueries = [
  "Your custom query 1",
  "Your custom query 2",
  ...
];
```

## 📱 Responsive Design

The UI is fully responsive and works on:
- **Desktop** - Full-width chat (max 900px)
- **Tablet** - Adapts to screen size
- **Mobile** - Optimized for small screens

## 🐛 Troubleshooting

### Frontend won't start
```bash
# Make sure you're in the right directory
cd family-agent-ui

# Install dependencies
npm install

# Start the dev server
npm start
```

### Backend API not responding
```bash
# Check if the API is running
curl http://localhost:3001/api/health

# If not, start it:
cd agent-api
npm run build
npm start
```

### CORS errors
The backend is configured with CORS enabled for all origins. If you still see CORS errors, check that the API is running on port 3001.

### OpenAI errors
- Check your API key in `agent-api/.env`
- Verify you have credits at https://platform.openai.com/usage
- Check the backend console for error messages

## 🚀 Deployment

### Deploy Backend

```bash
# Build
cd agent-api
npm run build

# Deploy dist/ folder to your server
# Set environment variables on the server
```

### Deploy Frontend

```bash
# Build for production
cd family-agent-ui
ng build

# Deploy dist/family-agent-ui/ folder to your web server
```

## 📚 Development

### Run in Development Mode

**Backend:**
```bash
cd agent-api
npm run dev
```

**Frontend:**
```bash
cd family-agent-ui
npm start
```

### Hot Reload

Angular automatically reloads when you make changes to the source files.

## 💡 Tips

1. **Use Hybrid Mode** for questions about family member achievements
2. **Clear Chat** regularly to keep the interface clean
3. **Try Example Queries** to learn what the agent can do
4. **Watch the Tool Info** to understand how the agent works

## 🎉 Next Steps

- Add user authentication
- Save conversation history to database
- Add voice input/output
- Implement streaming responses
- Add markdown formatting support
- Create mobile app with same UI

## 📖 Related Documentation

- See `../agent/README.md` for agent architecture
- See `../agent/SUMMARY.md` for what you built
- See `../agent/ARCHITECTURE.md` for visual diagrams

Happy chatting! 🚀
