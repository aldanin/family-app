import { EmbeddingStore } from './embeddingStore';

import path from 'path';
// Path to your embeddings file (works after compilation)
const embeddingPath = path.join(__dirname, '../assets/danin-embeddings.json');

const store = new EmbeddingStore(embeddingPath);

// Example: Use a dummy embedding (all zeros, same length as first entry)
const all = store.getAll();
if (all.length === 0) {
  console.error('No embeddings loaded.');
  process.exit(1);
}

const dummyEmbedding = new Array(all[0].embedding.length).fill(0);
const top = store.findMostSimilar(dummyEmbedding, 3);

console.log('Top 3 similar embeddings to dummy vector:');
top.forEach((entry, i) => {
  console.log(`#${i+1}:`, entry.text, 'Similarity:', entry.similarity);
});
