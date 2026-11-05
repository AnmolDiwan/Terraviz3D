import db from '../config/db.js';
import { embed, embedBatch } from './embedding.service.js';
import { preprocessEarthquake } from './preprocessing.service.js';
import { buildGraphEdges } from './graph.service.js';
import Groq from 'groq-sdk';
import env from '../config/env.js';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export const SYSTEM_PROMPT = `You are TerraViz AI, a concise seismology assistant built directly into the TerraViz 3D interactive globe app. You are talking to a curious non-specialist user exploring global seismic activity on a 3D map. The user is trying to understand what the data means in plain language—such as whether a region is active, if an earthquake was dangerous, or what patterns exist—not decipher a technical database log.

CORE RULES:
1. LEAD WITH THE ANSWER: Put the conclusion or direct answer in the very first sentence. Never start with greetings, throat-clearing, or restating the question.
2. EXPLAIN WHAT NUMBERS MEAN: Never state a magnitude, depth, or coordinate without explaining its real-world significance for this user. For example, explain that an M 5.0 causes noticeable shaking and rattling dishes but rare major damage, whereas an M 7.0+ is a severe event capable of structural destruction.
3. STRUCTURE & BREVITY: Follow the first sentence with 1 to 3 reasons or observations that actually matter to this question, then suggest a concrete next action (such as rotating to a region on the globe or checking a specific fault zone).
4. CONNECTED PROSE: Write in fluid, connected prose paragraphs. Use bullet points ONLY when listing strictly parallel options or actionable user steps. Never output a list of earthquakes as your entire reply.
5. MATCH REGISTER & LENGTH: Match the user's conversational tone and length. If the user asks a short, casual question (e.g., "yo whats shaking"), give a punchy 1-2 sentence response. If they ask for an in-depth comparison, provide a thoughtful, structured explanation.
6. DIRECT UNCERTAINTY: If data is missing or outside coverage, state it once, directly (e.g., "There are no recorded earthquakes above magnitude 4.5 in that area this month."). Never use stacked hedges or defensive disclaimers.
7. STRICTLY BANNED PHRASES:
   - "Great question"
   - "Certainly"
   - "I hope this helps"
   - "Based on the provided context" or "According to the context"
   - Restating or parroting the user's question back to them
   - Unrequested recap summaries at the end (e.g., "In summary...")

FEW-SHOT EXAMPLES:

User: "Any big ones recently?"
BAD (data dump): "Based on the provided context, here are the significant earthquakes: 1. Magnitude 7.1 at 275 km SSW of Severo-Kuril'sk, Russia. 2. Magnitude 6.2 at 45 km NW of Hualien, Taiwan. 3. Magnitude 5.8 at 111 km W of Petrolia, CA. Significance: 425."
GOOD: "The most powerful recent event was an M 7.1 quake off the Kuril Islands in Russia—severe enough to trigger regional seismic alarms, though its offshore depth minimized structural damage on land. Taiwan also experienced a strong M 6.2 near Hualien that caused widespread sharp shaking across the island. You can spot both along the northwestern Pacific trenches on your globe; spin toward East Asia to examine the cluster."

User: "Is Japan safe right now?"
BAD (data dump): "The following earthquakes occurred near Japan: 1. Magnitude 5.8 earthquake at 120 km SE of Kushiro, Japan. 2. Magnitude 4.8 earthquake at 81 km ENE of Shikotan, Russia. These events indicate seismic activity in the region."
GOOD: "Japan is experiencing normal background seismic activity for the Pacific Rim, with no catastrophic events recorded this month. The strongest nearby event was a moderate M 5.8 offshore near Kushiro, which produced light to moderate shaking along coastal Hokkaido without triggering tsunami alerts. Look at northeastern Japan on the globe to see how these offshore events align neatly with the Japan Trench subduction zone."
`;

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
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dotProduct / denom : 0;
  };

  const vRes = {
    rows: chunksRes.rows
      .map(row => {
        const emb = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
        return { ...row, score: cosineSim(queryEmbedding, emb) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k * 2)
  };  

  // Stage 2: full-text search & keyword matching
  // Extract keywords (excluding conversational queries like 'show', 'where', 'find')
  const cleanTerms = queryText
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => !/^(show|display|find|locate|where|what|are|is|the|in|at|near|of|me|list|tell|about|please|how|any|all)$/i.test(t))
    .filter(t => t.length > 1);

  let ftsRows = [];
  if (cleanTerms.length > 0) {
    try {
      const tsQuery = cleanTerms.map(t => `${t}:*`).join(' | ');
      const ilikePatterns = cleanTerms.map(t => `%${t}%`);
      const ftsRes = await db.query(`
        SELECT *
        FROM rag_chunks
        WHERE chunk_type = 'primary'
          AND (
            to_tsvector('english', text) @@ to_tsquery('english', $1)
            OR text ILIKE ANY($2)
          )
        LIMIT $3
      `, [tsQuery, ilikePatterns, k * 2]);
      ftsRows = ftsRes.rows;
    } catch (err) {
      console.warn('[RAG] FTS query warning:', err.message);
    }
  }
  
  // Stage 3: graph expansion
  let graphRes = { rows: [] };
  const candidateIds = [...new Set([
    ...ftsRows.slice(0, 3).map(r => r.id),
    ...vRes.rows.slice(0, 3).map(r => r.id)
  ])];

  if (candidateIds.length > 0) {
    try {
      graphRes = await db.query(`
        SELECT c.*
        FROM rag_edges e
        JOIN rag_chunks c ON e.target_id = c.id
        WHERE e.source_id = ANY($1)
          AND c.chunk_type = 'primary'
        ORDER BY e.weight DESC
        LIMIT $2
      `, [candidateIds, k]);
    } catch (err) {
      console.warn('[RAG] Graph expansion warning:', err.message);
    }
  }
  
  // Prioritize FTS exact keyword matches in fusion
  const resultSets = [ftsRows, vRes.rows, graphRes.rows];
  return reciprocalRankFusion(resultSets, k);
}

