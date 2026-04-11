import { useEffect, useRef, useState } from 'react'
import { GlobeEngine } from './components/GlobeEngine'
import AIChatPanel from './components/AIChatpanel'
import './App.css'

// ── Twinkling stars background ───────────────────────────────
function Stars() {
  const layers = [
    { count: 80, size: [1.5, 2.5], speed: 5 },
    { count: 140, size: [1, 1.8], speed: 7 },
    { count: 200, size: [0.5, 1.2], speed: 9 },
  ]

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      pointerEvents: 'none', zIndex: 0,
      background: 'radial-gradient(ellipse at 60% 80%, #030710 0%, #000000 100%)',
    }}>
      {layers.map((layer, layerIndex) =>
        Array.from({ length: layer.count }).map((_, i) => {
          const size = Math.random() * (layer.size[1] - layer.size[0]) + layer.size[0]
          const colors = ['#ffffff', '#c8deff', '#89b4f0', '#aac4ff']
          const color = colors[Math.floor(Math.random() * colors.length)]
          return (
            <div
              key={`${layerIndex}-${i}`}
              style={{
                position: 'absolute',
                width: size, height: size,
                left: Math.random() * 100 + '%',
                top: Math.random() * 100 + '%',
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 ${size * 2.5}px ${color}`,
                opacity: Math.random() * 0.6 + 0.2,
                animation: `twinkle ${layer.speed + Math.random() * 3}s infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          )
        })
      )}
    </div>
  )
}

// ── Auth Modal ───────────────────────────────────────────────
function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const submit = async () => {
    setError('')
    if (!form.username || !form.password) { setError('All fields are required'); return }
    if (mode === 'register' && !form.email) { setError('Email is required'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }

    setLoading(true)
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = mode === 'login'
        ? { username: form.username, password: form.password }
        : { username: form.username, email: form.email, password: form.password }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) { setError(data.error || 'Something went wrong'); return }

      if (mode === 'register') {
        setMode('login')
        setError('')
        setForm(f => ({ ...f, password: '' }))
        alert('Account created! Please log in.')
        return
      }

      localStorage.setItem('tv3d_token', data.token)
      localStorage.setItem('tv3d_session', JSON.stringify(data.session))
      onSuccess(data.session.user, data.session.sessionId)
      onClose()
    } catch {
      setError('Cannot connect to server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    padding: '13px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(99,179,255,0.12)',
    borderRadius: 12, color: '#e2e8f0',
    fontSize: 14, outline: 'none',
    fontFamily: "'Inter', sans-serif",
    transition: 'all 0.25s ease',
    width: '100%',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        width: 380, padding: '44px 36px',
        background: 'linear-gradient(160deg, #0a1628 0%, #060d1c 100%)',
        border: '1px solid rgba(99,179,255,0.15)',
        borderRadius: 24,
        display: 'flex', flexDirection: 'column', gap: 16,
        color: '#e2e8f0', position: 'relative', overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(59,130,246,0.08)',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* top glow */}
        <div style={{
          position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.5),transparent)'
        }} />

        <div style={{ textAlign: 'center', fontFamily: "'Orbitron',monospace", fontSize: 10, color: '#3b82f6', letterSpacing: '0.2em', fontWeight: 600 }}>
          TERRAVIZ 3D
        </div>
        <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: '#475569', marginBottom: 4 }}>
          {mode === 'login' ? 'Access geospatial intelligence layers' : 'Join TerraViz 3D'}
        </div>

        <input placeholder="Username" value={form.username}
          onChange={e => update('username', e.target.value)} style={inputStyle}
        />
        {mode === 'register' && (
          <input placeholder="Email address" type="email" value={form.email}
            onChange={e => update('email', e.target.value)} style={inputStyle}
          />
        )}
        <input placeholder="Password" type="password" value={form.password}
          onChange={e => update('password', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} style={inputStyle}
        />

        {error && (
          <div style={{
            color: '#f87171', fontSize: 12, textAlign: 'center',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 10, padding: '10px 14px',
          }}>
            ⚠ {error}
          </div>
        )}

        <button onClick={submit} disabled={loading} style={{
          padding: 14, marginTop: 4,
          background: loading
            ? 'rgba(59,130,246,0.3)'
            : 'linear-gradient(135deg, #3b82f6, #2563eb)',
          border: 'none', borderRadius: 12,
          color: '#fff', fontSize: 13, fontWeight: 600,
          fontFamily: "'Orbitron',monospace", letterSpacing: '0.08em',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.25s',
          boxShadow: loading ? 'none' : '0 4px 20px rgba(59,130,246,0.3)',
        }}>
          {loading ? 'AUTHENTICATING...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#475569' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already a member? '}
          <span
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{ color: '#60a5fa', cursor: 'pointer', fontWeight: 500 }}
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </span>
        </div>

        <div onClick={onClose} style={{
          textAlign: 'center', fontSize: 12, color: '#334155',
          cursor: 'pointer', transition: 'color 0.2s',
        }}>
          Continue as guest
        </div>
      </div>
    </div>
  )
}

