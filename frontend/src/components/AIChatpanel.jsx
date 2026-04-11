import { useRef, useState } from 'react'

const EXAMPLES = [
  'Show earthquakes in Japan',
  'Where are the strongest earthquakes?',
  'Show earthquakes in the Pacific',
  'Find magnitude 6+ earthquakes',
]

export default function AIChatPanel({ onClose, onMarkersReceived }) {
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [sources, setSources] = useState([])
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 32, y: 120 }
    return { x: Math.max(32, window.innerWidth - 340 - 32), y: 120 }
  })
  const dragStart = useRef(null)

  const handlePointerMove = (event) => {
    if (!dragStart.current) return
    const dx = event.clientX - dragStart.current.startX
    const dy = event.clientY - dragStart.current.startY
    setPosition({
      x: Math.max(8, dragStart.current.origX + dx),
      y: Math.max(8, dragStart.current.origY + dy),
    })
  }

  const handlePointerUp = () => {
    dragStart.current = null
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
  }

  const handlePointerDown = (event) => {
    if (event.button !== 0) return
    dragStart.current = {
      startX: event.clientX,
      startY: event.clientY,
      origX: position.x,
      origY: position.y,
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const ask = async (q) => {
    const question = q || query
    if (!question.trim() || loading) return

    setQuery('')
    setLoading(true)
    setHistory(h => [...h, { role: 'user', text: question }])

    try {
      const token = localStorage.getItem('tv3d_token')
      const res   = await fetch('/api/ai/query', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: question, layerContext: 'earthquakes' })
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Request failed.')
      }

      setHistory(h => [...h, { role: 'ai', text: data.answer || 'Found no intelligence.' }])
      setSources(data.sources || [])

      if (data.markers?.length > 0) {
        onMarkersReceived?.(data.markers)
      }
    } catch (err) {
      setHistory(h => [...h, {
        role: 'ai',
        text: err.message === 'Failed to fetch' 
          ? 'Sorry, I could not connect to the backend service. Is it running?' 
          : `⚠ Error: ${err.message}`
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position:   'absolute',
      top:        position.y,
      left:       position.x,
      width:      340,
      background: 'linear-gradient(160deg,#080f22 0%,#050a18 100%)',
      border:     '1px solid rgba(139,92,246,0.25)',
      borderRadius: 16,
      zIndex:     20,
      fontFamily: "'Inter',sans-serif",
      color:      '#e2e8f0',
      display:    'flex',
      flexDirection: 'column',
      overflow:   'hidden',
      animation:  'slideUp 0.25s ease',
      maxHeight:  780,
    }}>

      {/* Top glow line */}
      <div style={{
        position:   'absolute', top: 0, left: '10%', right: '10%', height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(139,92,246,0.6),transparent)',
        pointerEvents: 'none'
      }}/>

      {/* Header */}
      <div onPointerDown={handlePointerDown} style={{
        padding:      '13px 16px',
        borderBottom: '1px solid rgba(139,92,246,0.15)',
        background:   'rgba(139,92,246,0.06)',
        display:      'flex',
        justifyContent: 'space-between',
        alignItems:   'center',
        flexShrink:   0,
        cursor:       'grab',
        userSelect:   'none',
        touchAction:  'none',
      }}>
        <div style={{
          fontFamily:     "'Orbitron',monospace",
          fontSize:       10,
          color:          '#a78bfa',
          letterSpacing:  '0.14em',
          display:        'flex',
          alignItems:     'center',
          gap:            8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#8b5cf6',
            boxShadow:  '0 0 6px #8b5cf6',
            animation:  'pulse 2s infinite'
          }}/>
          TERRAVIZ AI
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize:       8,
            padding:        '2px 7px',
            background:     'rgba(139,92,246,0.15)',
            border:         '1px solid rgba(139,92,246,0.25)',
            borderRadius:   4,
            color:          '#7c3aed',
            fontFamily:     "'Orbitron',monospace",
            letterSpacing:  '0.08em'
          }}>BETA</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: '#334155', cursor: 'pointer', fontSize: 16, lineHeight: 1
          }}>✕</button>
        </div>
      </div>

      {/* Example chips — only shown before first message */}
      {history.length === 0 && (
        <div style={{
          padding:  '12px 14px',
          display:  'flex',
          flexWrap: 'wrap',
          gap:      6,
          flexShrink: 0,
        }}>
          <div style={{
            width:         '100%',
            fontSize:      9,
            color:         '#1e3a5f',
            fontFamily:    "'Orbitron',monospace",
            letterSpacing: '0.12em',
            marginBottom:  4
          }}>
            TRY ASKING
          </div>
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => ask(ex)} style={{
              fontSize:   10,
              padding:    '5px 10px',
              background: 'rgba(139,92,246,0.07)',
              border:     '1px solid rgba(139,92,246,0.18)',
              borderRadius: 20,
              color:      '#a78bfa',
              cursor:     'pointer',
              fontFamily: "'Inter',sans-serif",
              transition: 'all 0.2s',
            }}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Chat history */}
      {history.length > 0 && (
        <div style={{
          padding:        '12px 14px',
          overflowY:      'auto',
          flexGrow:       1,
          display:        'flex',
          flexDirection:  'column',
          gap:            10,
        }}>
          {history.map((msg, i) => (
            <div key={i} style={{
              display:        'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              {msg.role === 'ai' && (
                <div style={{
                  width:       20, height: 20,
                  borderRadius: '50%',
                  background:  'rgba(139,92,246,0.2)',
                  border:      '1px solid rgba(139,92,246,0.3)',
                  display:     'flex',
                  alignItems:  'center',
                  justifyContent: 'center',
                  fontSize:    9, color: '#a78bfa',
                  marginRight: 6, flexShrink: 0,
                  marginTop:   2,
                }}>◈</div>
              )}
              <div style={{
                maxWidth:     '78%',
                padding:      '8px 12px',
                borderRadius: msg.role === 'user'
                  ? '12px 12px 4px 12px'
                  : '12px 12px 12px 4px',
                background: msg.role === 'user'
                  ? 'rgba(59,130,246,0.15)'
                  : 'rgba(139,92,246,0.1)',
                border: `1px solid ${msg.role === 'user'
                  ? 'rgba(59,130,246,0.25)'
                  : 'rgba(139,92,246,0.18)'}`,
                fontSize:   12,
                lineHeight: 1.65,
                color:      msg.role === 'user' ? '#bfdbfe' : '#e2e8f0',
              }}>
                {msg.text}
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(139,92,246,0.2)',
                border: '1px solid rgba(139,92,246,0.3)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 9, color: '#a78bfa',
              }}>◈</div>
              <div style={{
                fontSize:      10,
                color:         '#4c1d95',
                fontFamily:    "'Orbitron',monospace",
                letterSpacing: '0.12em',
                animation:     'pulse 1s infinite'
              }}>
                ANALYSING...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sources bar */}
      {sources.length > 0 && (
        <div style={{
          padding:     '5px 14px',
          borderTop:   '1px solid rgba(139,92,246,0.1)',
          fontSize:    9,
          color:       '#1e3a5f',
          fontFamily:  "'Orbitron',monospace",
          letterSpacing: '0.1em',
          flexShrink:  0,
        }}>
          ◎ {sources.length} DATA POINTS RETRIEVED
        </div>
      )}

      {/* Input row */}
      <div style={{
        padding:     '10px 12px',
        borderTop:   '1px solid rgba(139,92,246,0.15)',
        display:     'flex',
        gap:         8,
        flexShrink:  0,
        background:  'rgba(139,92,246,0.03)',
      }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Ask about any region or event..."
          style={{
            flex:       1,
            padding:    '9px 12px',
            background: 'rgba(255,255,255,0.04)',
            border:     '1px solid rgba(139,92,246,0.18)',
            borderRadius: 8,
            color:      '#e2e8f0',
            fontSize:   12,
            outline:    'none',
            fontFamily: "'Inter',sans-serif",
          }}
        />
        <button
          onClick={() => ask()}
          disabled={loading}
          style={{
            padding:    '9px 14px',
            background: loading ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.25)',
            border:     '1px solid rgba(139,92,246,0.35)',
            borderRadius: 8,
            color:      loading ? '#4c1d95' : '#a78bfa',
            cursor:     loading ? 'not-allowed' : 'pointer',
            fontSize:   16,
            transition: 'all 0.2s',
          }}
        >→</button>
      </div>
    </div>
  )
}