export async function indexDataPoints(dataPoints) {
  if (!Array.isArray(dataPoints) || dataPoints.length === 0) return 0;

  const preprocessed = dataPoints.map(dp => {
    // Reconstruct GeoJSON feature shape for preprocessEarthquake
    const feature = {
      properties: {
        mag: dp.metadata?.mag || dp.magnitude || 0,
        place: dp.metadata?.place || 'Unknown',
        time: dp.metadata?.time || Date.now(),
        tsunami: dp.metadata?.tsunami || 0,
        sig: dp.metadata?.sig || 0
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

  console.log(`[RAG] Embedding ${primaryTexts.length} primary and ${contextTexts.length} context texts...`);
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

  try {
    await buildGraphEdges(db);
  } catch (err) {
    console.warn('[RAG] Graph edges warning:', err.message);
  }

  return indexedCount;
}

export async function syncEarthquakesFromUSGS() {
  try {
    console.log('[RAG] Fetching latest earthquakes from USGS feed for RAG sync...');
    const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson');
    if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
    const data = await response.json();
    const features = data.features || [];
    console.log(`[RAG] Fetched ${features.length} earthquakes from USGS.`);

    // Convert all features into points for indexing
    const dataPoints = features.map(f => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      magnitude: f.properties.mag,
      category: 'earthquake',
      metadata: {
        place: f.properties.place,
        time: f.properties.time,
        mag: f.properties.mag,
        sig: f.properties.sig || 0,
        tsunami: f.properties.tsunami || 0
      }
    }));

    // Index up to 250 top & globally distributed events
    const count = await indexDataPoints(dataPoints.slice(0, 250));
    console.log(`[RAG] Auto-synced ${count} chunks into database successfully.`);
    return count;
  } catch (err) {
    console.error('[RAG] Error auto-syncing earthquakes:', err.message);
  }
}

export async function ragQuery(query, layerContext) {
  // Check if rag_chunks has data. If empty, auto-sync immediately!
  try {
    const countRes = await db.query("SELECT COUNT(*) FROM rag_chunks WHERE category = 'earthquake'");
    const total = parseInt(countRes.rows[0]?.count || '0', 10);
    if (total === 0) {
      console.log('[RAG] Database empty, triggering automatic USGS sync...');
      await syncEarthquakesFromUSGS();
    }
  } catch (err) {
    console.warn('[RAG] Count check warning:', err.message);
  }

  const queryEmbedding = await embed(query);
  const retrieved = await retrieve(query, queryEmbedding);
  
  const dataBlock = retrieved.length > 0
    ? retrieved.map(r => {
        const m = r.metadata || {};
        const timeStr = m.timestamp ? new Date(m.timestamp).toUTCString() : 'recent';
        const tsunamiStr = m.tsunami ? 'Yes (advisory/warning)' : 'No';
        return `• M${m.magnitude || '?'} | Location: ${m.place || 'Unknown'} | Severity: ${m.severity || 'moderate'} | Time: ${timeStr} | Tsunami: ${tsunamiStr}`;
      }).join('\n')
    : 'No seismic events recorded in current database matching this filter.';

  const userMessage = `[DATA — ${retrieved.length} seismic events retrieved | Active layer: ${layerContext || 'earthquakes'}]
${dataBlock}
[/DATA]

User question: ${query}`;
    
  const showIntent = /\b(show|display|mark|highlight|find|locate|where)\b/i.test(query);

  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    max_tokens: 500,
    temperature: 0.5,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: userMessage
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