// ── Info Panel ───────────────────────────────────────────────
function InfoPanel({ data, onClose }) {
  if (!data) return null

  const isPop = data.category === 'population'

  const panelBase = {
    position: 'absolute', bottom: 32, right: 32,
    width: 300,
    background: 'linear-gradient(160deg, #080f24 0%, #040a16 100%)',
    backdropFilter: 'blur(24px)',
    borderRadius: 18, padding: '22px 22px',
    zIndex: 20, fontFamily: "'Inter', sans-serif",
    color: '#e2e8f0',
    animation: 'slideUp 0.3s ease',
    overflow: 'hidden',
    boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
  }

  const closeBtn = (
    <button onClick={onClose} style={{
      position: 'absolute', top: 14, right: 16,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8, width: 28, height: 28,
      color: '#475569', cursor: 'pointer', fontSize: 13,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.2s',
    }}>✕</button>
  )

  if (isPop) {
    const pop = data.metadata?.population ?? 0
    const formatted = pop >= 1e9
      ? (pop / 1e9).toFixed(2) + 'B'
      : pop >= 1e6
        ? (pop / 1e6).toFixed(1) + 'M'
        : pop.toLocaleString()

    return (
      <div style={{ ...panelBase, border: '1px solid rgba(6,182,212,0.15)' }}>
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(6,182,212,0.4),transparent)'
        }} />
        {closeBtn}

        <div style={{
          fontSize: 9, color: '#06b6d4', fontWeight: 600,
          fontFamily: "var(--font-display)", letterSpacing: '0.2em', marginBottom: 10,
        }}>
          POPULATION DATA
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.1, marginBottom: 6 }}>
          {data.metadata?.name || 'Unknown'}
        </div>

        <div style={{
          fontSize: 36, fontWeight: 800, color: '#06b6d4',
          fontFamily: "var(--font-display)", lineHeight: 1, marginBottom: 10,
        }}>
          {formatted}
        </div>

        <div style={{
          fontSize: 11, color: '#475569', marginBottom: 12,
          fontFamily: "var(--font-mono)", letterSpacing: '0.04em',
        }}>
          {data.lat?.toFixed(2)}° {data.lat > 0 ? 'N' : 'S'} &nbsp;
          {data.lng?.toFixed(2)}° {data.lng > 0 ? 'E' : 'W'}
        </div>

        {data.metadata?.capital && (
          <div style={{
            fontSize: 13, marginBottom: 8, padding: '10px 12px',
            background: 'rgba(6,182,212,0.05)',
            borderRadius: 10, borderLeft: '3px solid #06b6d4',
          }}>
            <span style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 2 }}>Capital</span>
            {data.metadata.capital}
          </div>
        )}

        {data.metadata?.region && (
          <div style={{
            fontSize: 11, color: '#155e75',
            fontFamily: "var(--font-mono)",
            background: 'rgba(6,182,212,0.04)',
            padding: '6px 10px', borderRadius: 6,
            display: 'inline-block',
          }}>
            {data.metadata.region}
          </div>
        )}
      </div>
    )
  }

  // ── Earthquake info ──────────────────────────────────────────
  const mag = data.magnitude?.toFixed(1)
  const color = data.magnitude > 6 ? '#ef4444' : data.magnitude > 4 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ ...panelBase, border: `1px solid ${color}22` }}>
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
        background: `linear-gradient(90deg,transparent,${color}55,transparent)`
      }} />
      {closeBtn}

      <div style={{
        fontSize: 9, color: color, fontWeight: 600,
        fontFamily: "var(--font-display)", letterSpacing: '0.2em', marginBottom: 10,
      }}>
        SEISMIC EVENT
      </div>

      <div style={{
        fontSize: 44, fontWeight: 800, color, lineHeight: 1, marginBottom: 6,
        fontFamily: "var(--font-display)",
      }}>
        M{mag}
      </div>

      <div style={{
        fontSize: 11, color: '#475569', marginBottom: 12,
        fontFamily: "var(--font-mono)", letterSpacing: '0.04em',
      }}>
        {data.lat?.toFixed(3)}° {data.lat > 0 ? 'N' : 'S'} &nbsp;
        {data.lng?.toFixed(3)}° {data.lng > 0 ? 'E' : 'W'}
      </div>

      {data.metadata?.place && (
        <div style={{
          fontSize: 13, marginBottom: 10, padding: '10px 12px',
          background: `${color}08`,
          borderRadius: 10, borderLeft: `3px solid ${color}`,
        }}>
          {data.metadata.place}
        </div>
      )}

      {data.metadata?.time && (
        <div style={{
          fontSize: 11, color: '#1e3a5f',
          fontFamily: "var(--font-mono)",
          background: 'rgba(99,179,255,0.04)',
          padding: '6px 10px', borderRadius: 6,
          display: 'inline-block',
        }}>
          {new Date(data.metadata.time).toUTCString()}
        </div>
      )}
    </div>
  )
}

