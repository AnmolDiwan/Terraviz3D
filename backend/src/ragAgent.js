import dotenv from 'dotenv'
import Groq from 'groq-sdk'

dotenv.config()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── In-memory store — keyword based, no embeddings needed ─────
let dataStore = []

// ── Convert datapoint to readable text ───────────────────────
function dataPointToText(dp) {
  const place = dp.metadata?.place ?? 'Unknown location'
  const time  = dp.metadata?.time
    ? new Date(dp.metadata.time).toDateString()
    : 'Unknown time'
  return `Magnitude ${dp.magnitude} earthquake near ${place} on ${time} at coordinates ${dp.lat.toFixed(2)}, ${dp.lng.toFixed(2)}`
}

// ── Index — instant, no API calls at all ──────────────────────
export async function indexDataPoints(dataPoints) {
  dataStore = dataPoints.map(dp => ({
    text:      dataPointToText(dp),
    dataPoint: dp,
  }))
  console.log(`[RAG] ✅ Indexed ${dataStore.length} points instantly`)
}

// ── Keyword retrieval — zero API calls ───────────────────────
function retrieve(query, k = 8) {
  if (dataStore.length === 0) return []

  const queryLower = query.toLowerCase()
  const stopWords  = /show|find|where|display|highlight|earthquakes?|magnitude|near|in|the|of|are|a|an/g
  const keywords   = queryLower
    .replace(stopWords, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2)

  console.log(`[RAG] Searching for keywords:`, keywords)

  const scored = dataStore.map(entry => {
    const textLower = entry.text.toLowerCase()
    let score = 0

    // Keyword match score
    keywords.forEach(kw => {
      if (textLower.includes(kw)) score += 3
    })

    // Boost for strong/big/large queries
    if (/strong|big|large|major|powerful/i.test(query)) {
      score += entry.dataPoint.magnitude * 0.8
    }

    // Small magnitude boost so results are interesting
    score += entry.dataPoint.magnitude * 0.05

    return { ...entry, score }
  })

  const results = scored
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)

  console.log(`[RAG] Found ${results.length} relevant points`)
  return results
}

// ── Main RAG query — only 1 API call to Groq ─────────────────
export async function ragQuery(query, layerContext = 'none') {
  console.log(`[RAG] Query received: "${query}"`)

  // Step 1: Retrieve relevant points — zero API calls
  const retrieved = retrieve(query, 8)

  // Step 2: Build context
  const context = retrieved.length > 0
    ? retrieved.map((r, i) => `${i + 1}. ${r.text}`).join('\n')
    : `No specific location matches found. Total earthquakes in database: ${dataStore.length}`

  // Step 3: Detect show intent
  const showIntent = /show|display|mark|highlight|where|find|locate/i.test(query)

  // Step 4: Ask Groq — just 1 API call
  console.log(`[RAG] Calling Groq API...`)
  const completion = await groq.chat.completions.create({
    model:    'llama-3.1-8b-instant', // free, very fast
    messages: [
      {
        role:    'system',
        content: `You are TerraViz AI, a geospatial intelligence assistant for a 3D globe visualization app.
You have access to real-time earthquake data. Answer concisely in 2-3 sentences.
If the user asks to show or find something, confirm the markers are being highlighted on the globe.
Always mention specific locations and magnitudes from the data provided.`
      },
      {
        role:    'user',
        content: `Earthquake data context:\n${context}\n\nQuestion: ${query}`
      }
    ],
    max_tokens:  300,
    temperature: 0.4,
  })

  const answer = completion.choices[0].message.content
  console.log(`[RAG] ✅ Groq responded successfully`)

  return {
    answer,
    sources: retrieved.map(r => r.text.slice(0, 100) + '...'),
    markers: showIntent ? retrieved.map(r => r.dataPoint) : []
  }
}