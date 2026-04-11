import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import dotenv from 'dotenv'
import { ragQuery, indexDataPoints } from './ragAgent.js'

dotenv.config()
console.log('GEMINI KEY:', process.env.GEMINI_API_KEY?.slice(0, 10) + '...')

const app = express()
const { Pool } = pg

// ── Database connection ──────────────────────────────────────
const db = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

// Test DB connection on startup
db.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch(err => console.error('❌ DB connection failed:', err.message))

// ── Middleware ───────────────────────────────────────────────
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '10mb' }))

// ── Auth middleware (protects routes that need login) ────────
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.userId   = payload.userId
    req.userRole = payload.role
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════

// ── REGISTER ─────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body

  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    // Check if user already exists
    const existing = await db.query(
      'SELECT user_id FROM users WHERE email=$1 OR username=$2',
      [email, username]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already taken' })
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12)

    // Insert new user
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'USER')
       RETURNING user_id, username, email, role`,
      [username, email, passwordHash]
    )

    const user = result.rows[0]
    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: { userId: user.user_id, username: user.username, email: user.email, role: user.role }
    })

  } catch (err) {
    console.error('Register error:', err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── LOGIN ─────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }

  try {
    // Find user by username or email
    const result = await db.query(
      'SELECT * FROM users WHERE email=$1 OR username=$1',
      [username]
    )
    const user = result.rows[0]

    // User not found
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({
        error: `Account locked. Try again after ${new Date(user.locked_until).toLocaleTimeString()}`
      })
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatch) {
      // Increment failed attempts
      const newAttempts = user.failed_attempts + 1
      const lockUntil   = newAttempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000) // lock for 15 mins
        : null

      await db.query(
        'UPDATE users SET failed_attempts=$1, locked_until=$2 WHERE user_id=$3',
        [newAttempts, lockUntil, user.user_id]
      )

      // Log failed attempt
      await db.query(
        'INSERT INTO audit_logs (user_id, event_type, metadata) VALUES ($1, $2, $3)',
        [user.user_id, 'LOGIN_FAIL', JSON.stringify({ attempts: newAttempts })]
      )

      if (newAttempts >= 5) {
        return res.status(403).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' })
      }

      return res.status(401).json({
        error: `Invalid password. ${5 - newAttempts} attempts remaining.`
      })
    }

    // ✅ Password correct — reset failed attempts
    await db.query(
      'UPDATE users SET failed_attempts=0, locked_until=NULL, last_login=NOW() WHERE user_id=$1',
      [user.user_id]
    )

    // Generate JWT
    const token     = jwt.sign(
      { userId: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    )
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000)

    // Store token in DB
    const tokenResult = await db.query(
      'INSERT INTO auth_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING token_id',
      [user.user_id, token, expiresAt]
    )

    // Create session
    const sessionResult = await db.query(
      'INSERT INTO sessions (user_id, token_id, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5) RETURNING session_id',
      [user.user_id, tokenResult.rows[0].token_id, expiresAt, req.ip, req.headers['user-agent']]
    )

    // Log success
    await db.query(
      'INSERT INTO audit_logs (user_id, event_type) VALUES ($1, $2)',
      [user.user_id, 'LOGIN_SUCCESS']
    )

    return res.json({
      success: true,
      token,
      expiresAt,
      session: {
        sessionId: sessionResult.rows[0].session_id,
        user: {
          userId:   user.user_id,
          username: user.username,
          email:    user.email,
          role:     user.role,
        }
      }
    })

  } catch (err) {
    console.error('Login error:', err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── LOGOUT ────────────────────────────────────────────────────
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const { sessionId } = req.body
  try {
    // Deactivate session
    const sesResult = await db.query(
      'UPDATE sessions SET is_active=FALSE WHERE session_id=$1 RETURNING token_id, user_id',
      [sessionId]
    )
    if (sesResult.rows[0]) {
      // Revoke token
      await db.query(
        'UPDATE auth_tokens SET revoked=TRUE WHERE token_id=$1',
        [sesResult.rows[0].token_id]
      )
      // Log it
      await db.query(
        'INSERT INTO audit_logs (user_id, event_type) VALUES ($1, $2)',
        [sesResult.rows[0].user_id, 'LOGOUT']
      )
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('Logout error:', err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── GET current user (for page refresh) ──────────────────────
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT user_id, username, email, role, last_login FROM users WHERE user_id=$1',
      [req.userId]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' })
    const u = result.rows[0]
    return res.json({
      userId: u.user_id, username: u.username,
      email: u.email,   role: u.role
    })
  } catch (err) {
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'TerraViz backend is alive', time: new Date() })
})
// ── AI Routes ─────────────────────────────────────────────────

// Index earthquake data for RAG
app.post('/api/ai/index', requireAuth, async (req, res) => {
  console.log('[AI] /api/ai/index called, body size:', JSON.stringify(req.body).length, 'bytes')
  const { dataPoints } = req.body
  if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
    console.error('[AI] No dataPoints in body. Keys:', Object.keys(req.body || {}))
    return res.status(400).json({ error: 'dataPoints array required' })
  }
  try {
    await indexDataPoints(dataPoints)
    res.json({ success: true, message: `Indexed ${dataPoints.length} points` })
  } catch (err) {
    console.error('[AI] Index error:', err.message)
    res.status(500).json({ error: 'Indexing failed' })
  }
})
// Query the RAG agent
app.post('/api/ai/query', requireAuth, async (req, res) => {
  const { query, layerContext } = req.body
  if (!query?.trim()) {
    return res.status(400).json({ error: 'Query is required' })
  }
  try {
    const result = await ragQuery(query, layerContext)
    return res.json(result)
  } catch (err) {
    console.error('[AI] Query error:', err.message)
    return res.status(500).json({
      error: 'AI unavailable',
      answer: 'Sorry, I could not process your request right now.',
      markers: []
    })
  }
})


// ── Start server ──────────────────────────────────────────────
app.listen(process.env.PORT, () => {
  console.log(`🚀 Backend running → http://localhost:${process.env.PORT}`)
})