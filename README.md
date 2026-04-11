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
  - [RAG AI Agent](#rag-ai-agent)
- [Security Model](#security-model)
- [External Data Sources](#external-data-sources)
- [Known Limitations & Roadmap](#known-limitations--roadmap)

---

## Overview

TerraViz 3D is a full-stack geospatial intelligence platform. It renders a photorealistic, interactive 3D Earth in the browser using Three.js, overlays live scientific datasets as 3D visualizations, and connects to a Node.js/Express backend that handles authentication, session management, and an AI-powered natural-language query engine.

Users can:
- Rotate, zoom, and interact with a WebGL-rendered globe
- Toggle live earthquake and world population data layers
- Click any marker to inspect rich metadata
- Ask an AI assistant questions like *"Show me earthquakes in Japan"* — the AI highlights matching events directly on the globe

---

## Features

| Feature | Description |
|---|---|
| 🌐 **3D Globe** | Photorealistic Earth with custom atmosphere shaders, bump-mapped terrain, and an 8,000-point star field |
| 🔴 **Earthquake Layer** | Live USGS M4.5+ earthquake feed for the past 30 days, rendered as glowing magnitude-scaled cylinders |
| 🔵 **Population Layer** | REST Countries API data for 195+ countries, rendered as teal pillars scaled logarithmically to population |
| 🤖 **AI Assistant** | Natural-language interface powered by Groq (LLaMA 3.1 8B) with keyword-based RAG retrieval — highlights matching data directly on the globe |
| 🔐 **Auth System** | Full JWT-based authentication with bcrypt hashing, brute-force lockout (5 attempts → 15-min lock), session tracking, and audit logging |
| 🎨 **Premium UI** | Dark sci-fi aesthetic with Orbitron/Inter/JetBrains Mono fonts, glassmorphism panels, scan-line overlays, twinkling star backgrounds, and micro-animations |
| 🧭 **Guest Mode** | Unauthenticated browsing allowed; data layers and AI require sign-in |

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI components & state management |
| Three.js | 0.183 | WebGL 3D rendering engine |
| Vite | 8 | Dev server & build tool |
| TailwindCSS | 3.4 | Utility CSS (minimal use) |
| Google Fonts | — | Orbitron, Inter, JetBrains Mono |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js + Express | 4.18 | REST API server |
| PostgreSQL (`pg`) | 8.11 | User/session/token persistence |
| bcryptjs | 2.4 | Password hashing (cost factor 12) |
| jsonwebtoken | 9.0 | JWT generation & verification |
| Helmet | 7.0 | HTTP security headers |
| Groq SDK | 1.1 | LLM inference (LLaMA 3.1 8B) |
| dotenv | 16 | Environment variable loading |
| nodemon | 3.0 | Dev auto-restart |

### External APIs
| API | Purpose |
|---|---|
| USGS Earthquake Feed | Live M4.5+ seismic events (GeoJSON) |
| REST Countries v3.1 | Population, capital, region per country |
| Groq Cloud | Fast LLM inference for the AI assistant |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React + Three.js)                  │
│                                                                     │
│  ┌──────────────┐   ┌──────────────────┐   ┌──────────────────────┐│
│  │  GlobeEngine │   │  App.jsx (state) │   │   AIChatPanel        ││
│  │  (Three.js)  │◄──│  layerOn         │   │   RAG queries        ││
│  │              │   │  popLayerOn      │   │   Marker highlights  ││
│  │  - Globe     │   │  user/session    │   └──────────────────────┘│
│  │  - Atm. shdr │   │  showAI          │                            │
│  │  - Starfield │   └────────┬─────────┘                            │
│  │  - Layers    │            │ fetch('/api/...')                     │
│  └──────────────┘            │                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │ Vite proxy → localhost:4000
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Express Backend (port 4000)                     │
│                                                                     │
│  ┌──────────────────┐   ┌────────────────────────────────────────┐  │
│  │   Auth Routes    │   │           RAG Agent                    │  │
│  │  POST /register  │   │  indexDataPoints() → in-memory store   │  │
│  │  POST /login     │   │  ragQuery() → keyword retrieval        │  │
│  │  POST /logout    │   │             → Groq LLM (1 API call)    │  │
│  │  GET  /me        │   └────────────────────────────────────────┘  │
│  └────────┬─────────┘                                               │
│           │                                                         │
│  ┌────────▼──────────┐                                              │
│  │   PostgreSQL      │                                              │
│  │   users           │                                              │
│  │   auth_tokens     │                                              │
│  │   sessions        │                                              │
│  │   audit_logs      │                                              │
│  └───────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Key design choices:**
- Vite's dev-server proxy (`/api` → `localhost:4000`) eliminates CORS in development
- The RAG agent uses **zero-embedding, zero-API-call retrieval** (keyword scoring) — only one Groq call per user query keeps latency low and costs near-zero
- All Three.js layer groups are named and managed independently, so multiple data sets can coexist on the globe simultaneously

---

## Project Structure

```
Terraviz3D/
├── backend/
│   ├── src/
│   │   ├── server.js        # Express app, all routes, DB pool, JWT middleware
│   │   └── ragAgent.js      # In-memory RAG store + Groq LLM integration
│   ├── package.json
│   └── .env                 # Backend environment variables (see below)
│
└── frontend/
    ├── public/
    │   ├── textures/
    │   │   ├── earth_day.jpg    # Diffuse Earth texture (PhongMaterial map)
    │   │   └── earth_bump.jpg   # Bump map for terrain relief
    │   ├── favicon.svg
    │   └── icons.svg
    ├── src/
    │   ├── components/
    │   │   ├── GlobeEngine.js   # Three.js engine class (globe, layers, events)
    │   │   └── AIChatpanel.jsx  # Draggable AI chat UI component
    │   ├── App.jsx              # Root component: state, data fetching, layout
    │   ├── App.css              # Keyframe animations (twinkle, pulse, scan, etc.)
    │   ├── index.css            # CSS reset / base styles
    │   └── main.jsx             # React 19 entry point
    ├── index.html               # HTML shell + Google Fonts preload
    ├── vite.config.js           # Vite config + dev proxy
    └── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **PostgreSQL** ≥ 14 (running locally or remotely)
- A **Groq API key** (free tier at [console.groq.com](https://console.groq.com))

### Database Setup

Connect to PostgreSQL and run the following schema (the backend expects these tables):

```sql
CREATE TABLE users (
  user_id        SERIAL PRIMARY KEY,
  username       VARCHAR(50) UNIQUE NOT NULL,
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role           VARCHAR(20) DEFAULT 'USER',
  failed_attempts INTEGER DEFAULT 0,
  locked_until   TIMESTAMPTZ,
  last_login     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth_tokens (
  token_id    SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(user_id),
  token       TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  session_id  SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(user_id),
  token_id    INTEGER REFERENCES auth_tokens(token_id),
  expires_at  TIMESTAMPTZ NOT NULL,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  log_id      SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(user_id),
  event_type  VARCHAR(50) NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Environment Variables

Create `backend/.env` with the following (never commit this file):

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

> ⚠️ **Security:** The `JWT_SECRET` in the example `.env` is a placeholder. Generate a strong random secret for any deployment: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### Running the App

#### 1. Start the Backend

```bash
cd backend
npm install
npm run dev
# → Backend running → http://localhost:4000
# → PostgreSQL connected ✅
```

#### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
# → Vite dev server → http://localhost:5173
```

Open **http://localhost:5173** in your browser.

#### Production Build

```bash
cd frontend
npm run build      # outputs to frontend/dist/
npm run preview    # preview the production build locally
```

---

## API Reference

All endpoints are served at `http://localhost:4000`. The frontend proxies `/api/*` via Vite automatically in development.

### Auth Endpoints

#### `POST /api/auth/register`
Create a new account.

**Request body:**
```json
{ "username": "alice", "email": "alice@example.com", "password": "secret123" }
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "user": { "userId": 1, "username": "alice", "email": "alice@example.com", "role": "USER" }
}
```

**Errors:** `400` field missing / password too short, `409` username or email taken.

---

#### `POST /api/auth/login`
Authenticate and receive a JWT.

**Request body:**
```json
{ "username": "alice", "password": "secret123" }
```

**Response (200):**
```json
{
  "success": true,
  "token": "<JWT>",
  "expiresAt": "2026-04-12T04:00:00.000Z",
  "session": {
    "sessionId": 42,
    "user": { "userId": 1, "username": "alice", "email": "alice@example.com", "role": "USER" }
  }
}
```

**Brute-force protection:** After 5 consecutive failed attempts the account is locked for 15 minutes. Each failure response includes remaining attempts.

---

#### `POST /api/auth/logout` *(auth required)*
Revoke the current session and token.

**Request body:**
```json
{ "sessionId": 42 }
```

**Headers:** `Authorization: Bearer <token>`

---

#### `GET /api/auth/me` *(auth required)*
Return the currently authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{ "userId": 1, "username": "alice", "email": "alice@example.com", "role": "USER" }
```

---

### AI Endpoints

All AI endpoints require authentication (`Authorization: Bearer <token>`).

#### `POST /api/ai/index` *(auth required)*
Push the current earthquake dataset into the in-memory RAG store. **Must be called after loading earthquake data**, before querying the AI.

**Request body:**
```json
{
  "dataPoints": [
    { "lat": 35.68, "lng": 139.69, "magnitude": 5.2, "category": "earthquake",
      "metadata": { "place": "Tokyo, Japan", "time": 1712850000000 } }
  ]
}
```

**Response:**
```json
{ "success": true, "message": "Indexed 847 points" }
```

---

#### `POST /api/ai/query` *(auth required)*
Ask a natural-language question about the indexed earthquake data.

**Request body:**
```json
{ "query": "Show earthquakes in Japan", "layerContext": "earthquakes" }
```

**Response:**
```json
{
  "answer": "There are several significant earthquakes near Japan...",
  "sources": ["Magnitude 5.2 earthquake near Tokyo, Japan on Mon Apr 12...", "..."],
  "markers": [
    { "lat": 35.68, "lng": 139.69, "magnitude": 5.2, "category": "earthquake", "metadata": {...} }
  ]
}
```

- `answer` — LLM-generated natural language response (Groq, LLaMA 3.1 8B)
- `sources` — Up to 8 matching data point excerpts used as context
- `markers` — Data points to highlight on the globe (only populated when the query contains show/display/find intent keywords)

---

#### `GET /health`
Simple health check, no auth required.

```json
{ "status": "TerraViz backend is alive", "time": "2026-04-12T00:00:00.000Z" }
```

---

## Frontend Deep-Dive

### GlobeEngine

`frontend/src/components/GlobeEngine.js` is a self-contained class that wraps Three.js:

| Method | Description |
|---|---|
| `constructor(canvas, onMarkerClick)` | Initializes renderer, camera, scene, lights, globe, atmosphere, starfield, and event listeners |
| `buildGlobe()` | Creates a 96-segment `SphereGeometry` with `earth_day.jpg` diffuse + `earth_bump.jpg` bump mapping |
| `buildAtmosphere()` | Two-layer atmosphere using custom GLSL shaders — inner Fresnel glow + outer halo using additive blending |
| `buildStarfield()` | 8,000-point `BufferGeometry` with randomized positions, sizes, and color temperatures |
| `renderMarkers(dataPoints, type)` | Clears + re-renders the `earthquakes` layer as glowing cylinders; marker height & color are magnitude-scaled |
| `renderPopulationMarkers(dataPoints)` | Renders the `population` layer as teal pillars; height is scaled using `log10(population)` normalized to `[4, 9.2]` |
| `clearMarkers(layerName?)` | Clears a named layer, or all layers if no name given |
| `_syncLayerRotations()` | Keeps all data layer groups' rotation in sync with the globe during drag |
| `dispose()` | Cancels the animation loop and disposes the WebGL renderer |

**GPU note:** The renderer is initialized with `powerPreference: 'high-performance'` to prefer the dedicated GPU, and logs the detected GPU name to the console on startup.

**Layer system:** Each data type (earthquakes, population) lives in its own named `THREE.Group` (`layerGroups`). This allows independent clearing and simultaneous display of multiple datasets. Raycasting for click-to-inspect uses a union of all layer children.

**Auto-rotate:** The globe slowly auto-rotates on the Y axis (`+0.0005 rad/frame`). Dragging disables auto-rotate; it re-enables 3 seconds after releasing the mouse.

**Controls:**

| Interaction | Action |
|---|---|
| Drag | Rotate globe (clamped X axis to ±90°) |
| Scroll | Zoom (camera Z: 1.2 → 4.0) |
| Click marker | Opens `InfoPanel` with metadata |

---

### Data Layers

#### Earthquake Layer
- **Source:** `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson`
- **Filter:** M4.5+ events from the past 30 days
- **Visual:** Per-marker glowing cylinder (core + outer glow + tip sphere + base ring)
- **Color:** HSL gradient — blue (low magnitude) → red (high magnitude)
- **Height:** `0.12 + norm * 0.55` Three.js units, where `norm = magnitude / 10`
- **After load:** Earthquake data is automatically push-indexed to the backend for AI querying

#### Population Layer
- **Source:** `https://restcountries.com/v3.1/all?fields=name,population,latlng,capital,region`
- **Filter:** Countries with population > 10,000 and valid lat/lng
- **Visual:** Teal hexagonal pillar (core + outer glow + flat cap + base ring)
- **Height:** Logarithmically scaled: `log10(pop)` normalized between `[4, 9.2]` (10K to ~1.6B)
- **Toggle:** Population layer can be toggled on/off independently; clicking again while active clears it

---

### AI Chat Panel

`frontend/src/components/AIChatpanel.jsx` — A **draggable**, floating chat panel:

- Positioned top-right by default (`window.innerWidth - 340 - 32, 120`)
- Draggable via pointer capture (`onPointerDown` → `setPointerCapture`)
- **Example chips** shown on first open (disappear after first message)
- Messages rendered in a bubble-chat layout (user: right/blue, AI: left/purple)
- "ANALYSING…" pulsing indicator while waiting for response
- **Marker integration:** If the AI response includes `markers[]`, they are rendered on the globe immediately via the `onMarkersReceived` callback, and the earthquake layer state is updated
- Sources counter: shows how many data points were retrieved for the answer

---

### Auth Modal

`App.jsx → AuthModal` — Glassmorphism overlay modal:

- Two modes: **Login** and **Register** (toggle without full re-render)
- Stores `tv3d_token` (JWT) and `tv3d_session` (user + session ID) in `localStorage`
- Session is re-hydrated on page load in `useEffect`
- **Guest mode:** "Continue as guest" dismisses the modal without logging in; data layers prompt sign-in when accessed without a token

---

## Backend Deep-Dive

### Auth System

The authentication system (`backend/src/server.js`) implements a secure, production-aware flow:

```
Register → bcrypt hash (cost 12) → store in DB
Login    → bcrypt.compare → generate JWT (2h TTL) → store token in auth_tokens
         → create session in sessions (with IP + user-agent)
         → log to audit_logs
Logout   → deactivate session → revoke token → log to audit_logs
/me      → JWT verify → return user profile
```

**Brute-force lockout logic:**
```
Failed attempt N:
  - Increment users.failed_attempts
  - If N >= 5: set locked_until = NOW() + 15 minutes
  - Log LOGIN_FAIL to audit_logs
Successful login:
  - Reset failed_attempts = 0, locked_until = NULL
  - Update last_login = NOW()
  - Log LOGIN_SUCCESS to audit_logs
```

**JWT middleware (`requireAuth`):** Validates `Authorization: Bearer <token>` header, decodes the payload, and attaches `req.userId` and `req.userRole` for downstream handlers.

---

### RAG AI Agent

`backend/src/ragAgent.js` implements a lightweight Retrieval-Augmented Generation pipeline:

#### Step 1 — Indexing (instant, zero API calls)
```
indexDataPoints(dataPoints)
  → Convert each point to human-readable text:
    "Magnitude 5.2 earthquake near Tokyo, Japan on Mon Apr 12 at 35.68, 139.69"
  → Store in module-level in-memory array (dataStore)
```

#### Step 2 — Retrieval (keyword scoring, zero API calls)
```
retrieve(query, k=8)
  → Strip stop words (show, find, where, earthquakes, etc.)
  → Extract meaningful keywords (length > 2)
  → Score each stored entry:
      +3 per keyword match in text
      +magnitude * 0.8 if query asks for "strong/big/large/major"
      +magnitude * 0.05 always (slight quality boost)
  → Return top-k entries sorted by score
```

#### Step 3 — Generation (1 Groq API call)
```
ragQuery(query, layerContext)
  → Build context string from retrieved entries
  → Detect "show intent" (show/display/mark/highlight/find/locate)
  → Single chat completion via Groq:
      Model:       llama-3.1-8b-instant
      Max tokens:  300
      Temperature: 0.4
  → Return { answer, sources, markers }
      markers only populated if show intent detected
```

**Why this approach?**
- No vector database required — entire implementation is ~116 lines of JS
- No embedding API calls — reduces latency and cost dramatically
- One Groq call per user query — predictable cost, fast response (usually < 1s)
- In-memory store resets on server restart (acceptable for a demo/prototype)

---

## Security Model

| Concern | Implementation |
|---|---|
| Password storage | bcrypt, cost factor 12 |
| Token expiry | JWT TTL 2h; tokens stored + revokable in DB |
| Brute force | 5 attempts → 15-min account lock, logged to audit_logs |
| HTTP headers | `helmet()` middleware (CSP, HSTS, X-Frame-Options, etc.) |
| CORS | Restricted to `FRONTEND_URL` env var only |
| Request size | JSON body limit capped at 10 MB |
| API protection | All AI and data-write endpoints require valid JWT |

> ⚠️ **Before deploying to production:**
> - Rotate `JWT_SECRET` to a cryptographically random value
> - Rotate the `GROQ_API_KEY` (do not commit `.env` to version control)
> - Change the database password
> - Set `FRONTEND_URL` to your production domain
> - Consider adding HTTPS/TLS termination (e.g. via nginx or a cloud load balancer)

---

## External Data Sources

| Source | URL | Update Frequency | Notes |
|---|---|---|---|
| USGS Earthquake Feed | `earthquake.usgs.gov` | Real-time | GeoJSON, M4.5+, past 30 days |
| REST Countries | `restcountries.com/v3.1` | Static | 195+ countries, population + location |
| Groq LLM | `api.groq.com` | On-demand | LLaMA 3.1-8B-Instant, free tier available |

---

## Known Limitations & Roadmap

### Current Limitations
- **In-memory RAG store** — Earthquake index is lost on backend restart; population data is not indexed for AI
- **No real embeddings** — Retrieval is keyword-based, not semantic; queries must use location names that appear in USGS place strings
- **Single server instance** — No horizontal scaling; in-memory store is not shared
- **No HTTPS** — Dev setup only; production needs TLS

### Potential Improvements
- [ ] Add semantic vector embeddings (pgvector + OpenAI/Voyage) for better RAG retrieval
- [ ] Persist indexed data in PostgreSQL for cross-restart continuity
- [ ] Add population layer to RAG index
- [ ] WebSocket live feed for real-time earthquake updates
- [ ] User-defined custom data layer upload (CSV/GeoJSON)
- [ ] Touch/mobile support for the globe (pinch-zoom, touch-drag)
- [ ] Export visible data as CSV/GeoJSON
- [ ] Admin dashboard for user management and audit log review

---

## License

This project is private and not currently licensed for redistribution. Contact the repository owner for usage permissions.

---

*Built with ❤️ using React, Three.js, Express, PostgreSQL, and Groq.*