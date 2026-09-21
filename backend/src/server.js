import env from './config/env.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import db from './config/db.js'
import requireAuth from './middleware/auth.js'
import { authLimiter, aiLimiter } from './middleware/rateLimiter.js'
import aiRoutes from './routes/ai.routes.js'
import geoRoutes from './routes/geo.routes.js'
import errorHandler from './middleware/errorHandler.js'

console.log('GEMINI KEY:', env.GEMINI_API_KEY?.slice(0, 10) + '...')

const app = express()

// Test DB connection on startup
db.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch(err => console.error('❌ DB connection failed:', err.message))

// ── Middleware ───────────────────────────────────────────────
app.use(helmet())
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// ══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════

app.use('/api/auth', authLimiter)

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
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES }
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

    res.cookie('tv3d_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000
    })

    return res.json({
      success: true,
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
    res.clearCookie('tv3d_token')
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
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1')
    res.status(200).json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() })
  } catch (error) {
    res.status(503).json({ status: 'degraded', db: 'unreachable', timestamp: new Date().toISOString() })
  }
})
// ── AI Routes ─────────────────────────────────────────────────

app.use('/api/ai', aiLimiter)
app.use('/api/ai', aiRoutes)

// ── Geo Routes ────────────────────────────────────────────────
app.use('/api/geo', geoRoutes)

app.use(errorHandler)

// ── Start server ──────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`🚀 Backend running → http://localhost:${env.PORT}`)
  console.log(`📡 DB host → ${env.DB_HOST || 'localhost'}`)
  console.log(`🌍 Node env → ${process.env.NODE_ENV || 'development'}`)
  console.log(`🧠 RAG system: pgvector + graph indexing`)
})