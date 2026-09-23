# 🌍 TerraViz 3D — Geospatial Intelligence Dashboard

> **Real-time geospatial intelligence on an interactive 3D globe.** Explore live earthquake data, world population statistics, and interrogate your data with a built-in AI assistant — all rendered in a cinematic, WebGL-powered 3D environment.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Database Setup](#database-setup)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [API Reference](#api-reference)
- [Frontend Deep-Dive](#frontend-deep-dive)
  - [GlobeEngine](#globeengine)
  - [Data Layers](#data-layers)
  - [AI Chat Panel](#ai-chat-panel)
  - [Auth Modal](#auth-modal)
- [Backend Deep-Dive](#backend-deep-dive)
  - [Auth System](#auth-system)
  - [Geo Proxy Caching](#geo-proxy-caching)
  - [Advanced RAG AI System](#advanced-rag-ai-system)
- [Security Model](#security-model)
- [External Data Sources](#external-data-sources)
- [Known Limitations & Roadmap](#known-limitations--roadmap)

---

## Overview

TerraViz 3D is a full-stack geospatial intelligence platform. It renders a photorealistic, interactive 3D Earth in the browser using Three.js, overlays live scientific datasets as 3D visualizations, and connects to a Node.js/Express backend that handles authentication, session management, and an advanced AI-powered natural-language query engine featuring hybrid Graph-RAG retrieval.

Users can:
- Rotate, zoom, and interact with a WebGL-rendered globe
- Toggle live earthquake and world population data layers
- Click any marker to inspect rich metadata
- Ask an AI assistant questions like *"Show me earthquakes in Japan"* — the AI leverages vector search, full-text search, and graph expansion to find relevant data, then highlights matching events directly on the globe.

---

## Features

| Feature | Description |
|---|---|
| 🌐 **3D Globe** | Photorealistic Earth with custom atmosphere shaders, bump-mapped terrain, and an 8,000-point star field |
| 🔴 **Earthquake Layer** | Live USGS M4.5+ earthquake feed for the past 30 days, rendered as glowing magnitude-scaled cylinders |
| 🔵 **Population Layer** | REST Countries API data for 195+ countries, rendered as teal pillars scaled logarithmically to population |
| 🤖 **AI Assistant (Graph RAG)** | Natural-language interface powered by Groq and Xenova embeddings. Uses Hybrid Vector Search, Full-Text Search, and Graph Expansion for high-accuracy retrieval. |
| 🔐 **Auth System** | Full JWT-based authentication with bcrypt hashing, brute-force lockout (5 attempts → 15-min lock), session tracking, and audit logging. State managed via a central `useAuth` hook. |
| 🎨 **Premium UI** | Dark sci-fi aesthetic with Orbitron/Inter/JetBrains Mono fonts, glassmorphism panels, scan-line overlays, twinkling star backgrounds, and micro-animations |
| ⚡ **Proxy Caching** | External geo APIs are routed through the backend with in-memory TTL caching to prevent rate-limiting and improve latency |

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI components & state management |
| Three.js | 0.183 | WebGL 3D rendering engine |
| Vite | 8 | Dev server & build tool |
| TailwindCSS | 3.4 | Utility CSS (minimal use) |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js + Express | 4.18 | REST API server |
| PostgreSQL (`pg`) | 8.11 | Core persistence layer (Users, Sessions, RAG Chunks, Graph Edges) |
| @xenova/transformers| 2.x | Local embedding generation (all-MiniLM-L6-v2) |
| jsonwebtoken | 9.0 | JWT generation & verification |
| Groq SDK | 1.1 | LLM inference |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React + Three.js)                  │
│                                                                     │
│  ┌──────────────┐   ┌──────────────────┐   ┌──────────────────────┐│
│  │  GlobeEngine │   │  App.jsx         │   │   AIChatPanel        ││
│  │  (Three.js)  │◄──│  (useAuth hook)  │◄──│   RAG queries        ││
│  │              │   │  Services        │   │   Marker highlights  ││
│  └──────────────┘   └────────┬─────────┘   └──────────────────────┘│
└──────────────────────────────┼──────────────────────────────────────┘
                               │ Vite proxy → localhost:4000
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Express Backend (port 4000)                     │
│                                                                     │
│  ┌────────────────┐ ┌────────────────┐ ┌─────────────────────────┐  │
│  │   Auth Routes  │ │  Geo Routes    │ │        AI Routes        │  │
│  │  POST /login   │ │  GET /earth... │ │  POST /api/ai/index     │  │
│  │  GET /me       │ │  GET /count... │ │  POST /api/ai/query     │  │
│  └───────┬────────┘ └───────┬────────┘ └───────────┬─────────────┘  │
│          │                  │ (TTL Cache)          │                │
│  ┌───────▼──────────────────▼──────────────────────▼─────────────┐  │
│  │                        PostgreSQL                             │  │
│  │   users, sessions, auth_tokens, rag_chunks, rag_edges         │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Key design choices:**
- **Service Layer (Frontend):** All API calls (`auth.service.js`, `geo.service.js`, `ai.service.js`) and authentication logic (`useAuth.js`) are decoupled from UI components.
- **Backend Caching:** The `geo.service.js` acts as a proxy for external APIs, buffering them in memory with TTLs to prevent rate limits.
- **Hybrid RAG Retrieval:** The AI uses a highly advanced 3-stage retrieval pipeline: Vector Cosine Similarity (in-JS fallback), Full-Text Search (pg_trgm), and Graph Edge Expansion (finding related nodes via `rag_edges`). Results are combined via Reciprocal Rank Fusion.

---

## Project Structure

```text
Terraviz3D/
├── backend/
│   ├── src/
│   │   ├── controllers/     # ai, auth, geo controllers
│   │   ├── db/migrations/   # Schema SQL definitions
│   │   ├── middleware/      # auth, rateLimiter, errorHandler
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic (ai, geo, graph, embedding, preprocessing)
│   │   └── server.js        # Express app entry point
│   └── .env                 # Backend environment variables
│
└── frontend/
    ├── src/
    │   ├── components/      # GlobeEngine.js, AIChatpanel.jsx, AuthModal.jsx
    │   ├── hooks/           # useAuth.js
    │   ├── services/        # auth, geo, ai service layers
    │   ├── App.jsx          # Main application view
    │   └── main.jsx         # React 19 entry point
    └── vite.config.js       # Vite dev proxy configuration
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14 
- A **Groq API key** (free tier at [console.groq.com](https://console.groq.com))

### Database Setup

Run the migrations script to initialize the core database tables (Users, Sessions, RAG Chunks, Graph Edges):

```bash
cd backend
npm run migrate
```

### Environment Variables

Create `backend/.env` with the following:

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=terraviz
DB_USER=postgres
DB_PASSWORD=your_db_password_here

# JWT
JWT_SECRET=your_long_random_secret_here
JWT_EXPIRES=2h

# Server
PORT=4000
FRONTEND_URL=http://localhost:5173

# AI
GROQ_API_KEY=your_groq_api_key_here
```

### Running the App

#### 1. Start the Backend

```bash
cd backend
npm install
npm start
```

#### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## API Reference

*(See full endpoint documentation in the source `routes` and `controllers` directories.)*

- **Auth Endpoints:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- **Geo Endpoints:** `GET /api/geo/earthquakes`, `GET /api/geo/countries`
- **AI Endpoints:** `POST /api/ai/index`, `POST /api/ai/query`
- **Health Check:** `GET /health` (Verifies DB connectivity)

---

## Frontend Deep-Dive

### GlobeEngine
The core engine rendered via Three.js. Includes photorealistic textures, dynamic data layering, and an interactive raycaster for clicking on 3D objects to retrieve metadata.

### Data Layers
The layers represent external data sources. The frontend fetches data via the proxy backend, parses GeoJSON/JSON, and renders `THREE.Mesh` objects mapped to geographic coordinates (`lat/lng` mapped to spherical coordinates).

### Auth Modal & Hook
Authentication utilizes `hooks/useAuth.js` which manages global app state and triggers automatic re-renders for authorized components (like the AI panel and layers). Cookies are handled securely by the backend (`HttpOnly`, `SameSite`).

---

## Backend Deep-Dive

### Geo Proxy Caching
Instead of fetching massive datasets (USGS, REST Countries) directly from the browser, the frontend requests them from the backend. `backend/src/services/geo.service.js` caches these results in-memory with a 5-minute (USGS) and 24-hour (Countries) TTL.

### Advanced RAG AI System
The RAG pipeline is implemented as a multi-stage graph retrieval process.

#### 1. Indexing (`POST /api/ai/index`)
- Earthquakes are preprocessed into human-readable text.
- Text is embedded using the local HuggingFace `@xenova/transformers` pipeline (`all-MiniLM-L6-v2`, 384 dimensions).
- Points are saved in PostgreSQL as `rag_chunks`.
- The `graph.service.js` constructs semantic edges (`rag_edges`) between chunks:
  - **Temporal clustering**: Events occurring within 7 days of each other.
  - **Same Region**: Events occurring in the same parsed string region.
  - **Magnitude similarity**: Events with similar destructive power.

#### 2. Retrieval (`POST /api/ai/query`)
- **Stage 1: Vector Search** — Uses a JavaScript in-memory fallback cosine similarity algorithm to find semantically matching chunks.
- **Stage 2: Full-Text Search** — Uses `pg_trgm` and `plainto_tsquery` to find exact keyword matches.
- **Stage 3: Graph Expansion** — Looks at the `rag_edges` table to find related nodes connected to the top 5 Stage 1 results.
- **Fusion** — Results are combined and scored using **Reciprocal Rank Fusion**.
- **Generation** — Context is passed to Groq (`openai/gpt-oss-20b`) to formulate the final answer and flag relevant markers for the frontend GlobeEngine to highlight.

---

## Known Limitations & Roadmap

- **Vector Search Performance:** Due to local environment limitations without `pgvector`, vector cosine similarity is currently computed in Node.js instead of native SQL. In a true production setting, `pgvector` should be installed and `ivfflat` indices restored.
- **No HTTPS:** Dev setup only; production needs TLS.

---

## License

This project is private and not currently licensed for redistribution. Contact the repository owner for usage permissions.

---

*Built with ❤️ using React, Three.js, Express, PostgreSQL, Xenova, and Groq.*