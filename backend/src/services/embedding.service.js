import { pipeline } from '@xenova/transformers';

let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    console.log('Loading embedding model...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

async function embed(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function embedBatch(texts) {
  const CHUNK_SIZE = 32;
  const allEmbeddings = [];
  
  const totalChunks = Math.ceil(texts.length / CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    console.log(`Embedding batch ${i + 1}/${totalChunks}...`);
    const chunk = texts.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    
    const chunkEmbeddings = await Promise.all(chunk.map(text => embed(text)));
    allEmbeddings.push(...chunkEmbeddings);
  }
  
  return allEmbeddings;
}

export { embed, embedBatch };
