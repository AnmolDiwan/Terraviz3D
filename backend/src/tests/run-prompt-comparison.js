import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import env from '../config/env.js';
import db from '../config/db.js';
import { embed } from '../services/embedding.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// OLD SETUP
const OLD_SYSTEM_PROMPT = 'You are a geospatial intelligence analyst. Answer accurately from the provided context. If relevant events exist in the context, list their magnitude and location.';

function formatOldUserMessage(query, retrieved) {
  const context = retrieved.length > 0
    ? retrieved.map((r, i) => `${i + 1}. ${r.text}`).join('\n')
    : 'No relevant data found.';
  return `Context:\n${context}\n\nQuery:\n${query}`;
}

// NEW SETUP
export const NEW_SYSTEM_PROMPT = `You are TerraViz AI, a concise seismology assistant built directly into the TerraViz 3D interactive globe app. You are talking to a curious non-specialist user exploring global seismic activity on a 3D map. The user is trying to understand what the data means in plain language—such as whether a region is active, if an earthquake was dangerous, or what patterns exist—not decipher a technical database log.

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

function formatNewUserMessage(query, retrieved, layerContext = 'earthquake') {
  const dataBlock = retrieved.length > 0
    ? retrieved.map(r => {
        const m = r.metadata || {};
        const timeStr = m.timestamp ? new Date(m.timestamp).toUTCString() : 'recent';
        const tsunamiStr = m.tsunami ? 'Yes (advisory/warning)' : 'No';
        return `• M${m.magnitude || '?'} | Location: ${m.place || 'Unknown'} | Severity: ${m.severity || 'moderate'} | Time: ${timeStr} | Tsunami: ${tsunamiStr}`;
      }).join('\n')
    : 'No seismic events recorded in current database matching this filter.';

  return `[DATA — ${retrieved.length} seismic events retrieved | Active layer: ${layerContext}]
${dataBlock}
[/DATA]

