import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AgentService } from './services/agent.service';

interface AgentIteration {
  iterationNumber: number;
  thought: string;
  action: string;
  actionInput?: any;
  observation: string;
  timestamp: Date;
  summary?: string;  // Short one-line summary
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolUsed?: string;
  executionTime?: number;
  iterations?: AgentIteration[];  // Multi-pass iterations
  showIterations?: boolean;  // Toggle to show/hide iterations
  iterationSummaries?: string[];  // Real-time summaries for streaming display
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
  allowHistory = true;  // Toggle for conversation history
  multiPassMode = false;  // Toggle for multi-pass ReACT agent
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
      // Build conversation history only if enabled (last 10 messages to avoid token overflow)
      const conversationHistory = this.allowHistory
        ? this.messages
            .slice(-10) // Keep last 10 messages
            .map(msg => ({
              role: msg.role,
              content: msg.content
            }))
        : []; // Empty array when history is disabled

      const mode = this.multiPassMode ? 'multi-pass' : 'single-pass';
      
      // Use streaming for multi-pass mode to show iterations in real-time
      if (this.multiPassMode) {
        // Create placeholder message for streaming iterations
        const assistantMessage: Message = {
          role: 'assistant',
          content: '⏳ Thinking...',
          timestamp: new Date(),
          iterations: [],
          iterationSummaries: [],
          showIterations: false
        };
        this.messages.push(assistantMessage);

        const response = await this.agentService.queryStream(
          message, 
          conversationHistory, 
          mode,
          (iteration) => {
            // Real-time iteration update with summarized one-liner!
            // Safety check for valid iteration data
            if (!iteration) {
              console.warn('Received undefined iteration');
              return;
            }
            
            assistantMessage.iterations = assistantMessage.iterations || [];
            assistantMessage.iterations.push(iteration);
            
            // Generate and add summary
            const summary = this.generateIterationSummary(iteration);
            assistantMessage.iterationSummaries = assistantMessage.iterationSummaries || [];
            assistantMessage.iterationSummaries.push(summary);
            
            this.scrollToBottom();
          }
        );

        // Update with final answer
        const content = response.result.answer || JSON.stringify(response.result, null, 2);
        assistantMessage.content = content;
        assistantMessage.toolUsed = response.selectedTool;
        assistantMessage.executionTime = response.executionTime;
      } else {
        // Non-streaming for single-pass
        const response = await this.agentService.query(message, conversationHistory, mode);
        
        const content = response.result.answer || JSON.stringify(response.result, null, 2);

        this.messages.push({
          role: 'assistant',
          content,
          timestamp: new Date(),
          toolUsed: response.selectedTool,
          executionTime: response.executionTime,
          iterations: response.iterations || [],
          showIterations: false
        });
      }
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

  toggleIterations(message: Message) {
    message.showIterations = !message.showIterations;
  }

  generateIterationSummary(iteration: AgentIteration): string {
    // Safety check for undefined/null values
    if (!iteration || !iteration.action) {
      return '🔄 Processing...';
    }
    
    const action = iteration.action.toLowerCase();
    const input = iteration.actionInput;
    
    // Extract key parameters from actionInput
    let detail = '';
    if (input && typeof input === 'object') {
      if (input.name) detail = input.name;
      else if (input.refDate) detail = 'from date';
      else if (input.query) detail = input.query;
    }
    
    // Generate natural language summaries based on action
    switch (action) {
      case 'getfamily':
        return detail ? `📋 Getting family data for ${detail}` : '📋 Reading family data';
      case 'getevents':
        return detail ? `📅 Getting events for ${detail}` : '📅 Reading events data';
      case 'getdpoch':
        return '⏰ Reading DPOCH data';
      case 'finish':
        return '✅ Formulating final answer';
      default:
        return `🔧 ${action}${detail ? ': ' + detail : ''}`;
    }
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
