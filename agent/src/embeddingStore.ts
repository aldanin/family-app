import fs from 'fs';
import path from 'path';

export type EmbeddingEntry = {
  text: string;
  embedding: number[];
  [key: string]: any;
};

export class EmbeddingStore {
  private embeddings: EmbeddingEntry[] = [];

  constructor(assetPath?: string) {
    // Default path works from both src/ and dist/ folders
    const defaultPath = assetPath || path.join(__dirname, '../../assets/danin-embeddings.json');
    this.loadEmbeddings(defaultPath);
  }

  private loadEmbeddings(assetPath: string) {
    try {
      const resolvedPath = path.resolve(assetPath);
      console.log(`📂 Attempting to load embeddings from: ${resolvedPath}`);
      const raw = fs.readFileSync(resolvedPath, 'utf8');
      this.embeddings = JSON.parse(raw);
      console.log(`✅ Loaded ${this.embeddings.length} embeddings successfully`);
    } catch (err) {
      console.error(`❌ Could not load embeddings from ${assetPath}:`, err instanceof Error ? err.message : err);
      this.embeddings = [];
    }
  }

  /**
   * Find the most similar embedding to a query vector
   */
  findMostSimilar(queryEmbedding: number[], topK: number = 3): EmbeddingEntry[] {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];
    return this.embeddings
      .map(e => ({ ...e, similarity: cosineSimilarity(queryEmbedding, e.embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Get all embeddings
   */
  getAll(): EmbeddingEntry[] {
    return this.embeddings;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] || 0), 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return normA && normB ? dot / (normA * normB) : 0;
}
