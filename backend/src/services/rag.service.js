import db from '../config/db.js';
import { embed, embedBatch } from './embedding.service.js';
import { preprocessEarthquake } from './preprocessing.service.js';
import { buildGraphEdges } from './graph.service.js';
import Groq from 'groq-sdk';
import env from '../config/env.js';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

function reciprocalRankFusion(resultSets, k, kConstant = 60) {
  const scores = {};
  const docs = {};

  resultSets.forEach(results => {
    results.forEach((doc, rank) => {
      if (!scores[doc.id]) {
        scores[doc.id] = 0;
        docs[doc.id] = doc;
      }
      scores[doc.id] += 1 / (kConstant + rank + 1);
    });
  });

  return Object.values(docs)
    .sort((a, b) => scores[b.id] - scores[a.id])
    .slice(0, k);
}

async function retrieve(queryText, queryEmbedding, k = 8) {
  // Stage 1: vector cosine search (fallback to JS)
  const chunksRes = await db.query(`
    SELECT id, text, metadata, embedding
    FROM rag_chunks
    WHERE chunk_type = 'primary'
  `);
  
  const cosineSim = (vecA, vecB) => {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const vRes = {
    rows: chunksRes.rows
      .map(row => ({ ...row, score: cosineSim(queryEmbedding, row.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k * 2)
  };  
  // Stage 2: full-text search
  const ftsRes = await db.query(`
    SELECT *
    FROM rag_chunks
    WHERE chunk_type = 'primary'
      AND to_tsvector('english', text) @@ plainto_tsquery('english', $1)
    LIMIT $2
  `, [queryText, k * 2]);
  
  // Stage 3: graph expansion
  let graphRes = { rows: [] };
  if (vRes.rows.length > 0) {
    const top5Ids = vRes.rows.slice(0, 5).map(r => r.id);
    graphRes = await db.query(`
      SELECT c.*
      FROM rag_edges e
      JOIN rag_chunks c ON e.target_id = c.id
      WHERE e.source_id = ANY($1)
        AND c.chunk_type = 'primary'
      ORDER BY e.weight DESC
      LIMIT $2
    `, [top5Ids, k]);
  }
  
  const resultSets = [vRes.rows, ftsRes.rows, graphRes.rows];
  return reciprocalRankFusion(resultSets, k);
}

export async function indexDataPoints(dataPoints) {
  const preprocessed = dataPoints.map(dp => {
    // Reconstruct GeoJSON feature shape for preprocessEarthquake
    const feature = {
      properties: {
        mag: dp.metadata.mag || dp.magnitude,
        place: dp.metadata.place,
        time: dp.metadata.time,
        tsunami: dp.metadata.tsunami,
        sig: dp.metadata.sig
      },
      geometry: {
        coordinates: [dp.lng, dp.lat]
      }
    };
    const { primaryText, contextText, metadata } = preprocessEarthquake(feature);
    const source_id = dp.id || `eq_${metadata.timestamp}_${metadata.lat}_${metadata.lng}`;
    
    return {
      primaryText,
      contextText,
      metadata,
      source_id_primary: `${source_id}_primary`,
      source_id_context: `${source_id}_context`
    };
  });

  const primaryTexts = preprocessed.map(p => p.primaryText);
  const contextTexts = preprocessed.map(p => p.contextText);

  const primaryEmbeddings = await embedBatch(primaryTexts);
  const contextEmbeddings = await embedBatch(contextTexts);

  let indexedCount = 0;
  for (let i = 0; i < preprocessed.length; i++) {
    const p = preprocessed[i];
    
    await db.query(`
      INSERT INTO rag_chunks (source_id, category, chunk_type, text, embedding, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (source_id) DO UPDATE SET
        text = EXCLUDED.text,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        indexed_at = NOW()
    `, [
      p.source_id_primary, 
      'earthquake', 
      'primary', 
      p.primaryText, 
      JSON.stringify(primaryEmbeddings[i]), 
      p.metadata
    ]);

    await db.query(`
      INSERT INTO rag_chunks (source_id, category, chunk_type, text, embedding, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (source_id) DO UPDATE SET
        text = EXCLUDED.text,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        indexed_at = NOW()
    `, [
      p.source_id_context, 
      'earthquake', 
      'context', 
      p.contextText, 
      JSON.stringify(contextEmbeddings[i]), 
      p.metadata
    ]);

    indexedCount += 2;
  }

  await buildGraphEdges(db);
  return indexedCount;
}

export async function ragQuery(query, layerContext) {
  const queryEmbedding = await embed(query);
  const retrieved = await retrieve(query, queryEmbedding);
  
  const context = retrieved.length > 0
    ? retrieved.map((r, i) => `${i + 1}. ${r.text}`).join('\n')
    : 'No relevant data found.';
    
  const showIntent = /\b(show|display|mark|highlight|find|locate|where)\b/i.test(query);

  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    max_tokens: 400,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: 'You are a geospatial analyst. Answer only from the provided context.'
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuery:\n${query}`
      }
    ]
  });

  const answer = completion.choices[0]?.message?.content || 'No answer available.';
  
  const markers = showIntent ? retrieved.map(r => ({
    lat: r.metadata.lat,
    lng: r.metadata.lng,
    magnitude: r.metadata.magnitude,
    place: r.metadata.place,
    category: 'earthquake'
  })) : [];

  return { answer, sources: retrieved, markers };
}
