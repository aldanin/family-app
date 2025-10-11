import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AgentIteration {
  iterationNumber: number;
  thought: string;
  action: string;
  actionInput?: any;
  observation: string;
  timestamp: Date;
}

export interface AgentResponse {
  query: string;
  selectedTool: string;
  reasoning: string;
  result: any;
  executionTime: number;
  iterations?: AgentIteration[];  // Multi-pass iterations
  totalIterations?: number;
  reasoningSteps?: string[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private apiUrl = 'http://localhost:3001/api';

  constructor(private http: HttpClient) {}

  async query(query: string, conversationHistory: ConversationMessage[] = [], mode: 'single-pass' | 'multi-pass' = 'single-pass'): Promise<AgentResponse> {
    return firstValueFrom(
      this.http.post<AgentResponse>(`${this.apiUrl}/query`, {
        query,
        conversationHistory,
        mode
      })
    );
  }

  /**
   * Stream query with real-time iteration updates (for multi-pass mode)
   */
  async queryStream(
    query: string, 
    conversationHistory: ConversationMessage[] = [], 
    mode: 'single-pass' | 'multi-pass' = 'single-pass',
    onIteration: (iteration: AgentIteration) => void
  ): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `${this.apiUrl}/query/stream?` + new URLSearchParams({
          query,
          conversationHistory: JSON.stringify(conversationHistory),
          mode
        })
      );

      // Note: EventSource only supports GET, so we need to adjust the backend
      // For now, use fetch with POST for SSE
      
      fetch(`${this.apiUrl}/query/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, conversationHistory, mode })
      }).then(async response => {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          reject(new Error('No response body'));
          return;
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            // Skip empty lines
            if (!line || !line.trim()) continue;
            
            if (line.startsWith('data: ')) {
              try {
                const jsonString = line.substring(6);
                console.log('Parsing SSE data:', jsonString);
                const data = JSON.parse(jsonString);
                
                if (data.type === 'iteration') {
                  console.log('Iteration received:', data.data);
                  onIteration(data.data);
                } else if (data.type === 'complete') {
                  resolve(data.data);
                } else if (data.type === 'error') {
                  reject(new Error(data.error));
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', line, parseError);
              }
            }
          }
        }
      }).catch(reject);
    });
  }

  async getCapabilities() {
    return firstValueFrom(
      this.http.get(`${this.apiUrl}/capabilities`)
    );
  }

  async getExamples() {
    return firstValueFrom(
      this.http.get(`${this.apiUrl}/examples`)
    );
  }
}
