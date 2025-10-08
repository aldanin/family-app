import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AgentService } from './services/agent.service';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolUsed?: string;
  executionTime?: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  providers: [AgentService],
  template: `
    <div class="chat-container">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <h1>🤖 Family AI Agent</h1>
          <p class="subtitle">Powered by OpenAI + MCP Server</p>
        </div>
        <div class="controls">
          <label class="hybrid-toggle">
            <input type="checkbox" [(ngModel)]="hybridMode">
            <span>🔗 Hybrid Mode</span>
          </label>
          <button class="clear-btn" (click)="clearChat()">🗑️ Clear</button>
        </div>
      </div>

      <!-- Messages -->
      <div class="messages" #messagesContainer>
        <div *ngIf="messages.length === 0" class="empty-state">
          <h2>👋 Welcome!</h2>
          <p>Ask me anything about your family or general questions.</p>
          <div class="examples">
            <h3>Try these examples:</h3>
            <button *ngFor="let example of exampleQueries" 
                    class="example-btn"
                    (click)="sendMessage(example)">
              {{ example }}
            </button>
          </div>
        </div>

        <div *ngFor="let message of messages" 
             class="message"
             [class.user-message]="message.role === 'user'"
             [class.assistant-message]="message.role === 'assistant'">
          <div class="message-header">
            <span class="role">{{ message.role === 'user' ? '👤 You' : '🤖 Agent' }}</span>
            <span class="timestamp">{{ message.timestamp | date:'short' }}</span>
          </div>
          <div class="message-content">{{ message.content }}</div>
          <div *ngIf="message.toolUsed" class="message-footer">
            <span class="tool">Tool: {{ message.toolUsed }}</span>
            <span class="time">{{ message.executionTime }}ms</span>
          </div>
        </div>

        <div *ngIf="isLoading" class="message assistant-message loading">
          <div class="message-header">
            <span class="role">🤖 Agent</span>
          </div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="input-container">
        <div class="input-wrapper">
          <input 
            type="text" 
            [(ngModel)]="userInput"
            (keyup.enter)="sendMessage()"
            [disabled]="isLoading"
            placeholder="Type your message here..."
            class="message-input">
          <button 
            (click)="sendMessage()"
            [disabled]="!userInput.trim() || isLoading"
            class="send-btn">
            {{ isLoading ? '⏳' : '▶️' }} Send
          </button>
        </div>
        <div class="input-hint" *ngIf="hybridMode">
          🔗 Hybrid mode is ON - Agent will combine family data with AI analysis
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      background: #f7f7f8;
    }

    .chat-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-width: 900px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .header-content h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }

    .subtitle {
      margin: 5px 0 0 0;
      opacity: 0.9;
      font-size: 14px;
    }

    .controls {
      display: flex;
      gap: 15px;
      align-items: center;
    }

    .hybrid-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      background: rgba(255,255,255,0.2);
      padding: 8px 15px;
      border-radius: 20px;
      transition: background 0.3s;
    }

    .hybrid-toggle:hover {
      background: rgba(255,255,255,0.3);
    }

    .hybrid-toggle input {
      cursor: pointer;
    }

    .clear-btn {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 8px 15px;
      border-radius: 20px;
      cursor: pointer;
      transition: background 0.3s;
    }

    .clear-btn:hover {
      background: rgba(255,255,255,0.3);
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #666;
    }

    .empty-state h2 {
      color: #333;
      margin-bottom: 10px;
    }

    .examples {
      margin-top: 30px;
    }

    .examples h3 {
      font-size: 14px;
      color: #666;
      margin-bottom: 15px;
    }

    .example-btn {
      display: block;
      width: 100%;
      max-width: 500px;
      margin: 10px auto;
      padding: 12px 20px;
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s;
      text-align: left;
      color: #333;
    }

    .example-btn:hover {
      border-color: #667eea;
      background: #f8f9ff;
      transform: translateY(-2px);
    }

    .message {
      padding: 15px;
      border-radius: 12px;
      max-width: 80%;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .user-message {
      align-self: flex-end;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin-left: auto;
    }

    .assistant-message {
      align-self: flex-start;
      background: #f0f0f0;
      color: #333;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 8px;
      opacity: 0.8;
    }

    .role {
      font-weight: 600;
    }

    .message-content {
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .message-footer {
      margin-top: 8px;
      font-size: 11px;
      opacity: 0.7;
      display: flex;
      gap: 15px;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 10px 0;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #666;
      animation: typing 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.4;
      }
      30% {
        transform: translateY(-10px);
        opacity: 1;
      }
    }

    .input-container {
      border-top: 1px solid #e0e0e0;
      padding: 20px;
      background: white;
    }

    .input-wrapper {
      display: flex;
      gap: 10px;
    }

    .message-input {
      flex: 1;
      padding: 12px 20px;
      border: 2px solid #e0e0e0;
      border-radius: 25px;
      font-size: 15px;
      outline: none;
      transition: border-color 0.3s;
    }

    .message-input:focus {
      border-color: #667eea;
    }

    .send-btn {
      padding: 12px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 25px;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.2s;
    }

    .send-btn:hover:not(:disabled) {
      transform: scale(1.05);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-hint {
      margin-top: 10px;
      font-size: 12px;
      color: #667eea;
      text-align: center;
    }
  `]
})
export class AppComponent {
  messages: Message[] = [];
  userInput = '';
  hybridMode = false;
  isLoading = false;

  exampleQueries = [
    "What is DPOC?",
    "Show me Maya's events",
    "Tell me about Maya's achievements",
    "Explain what AI is"
  ];

  constructor(private agentService: AgentService) {}

  async sendMessage(text?: string) {
    const message = text || this.userInput.trim();
    if (!message || this.isLoading) return;

    // Add user message
    this.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    this.userInput = '';
    this.isLoading = true;

    try {
      const response = await this.agentService.query(message, this.hybridMode);
      
      // Unified response structure - just get the answer!
      const content = response.result.answer || JSON.stringify(response.result, null, 2);

      this.messages.push({
        role: 'assistant',
        content,
        timestamp: new Date(),
        toolUsed: response.selectedTool,
        executionTime: response.executionTime
      });
    } catch (error) {
      this.messages.push({
        role: 'assistant',
        content: '❌ Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        timestamp: new Date()
      });
    } finally {
      this.isLoading = false;
      this.scrollToBottom();
    }
  }

  clearChat() {
    this.messages = [];
  }

  private scrollToBottom() {
    setTimeout(() => {
      const container = document.querySelector('.messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }
}
