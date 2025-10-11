import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AgentResponse {
  query: string;
  selectedTool: string;
  reasoning: string;
  result: any;
  executionTime: number;
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