User question: ${query}`;
}

// Retrieval helpers (same as in rag.service.js)
function reciprocalRankFusion(resultSets, k = 8, kConstant = 60) {
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
      // ignore
    }
  }
  
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
      // ignore
    }
  }
  
  return reciprocalRankFusion([ftsRows, vRes.rows, graphRes.rows], k);
}

// Rubric scoring helpers
function evaluateResponse(query, text) {
  const trimmed = (text || '').trim();
  const lower = trimmed.toLowerCase();

  // 1. Answer-first: Does the first sentence deliver conclusion/answer directly without throat clearing?
  const firstSentence = trimmed.split(/[.!?\n]/)[0].trim().toLowerCase();
  const isPreamble = /^(based on|according to|here are|the following|in this|regarding your|to answer|sure|certainly|hello|hi|as an ai)/i.test(firstSentence);
  const startsWithList = /^(\d+\.|\*|-)/.test(trimmed);
  const answerFirst = (!isPreamble && !startsWithList && firstSentence.length > 10) ? 1 : 0;

  // 2. Interprets data: Explains significance/impact/meaning of numbers instead of just listing "Magnitude X at Y"
  const interpretKeywords = /(damage|shaking|shake|rattle|alarm|tsunami|subduction|boundary|fault|trench|plate|severe|moderate|minor|strong|notable|typical|normal|background|danger|feel|felt|risk|safe)/i;
  const isDataDump = /^(\d+\.\s*magnitude|\s*-\s*magnitude|\s*\*\s*magnitude)/im.test(trimmed) && trimmed.split('\n').filter(l => /magnitude/i.test(l)).length >= 3;
  const interpretsData = (interpretKeywords.test(trimmed) && !isDataDump) ? 1 : 0;

  // 3. No filler: Free of banned phrases and meta filler
  const bannedRegex = /(great question|certainly|i hope this helps|based on the provided context|according to the context|as an ai language model|feel free to ask)/i;
  const noFiller = (!bannedRegex.test(trimmed)) ? 1 : 0;

  // 4. Matches register: Short casual inputs get short casual answers, detailed queries get thorough answers
  const isCasual = query.length < 25 && /^(yo|what's|whats|any|is\s|are\s)/i.test(query);
  const wordCount = trimmed.split(/\s+/).length;
  let matchesRegister = 1;
  if (isCasual && wordCount > 90) {
    matchesRegister = 0; // too long/essay-like for a 3-word casual question
  } else if (!isCasual && wordCount < 20) {
    matchesRegister = 0; // too terse for an analytical question
  }

  return {
    answer_first: answerFirst,
    interprets_data: interpretsData,
    no_filler: noFiller,
    matches_register: matchesRegister,
    total: answerFirst + interpretsData + noFiller + matchesRegister
  };
}

async function main() {
  console.log('🚀 Loading 15 test queries...');
  const testInputsPath = path.join(__dirname, 'ai-prompt-test-inputs.json');
  const queries = JSON.parse(fs.readFileSync(testInputsPath, 'utf8'));

  const results = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`\n[${i + 1}/${queries.length}] Processing: "${query}"`);

    // 1. Retrieve data
    const queryEmb = await embed(query);
    const retrieved = await retrieve(query, queryEmb, 8);
    console.log(`  -> Retrieved ${retrieved.length} chunks`);

    // 2. Run OLD prompt
    const oldUserMsg = formatOldUserMessage(query, retrieved);
    const oldCompletion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      max_tokens: 400,
      temperature: 0.3,
      messages: [
        { role: 'system', content: OLD_SYSTEM_PROMPT },
        { role: 'user', content: oldUserMsg }
      ]
    });
    const oldText = oldCompletion.choices[0]?.message?.content || '';
    const oldScore = evaluateResponse(query, oldText);

    // 3. Run NEW prompt
    const newUserMsg = formatNewUserMessage(query, retrieved);
    const newCompletion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      max_tokens: 500,
      temperature: 0.5,
      messages: [
        { role: 'system', content: NEW_SYSTEM_PROMPT },
        { role: 'user', content: newUserMsg }
      ]
    });
    const newText = newCompletion.choices[0]?.message?.content || '';
    const newScore = evaluateResponse(query, newText);

    console.log(`  Old Score: ${oldScore.total}/4 | New Score: ${newScore.total}/4`);

    results.push({
      index: i + 1,
      query,
      retrievedCount: retrieved.length,
      old: {
        output: oldText,
        scores: oldScore
      },
      new: {
        output: newText,
        scores: newScore
      }
    });

    // Short sleep between calls to be respectful of rate limits
    await new Promise(r => setTimeout(r, 600));
  }

  // Write comparison results
  const outputPath = path.join(__dirname, 'comparison-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n✅ Saved all 15 results to ${outputPath}`);

  // Summary calculation
  let oldTotals = { answer_first: 0, interprets_data: 0, no_filler: 0, matches_register: 0, total: 0 };
  let newTotals = { answer_first: 0, interprets_data: 0, no_filler: 0, matches_register: 0, total: 0 };

  for (const r of results) {
    oldTotals.answer_first += r.old.scores.answer_first;
    oldTotals.interprets_data += r.old.scores.interprets_data;
    oldTotals.no_filler += r.old.scores.no_filler;
    oldTotals.matches_register += r.old.scores.matches_register;
    oldTotals.total += r.old.scores.total;

    newTotals.answer_first += r.new.scores.answer_first;
    newTotals.interprets_data += r.new.scores.interprets_data;
    newTotals.no_filler += r.new.scores.no_filler;
    newTotals.matches_register += r.new.scores.matches_register;
    newTotals.total += r.new.scores.total;
  }

  console.log('\n========================================');
  console.log('       PROMPT COMPARISON RESULTS        ');
  console.log('========================================');
  console.log(`Metric               | Old Prompt | New Prompt`);
  console.log(`----------------------------------------`);
  console.log(`Answer-first (/15)   | ${String(oldTotals.answer_first).padStart(10)} | ${String(newTotals.answer_first).padStart(10)}`);
  console.log(`Interprets data (/15)| ${String(oldTotals.interprets_data).padStart(10)} | ${String(newTotals.interprets_data).padStart(10)}`);
  console.log(`No filler (/15)      | ${String(oldTotals.no_filler).padStart(10)} | ${String(newTotals.no_filler).padStart(10)}`);
  console.log(`Matches register(/15)| ${String(oldTotals.matches_register).padStart(10)} | ${String(newTotals.matches_register).padStart(10)}`);
  console.log(`----------------------------------------`);
  console.log(`TOTAL SCORE (/60)    | ${String(oldTotals.total).padStart(10)} | ${String(newTotals.total).padStart(10)}`);
  console.log('========================================\n');

  await db.end();
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

