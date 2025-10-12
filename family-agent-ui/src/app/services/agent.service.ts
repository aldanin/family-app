import { Injectable } from '@angular/core';
import { AgentMode } from '../agent-mode.enum';
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

  public async query(query: string, conversationHistory: ConversationMessage[] = [], mode: AgentMode = AgentMode.SinglePass): Promise<AgentResponse> {
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
  public async queryStream(
    query: string, 
    conversationHistory: ConversationMessage[] = [], 
    mode: AgentMode = AgentMode.SinglePass,
    onIteration: (iteration: AgentIteration) => void
  ): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      this.streamAgentResponse(query, conversationHistory, mode, onIteration, resolve, reject);
    });
  }

  private async streamAgentResponse(
    query: string,
    conversationHistory: ConversationMessage[],
    mode: AgentMode,
    onIteration: (iteration: AgentIteration) => void,
    resolve: (value: AgentResponse) => void,
    reject: (reason?: any) => void
  ) {
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
        this.processSseLines(lines, onIteration, resolve, reject);
      }
    }).catch(reject);
  }

  private processSseLines(
    lines: string[],
    onIteration: (iteration: AgentIteration) => void,
    resolve: (value: AgentResponse) => void,
    reject: (reason?: any) => void
  ) {
    for (const line of lines) {
      if (!line || !line.trim()) continue;
      if (line.startsWith('data: ')) {
        this.handleSseData(line.substring(6), onIteration, resolve, reject, line);
      }
    }
  }

  private handleSseData(
    jsonString: string,
    onIteration: (iteration: AgentIteration) => void,
    resolve: (value: AgentResponse) => void,
    reject: (reason?: any) => void,
    rawLine?: string
  ) {
    try {
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
      console.warn('Failed to parse SSE data:', rawLine || jsonString, parseError);
    }
  }
}