// ── Layer Toggle Button ──────────────────────────────────────
function LayerButton({ label, active, color, glowColor, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '11px 14px', position: 'relative', zIndex: 1, width: '100%',
      background: active ? `${glowColor}18` : `${glowColor}06`,
      border: `1px solid ${active ? `${glowColor}45` : `${glowColor}15`}`,
      borderRadius: 12,
      color: active ? '#f1f5f9' : color,
      cursor: 'pointer', fontSize: 12, fontWeight: 500,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      fontFamily: "var(--font-body)",
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: active ? color : `${glowColor}40`,
          boxShadow: active ? `0 0 8px ${color}` : 'none',
          transition: 'all 0.3s',
        }} />
        {label}
      </span>
      <span style={{
        fontSize: 8, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
        letterSpacing: '0.12em', fontFamily: "var(--font-display)",
        background: active ? 'rgba(34,197,94,0.15)' : 'rgba(30,41,59,0.6)',
        color: active ? '#4ade80' : '#334155',
        border: `1px solid ${active ? 'rgba(34,197,94,0.25)' : 'rgba(51,65,85,0.3)'}`,
        transition: 'all 0.3s',
      }}>
        {active ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

// ── Sidebar ──────────────────────────────────────────────────
function Sidebar({ user, layerOn, popLayerOn, status, onEarthquakes, onPopulation, onClear, onShowAuth, onLogout, onToggleAI }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, bottom: 0, width: 240,
      background: 'linear-gradient(180deg, #060e22 0%, #040a18 100%)',
      borderRight: '1px solid rgba(99,179,255,0.08)',
      padding: '22px 16px',
      display: 'flex', flexDirection: 'column', gap: 6,
      zIndex: 10, overflow: 'hidden',
      fontFamily: "var(--font-body)",
      animation: 'slideIn 0.3s ease',
    }}>

      {/* Scanlines overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.03) 3px,rgba(0,0,0,0.03) 6px)',
      }} />

      {/* Scanning glow */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 120,
        background: 'linear-gradient(180deg,transparent,rgba(59,130,246,0.03),transparent)',
        animation: 'scan 6s linear infinite', pointerEvents: 'none',
      }} />

      {/* ─── Logo ─────────────────────────────────────────── */}
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700,
        color: '#7dd3fc', letterSpacing: '0.14em',
        paddingBottom: 16, borderBottom: '1px solid rgba(99,179,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 10,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: 9, height: 9, borderRadius: '50%',
          background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
          boxShadow: '0 0 10px #3b82f6, 0 0 20px rgba(59,130,246,0.3)',
          animation: 'pulse 2.5s infinite',
        }} />
        TERRAVIZ 3D
      </div>

      {/* ─── User chip ────────────────────────────────────── */}
      {user ? (
        <div style={{
          padding: '10px 12px', position: 'relative', zIndex: 1,
          background: 'rgba(34,197,94,0.05)',
          border: '1px solid rgba(34,197,94,0.12)',
          borderRadius: 10, fontSize: 12, color: '#4ade80',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 6px #22c55e',
            animation: 'pulse 1.5s infinite',
          }} />
          <span style={{ fontWeight: 500 }}>{user.username}</span>
          <span style={{
            marginLeft: 'auto', fontSize: 8, color: '#166534', fontWeight: 600,
            fontFamily: "var(--font-display)", letterSpacing: '0.1em',
            background: 'rgba(34,197,94,0.08)',
            padding: '2px 6px', borderRadius: 4,
          }}>
            {user.role}
          </span>
        </div>
      ) : (
        <div style={{
          padding: '10px 12px', position: 'relative', zIndex: 1,
          background: 'rgba(99,179,255,0.03)',
          border: '1px solid rgba(99,179,255,0.08)',
          borderRadius: 10, fontSize: 12, color: '#475569',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 14 }}>👤</span> Guest mode
        </div>
      )}

      <div style={{ height: 1, background: 'rgba(99,179,255,0.06)', position: 'relative', zIndex: 1, margin: '4px 0' }} />

      {/* ─── Section: Data Layers ─────────────────────────── */}
      <div style={{
        fontSize: 9, color: '#1e3a5f', letterSpacing: '0.22em', fontWeight: 600,
        fontFamily: "var(--font-display)", marginTop: 4, marginBottom: 2,
        position: 'relative', zIndex: 1,
      }}>
        DATA LAYERS
      </div>

      <LayerButton
        label="Earthquakes" active={layerOn}
        color="#60a5fa" glowColor="rgba(59,130,246)"
        onClick={onEarthquakes}
      />
      <LayerButton
        label="Population" active={popLayerOn}
        color="#22d3ee" glowColor="rgba(6,182,212)"
        onClick={onPopulation}
      />

      {/* Status chip */}
      {status && (
        <div style={{
          fontSize: 10, color: '#3b82f6', padding: '6px 10px',
          fontFamily: "var(--font-mono)", fontWeight: 500,
          position: 'relative', zIndex: 1,
          background: 'rgba(59,130,246,0.04)',
          borderRadius: 6,
          animation: 'fadeIn 0.3s ease',
        }}>
          ◎ {status}
        </div>
      )}

      {/* Clear All */}
      <button onClick={onClear} style={{
        padding: '10px 14px', position: 'relative', zIndex: 1,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 10, color: '#475569',
        cursor: 'pointer', fontSize: 12, textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 0.2s',
      }}>
        <span style={{ fontSize: 10, opacity: 0.6 }}>✕</span> Clear All
      </button>

      <div style={{ height: 1, background: 'rgba(99,179,255,0.06)', position: 'relative', zIndex: 1, margin: '4px 0' }} />

      {/* ─── Section: Tools ───────────────────────────────── */}
      <div style={{
        fontSize: 9, color: '#1e3a5f', letterSpacing: '0.22em', fontWeight: 600,
        fontFamily: "var(--font-display)",
        position: 'relative', zIndex: 1,
      }}>
        TOOLS
      </div>

      {/* AI Assistant */}
      <button onClick={onToggleAI} style={{
        padding: '11px 14px', position: 'relative', zIndex: 1, width: '100%',
        background: 'rgba(139,92,246,0.05)',
        border: '1px solid rgba(139,92,246,0.14)',
        borderRadius: 12, color: '#a78bfa',
        cursor: 'pointer', fontSize: 12, fontWeight: 500,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        transition: 'all 0.25s',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>◈</span>
          AI Assistant
        </span>
        <span style={{
          fontSize: 8, padding: '3px 8px', borderRadius: 4,
          background: 'rgba(139,92,246,0.1)', color: '#7c3aed', fontWeight: 700,
          fontFamily: "var(--font-display)", letterSpacing: '0.1em',
          border: '1px solid rgba(139,92,246,0.15)',
        }}>BETA</span>
      </button>

      <div style={{ height: 1, background: 'rgba(99,179,255,0.06)', position: 'relative', zIndex: 1, margin: '4px 0' }} />

      {/* Auth */}
      {user ? (
        <button onClick={onLogout} style={{
          padding: '10px 14px', position: 'relative', zIndex: 1, width: '100%',
          background: 'rgba(239,68,68,0.04)',
          border: '1px solid rgba(239,68,68,0.1)',
          borderRadius: 10, color: '#f87171',
          cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.2s',
        }}>
          <span style={{ fontSize: 11 }}>↩</span> Sign Out
        </button>
      ) : (
        <button onClick={onShowAuth} style={{
          padding: '12px 14px', position: 'relative', zIndex: 1, width: '100%',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 12, color: '#60a5fa',
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          fontFamily: "var(--font-display)", letterSpacing: '0.08em',
          transition: 'all 0.25s',
        }}>
          SIGN IN
        </button>
      )}

      {/* ─── Keyboard hints ───────────────────────────────── */}
      <div style={{
        marginTop: 'auto', fontSize: 11, color: '#1e3a5f',
        lineHeight: 2.4, borderTop: '1px solid rgba(99,179,255,0.06)',
        paddingTop: 12, position: 'relative', zIndex: 1,
      }}>
        {[['drag', 'Rotate'], ['scroll', 'Zoom'], ['click', 'Details']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: 'rgba(99,179,255,0.04)',
              border: '1px solid rgba(99,179,255,0.08)',
              borderRadius: 5, padding: '1px 7px', fontSize: 9,
              color: '#1e3a5f', fontFamily: "var(--font-display)",
              letterSpacing: '0.06em', fontWeight: 500,
              minWidth: 42, textAlign: 'center',
            }}>{k}</span>
            <span style={{ color: '#334155' }}>{v}</span>
          </div>
        ))}
        {!user && (
          <div style={{
            color: '#92400e', marginTop: 6, fontSize: 9, fontWeight: 600,
            fontFamily: "var(--font-display)", letterSpacing: '0.1em',
            background: 'rgba(245,158,11,0.05)',
            padding: '5px 8px', borderRadius: 6,
            border: '1px solid rgba(245,158,11,0.1)',
          }}>
            ⚠ SIGN IN FOR DATA
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('')
  const [user, setUser] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [layerOn, setLayerOn] = useState(false)
  const [popLayerOn, setPopLayerOn] = useState(false)
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    engineRef.current = new GlobeEngine(canvasRef.current, dp => setSelected(dp))

    const saved = localStorage.getItem('tv3d_session')
    if (saved) {
      try {
        const session = JSON.parse(saved)
        setUser(session.user)
        setSessionId(session.sessionId)
      } catch { localStorage.removeItem('tv3d_session') }
    }
    return () => engineRef.current?.dispose()
  }, [])

  const loadEarthquakes = async () => {
    if (!user) { setShowAuth(true); return }
    setStatus('FETCHING DATA...')
    setLayerOn(true)
    try {
      const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson')
      const json = await res.json()
      const points = json.features.map(f => ({
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        magnitude: f.properties.mag,
        category: 'earthquake',
        metadata: {
          place: f.properties.place,
          time: f.properties.time,
          type: f.properties.type,
          mag: f.properties.mag,
        },
      }))

      engineRef.current?.renderMarkers(points, 'cylinder')
      setStatus(`${points.length} earthquakes loaded`)

      try {
        const token = localStorage.getItem('tv3d_token')
        const indexRes = await fetch('/api/ai/index', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ dataPoints: points })
        })
        const indexData = await indexRes.json()
        if (indexRes.ok) {
          console.log('[AI] ✅ Data indexed:', indexData.message)
        } else {
          console.error('[AI] ❌ Index failed:', indexRes.status, indexData)
        }
      } catch (e) {
        console.warn('[AI] Index request error:', e)
      }

    } catch {
      setStatus('DATA UNAVAILABLE')
      setLayerOn(false)
    }
  }

  const loadPopulation = async () => {
    if (!user) { setShowAuth(true); return }
    if (popLayerOn) {
      engineRef.current?.clearMarkers('population')
      setPopLayerOn(false)
      setStatus(layerOn ? status : '')
      return
    }
    setStatus('FETCHING POPULATION DATA...')
    setPopLayerOn(true)
    try {
      const res = await fetch('https://restcountries.com/v3.1/all?fields=name,population,latlng,capital,region')
      const json = await res.json()
      const points = json
        .filter(c => c.latlng?.length === 2 && c.population > 0)
        .map(c => ({
          lat: c.latlng[0],
          lng: c.latlng[1],
          category: 'population',
          metadata: {
            name: c.name?.common || 'Unknown',
            population: c.population,
            capital: c.capital?.[0] || '',
            region: c.region || '',
          },
        }))

      engineRef.current?.renderPopulationMarkers(points)
      setStatus(`${points.length} countries loaded`)
    } catch {
      setStatus('POPULATION DATA UNAVAILABLE')
      setPopLayerOn(false)
    }
  }

  const clearLayer = () => {
    engineRef.current?.clearMarkers()
    setStatus(''); setLayerOn(false); setPopLayerOn(false); setSelected(null)
  }

  const logout = async () => {
    const token = localStorage.getItem('tv3d_token')
    if (token && sessionId) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sessionId })
      })
    }
    localStorage.removeItem('tv3d_token')
    localStorage.removeItem('tv3d_session')
    setUser(null); setSessionId(null); clearLayer()
  }

  return (
    <>
      <Stars />
      <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <Stars />
        <canvas ref={canvasRef} style={{
          position: 'absolute', inset: 0,
          background: 'transparent',
        }} />

        <Sidebar
          user={user} layerOn={layerOn} popLayerOn={popLayerOn} status={status}
          onEarthquakes={loadEarthquakes} onPopulation={loadPopulation}
          onClear={clearLayer}
          onShowAuth={() => setShowAuth(true)} onLogout={logout}
          onToggleAI={() => setShowAI(v => !v)}
        />

        {showAI && user && (
          <AIChatPanel
            onClose={() => setShowAI(false)}
            onMarkersReceived={(markers) => {
              engineRef.current?.renderMarkers(markers, 'cylinder')
              setLayerOn(true)
              setStatus(`AI highlighted ${markers.length} earthquakes`)
            }}
          />
        )}

        <InfoPanel data={selected} onClose={() => setSelected(null)} />

        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            onSuccess={(u, sid) => { setUser(u); setSessionId(sid) }}
          />
        )}
      </div>
    </>
  )
}