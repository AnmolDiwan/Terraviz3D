import { pipeline } from '@xenova/transformers';

let embedderPromise = null;

async function getEmbedder() {
  if (!embedderPromise) {
    console.log('[Embedding] Initializing Xenova/all-MiniLM-L6-v2 pipeline...');
    embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedderPromise;
}

async function embed(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function embedBatch(texts) {
  if (!texts || texts.length === 0) return [];
  const model = await getEmbedder();
  const CHUNK_SIZE = 64;
  const allEmbeddings = [];
  
  const totalChunks = Math.ceil(texts.length / CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    const chunk = texts.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const output = await model(chunk, { pooling: 'mean', normalize: true });
    allEmbeddings.push(...output.tolist());
  }
  
  return allEmbeddings;
}

export { embed, embedBatch, getEmbedder };
