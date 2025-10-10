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
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  messages: Message[] = [];
  userInput = '';
  hybridMode = false;
  isLoading = false;

  exampleQueries = [
    "What is DPOCH?",
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
