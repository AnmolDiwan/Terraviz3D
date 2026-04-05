import { useEffect, useRef, useState } from 'react'
import { GlobeEngine } from './components/GlobeEngine'

// ── Twinkling stars background ───────────────────────────────
function Stars() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width:  Math.random() * 1.5 + 0.5 + 'px',
          height: Math.random() * 1.5 + 0.5 + 'px',
          left:   Math.random() * 100 + '%',
          top:    Math.random() * 100 + '%',
          borderRadius: '50%',
          background: 'white',
          opacity: Math.random() * 0.5 + 0.1,
          animation: `twinkle ${2 + Math.random() * 3}s ${Math.random() * 3}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ── Auth Modal ───────────────────────────────────────────────
function AuthModal({ onClose, onSuccess }) {
  const [mode,    setMode]    = useState('login')
  const [form,    setForm]    = useState({ username: '', email: '', password: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const submit = async () => {
    setError('')
    if (!form.username || !form.password) { setError('All fields are required'); return }
    if (mode === 'register' && !form.email) { setError('Email is required'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }

    setLoading(true)
    try {
      const url  = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = mode === 'login'
        ? { username: form.username, password: form.password }
        : { username: form.username, email: form.email, password: form.password }

      const res  = await fetch(url, {
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

      localStorage.setItem('tv3d_token',   data.token)
      localStorage.setItem('tv3d_session', JSON.stringify(data.session))
      onSuccess(data.session.user, data.session.sessionId)
      onClose()
    } catch {
      setError('Cannot connect to server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        width: 360, padding: '40px 32px',
        background: 'linear-gradient(160deg, #0a1628 0%, #060d1c 100%)',
        border: '1px solid rgba(99,179,255,0.2)',
        borderRadius: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
        color: '#e2e8f0', position: 'relative', overflow: 'hidden'
      }}>
        {/* top glow */}
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.6),transparent)'
        }}/>

        <div style={{ textAlign: 'center', fontFamily: "'Orbitron',monospace", fontSize: 11, color: '#3b82f6', letterSpacing: '0.15em' }}>
          TERRAVIZ 3D
        </div>
        <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 600 }}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#475569' }}>
          {mode === 'login' ? 'Access restricted data layers' : 'Join TerraViz 3D'}
        </div>

        <input
          placeholder="Username or email"
          value={form.username}
          onChange={e => update('username', e.target.value)}
          style={inputStyle}
        />
        {mode === 'register' && (
          <input
            placeholder="Email address"
            type="email"
            value={form.email}
            onChange={e => update('email', e.target.value)}
            style={inputStyle}
          />
        )}
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={e => update('password', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={inputStyle}
        />

        {error && (
          <div style={{
            color: '#f87171', fontSize: 12, textAlign: 'center',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, padding: '8px 12px'
          }}>
            ⚠ {error}
          </div>
        )}

        <button onClick={submit} disabled={loading} style={{
          padding: 13,
          background: loading ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.9)',
          border: 'none', borderRadius: 10,
          color: '#fff', fontSize: 14, fontWeight: 600,
          fontFamily: "'Orbitron',monospace", letterSpacing: '0.05em',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s'
        }}>
          {loading ? 'AUTHENTICATING...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 12, color: '#475569' }}>
          {mode === 'login' ? "No account? " : 'Have an account? '}
          <span
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{ color: '#60a5fa', cursor: 'pointer' }}
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </span>
        </div>

        <div onClick={onClose} style={{ textAlign: 'center', fontSize: 11, color: '#334155', cursor: 'pointer' }}>
          Continue as guest
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(99,179,255,0.15)',
  borderRadius: 10, color: '#e2e8f0',
  fontSize: 14, outline: 'none',
  fontFamily: "'Inter', sans-serif",
  transition: 'border-color 0.2s',
}

// ── Info Panel ───────────────────────────────────────────────
function InfoPanel({ data, onClose }) {
  if (!data) return null
  const mag   = data.magnitude?.toFixed(1)
  const color = data.magnitude > 6 ? '#ef4444' : data.magnitude > 4 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{
      position: 'absolute', bottom: 32, right: 32,
      width: 280,
      background: 'linear-gradient(160deg,#080f22 0%,#050a18 100%)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(99,179,255,0.18)',
      borderRadius: 16, padding: '20px 20px',
      zIndex: 20, fontFamily: "'Inter', sans-serif",
      color: '#e2e8f0', animation: 'slideUp 0.25s ease',
      overflow: 'hidden'
    }}>
      {/* top glow */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
        background: `linear-gradient(90deg,transparent,${color}66,transparent)`
      }}/>

      <button onClick={onClose} style={{
        position: 'absolute', top: 12, right: 14,
        background: 'none', border: 'none',
        color: '#334155', cursor: 'pointer', fontSize: 16
      }}>✕</button>

      <div style={{
        fontSize: 9, color: '#1d4ed8',
        fontFamily: "'Orbitron',monospace",
        letterSpacing: '0.18em', marginBottom: 8
      }}>
        SEISMIC EVENT
      </div>

      <div style={{ fontSize: 38, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>
        M{mag}
      </div>

      <div style={{ fontSize: 11, color: '#334155', marginBottom: 10, fontFamily: "'Orbitron',monospace" }}>
        {data.lat?.toFixed(3)}° {data.lat > 0 ? 'N' : 'S'} &nbsp;
        {data.lng?.toFixed(3)}° {data.lng > 0 ? 'E' : 'W'}
      </div>

      {data.metadata?.place && (
        <div style={{
          fontSize: 13, marginBottom: 10,
          padding: '8px 10px',
          background: 'rgba(99,179,255,0.06)',
          borderRadius: 8, borderLeft: `2px solid ${color}`
        }}>
          {data.metadata.place}
        </div>
      )}

      {data.metadata?.time && (
        <div style={{ fontSize: 10, color: '#1e3a5f', fontFamily: "'Orbitron',monospace" }}>
          {new Date(data.metadata.time).toUTCString()}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────────────────
function Sidebar({ user, layerOn, status, onEarthquakes, onClear, onShowAuth, onLogout }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, bottom: 0, width: 230,
      background: 'linear-gradient(180deg,#050d1f 0%,#060e20 100%)',
      borderRight: '1px solid rgba(99,179,255,0.12)',
      padding: '20px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 10, overflow: 'hidden', fontFamily: "'Inter',sans-serif"
    }}>

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)',
      }}/>

      {/* Scanning glow */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 80,
        background: 'linear-gradient(180deg,transparent,rgba(59,130,246,0.04),transparent)',
        animation: 'scan 5s linear infinite', pointerEvents: 'none'
      }}/>

      <Stars />

      {/* Logo */}
      <div style={{
        fontFamily: "'Orbitron',monospace", fontSize: 12, fontWeight: 700,
        color: '#7dd3fc', letterSpacing: '0.12em',
        paddingBottom: 14, borderBottom: '1px solid rgba(99,179,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: '#3b82f6',
          boxShadow: '0 0 8px #3b82f6', animation: 'pulse 2s infinite'
        }}/>
        TERRAVIZ 3D
      </div>

      {/* User chip */}
      {user ? (
        <div style={{
          padding: '8px 10px', position: 'relative', zIndex: 1,
          background: 'rgba(34,197,94,0.07)',
          border: '1px solid rgba(34,197,94,0.18)',
          borderRadius: 8, fontSize: 11, color: '#4ade80',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
            animation: 'pulse 1.5s infinite'
          }}/>
          {user.username}
          <span style={{ marginLeft: 'auto', fontSize: 9, color: '#166534',
            fontFamily: "'Orbitron',monospace", letterSpacing: '0.1em' }}>
            {user.role}
          </span>
        </div>
      ) : (
        <div style={{
          padding: '8px 10px', position: 'relative', zIndex: 1,
          background: 'rgba(99,179,255,0.04)',
          border: '1px solid rgba(99,179,255,0.1)',
          borderRadius: 8, fontSize: 11, color: '#334155'
        }}>
          👤 Guest mode
        </div>
      )}

      <div style={{ height: 1, background: 'rgba(99,179,255,0.08)', position: 'relative', zIndex: 1 }}/>

      {/* Section label */}
      <div style={{
        fontSize: 9, color: '#1e3a5f', letterSpacing: '0.18em',
        fontFamily: "'Orbitron',monospace", marginTop: 2, position: 'relative', zIndex: 1
      }}>
        DATA LAYERS
      </div>

      {/* Earthquakes toggle */}
      <button onClick={onEarthquakes} style={{
        padding: '10px 12px', position: 'relative', zIndex: 1,
        background: layerOn ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.06)',
        border: `1px solid ${layerOn ? 'rgba(59,130,246,0.45)' : 'rgba(59,130,246,0.15)'}`,
        borderRadius: 10, color: layerOn ? '#bfdbfe' : '#60a5fa',
        cursor: 'pointer', fontSize: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        transition: 'all 0.25s', fontFamily: "'Inter',sans-serif"
      }}>
        <span>● Earthquakes</span>
        <span style={{
          fontSize: 8, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
          letterSpacing: '0.1em', fontFamily: "'Orbitron',monospace",
          background: layerOn ? 'rgba(34,197,94,0.2)' : 'rgba(30,41,59,0.8)',
          color: layerOn ? '#4ade80' : '#334155',
          border: `1px solid ${layerOn ? 'rgba(34,197,94,0.3)' : 'rgba(51,65,85,0.5)'}`,
        }}>
          {layerOn ? 'ON' : 'OFF'}
        </span>
      </button>

      {/* Status */}
      {status && (
        <div style={{
          fontSize: 10, color: '#1d4ed8', padding: '2px 4px',
          fontFamily: "'Orbitron',monospace", position: 'relative', zIndex: 1
        }}>
          {status}
        </div>
      )}

      {/* Clear */}
      <button onClick={onClear} style={{
        padding: '9px 12px', position: 'relative', zIndex: 1,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(99,179,255,0.08)',
        borderRadius: 10, color: '#334155',
        cursor: 'pointer', fontSize: 12, textAlign: 'left',
        fontFamily: "'Inter',sans-serif"
      }}>
        ✕ Clear
      </button>

      <div style={{ height: 1, background: 'rgba(99,179,255,0.08)', position: 'relative', zIndex: 1 }}/>

      {/* Section label */}
      <div style={{
        fontSize: 9, color: '#1e3a5f', letterSpacing: '0.18em',
        fontFamily: "'Orbitron',monospace", position: 'relative', zIndex: 1
      }}>
        TOOLS
      </div>

      {/* AI Assistant */}
      <button style={{
        padding: '10px 12px', position: 'relative', zIndex: 1,
        background: 'rgba(139,92,246,0.07)',
        border: '1px solid rgba(139,92,246,0.18)',
        borderRadius: 10, color: '#a78bfa',
        cursor: 'pointer', fontSize: 12, textAlign: 'left',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: "'Inter',sans-serif"
      }}>
        <span>◈ AI Assistant</span>
        <span style={{
          fontSize: 8, padding: '2px 6px', borderRadius: 4,
          background: 'rgba(139,92,246,0.15)', color: '#7c3aed',
          fontFamily: "'Orbitron',monospace", letterSpacing: '0.08em'
        }}>BETA</span>
      </button>

      <div style={{ height: 1, background: 'rgba(99,179,255,0.08)', position: 'relative', zIndex: 1 }}/>

      {/* Auth button */}
      {user ? (
        <button onClick={onLogout} style={{
          padding: '10px 12px', position: 'relative', zIndex: 1,
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 10, color: '#f87171',
          cursor: 'pointer', fontSize: 12, textAlign: 'left',
          fontFamily: "'Inter',sans-serif"
        }}>
          ⌐ Sign Out
        </button>
      ) : (
        <button onClick={onShowAuth} style={{
          padding: '10px 12px', position: 'relative', zIndex: 1,
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10, color: '#60a5fa',
          cursor: 'pointer', fontSize: 12,
          fontFamily: "'Orbitron',monospace", fontWeight: 600,
          letterSpacing: '0.05em'
        }}>
          SIGN IN
        </button>
      )}

      {/* Hints */}
      <div style={{
        marginTop: 'auto', fontSize: 10, color: '#0f2744',
        lineHeight: 2.2, borderTop: '1px solid rgba(99,179,255,0.08)',
        paddingTop: 10, position: 'relative', zIndex: 1
      }}>
        {[['drag','rotate'],['scroll','zoom'],['click','details'],['dblclick','fly to']].map(([k,v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              background: 'rgba(99,179,255,0.06)',
              border: '1px solid rgba(99,179,255,0.12)',
              borderRadius: 4, padding: '0px 5px', fontSize: 9,
              color: '#1e3a5f', fontFamily: "'Orbitron',monospace",
              letterSpacing: '0.05em'
            }}>{k}</span>
            <span>{v}</span>
          </div>
        ))}
        {!user && (
          <div style={{ color: '#78350f', marginTop: 4, fontSize: 9,
            fontFamily: "'Orbitron',monospace", letterSpacing: '0.08em' }}>
            ⚠ SIGN IN FOR DATA ACCESS
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
  const [selected,  setSelected]  = useState(null)
  const [status,    setStatus]    = useState('')
  const [user,      setUser]      = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [showAuth,  setShowAuth]  = useState(false)
  const [layerOn,   setLayerOn]   = useState(false)

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
      const res    = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson')
      const json   = await res.json()
      const points = json.features.map(f => ({
        lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
        magnitude: f.properties.mag, category: 'earthquake', metadata: f.properties,
      }))
      engineRef.current?.renderMarkers(points, 'cylinder')
      setStatus(`${points.length} earthquakes loaded`)
    } catch {
      setStatus('DATA UNAVAILABLE')
      setLayerOn(false)
    }
  }

  const clearLayer = () => {
    engineRef.current?.clearMarkers()
    setStatus(''); setLayerOn(false); setSelected(null)
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
      {/* Global animations */}
      <style>{`
        @keyframes twinkle { 0%,100%{opacity:0.15} 50%{opacity:0.9} }
        @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        @keyframes scan    { 0%{transform:translateY(-80px)} 100%{transform:translateY(100vh)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ position:'relative', width:'100vw', height:'100vh', overflow:'hidden' }}>

        {/* Globe */}
        <canvas ref={canvasRef} style={{
          position:'absolute', inset:0,
          background:'#20509'
        }}/>

        <Sidebar
          user={user} layerOn={layerOn} status={status}
          onEarthquakes={loadEarthquakes} onClear={clearLayer}
          onShowAuth={() => setShowAuth(true)} onLogout={logout}
        />

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