import { useEffect, useRef, useState } from 'react'
import { GlobeEngine } from './components/GlobeEngine'

export default function App() {
  const canvasRef  = useRef(null)
  const engineRef  = useRef(null)
  const [selected, setSelected] = useState(null)
  const [status,   setStatus]   = useState('')

  // Boot the globe
  useEffect(() => {
    if (!canvasRef.current) return
    engineRef.current = new GlobeEngine(canvasRef.current, (dp) => setSelected(dp))
    return () => engineRef.current?.dispose()
  }, [])

  // Load earthquake data
  const loadEarthquakes = async () => {
    setStatus('Loading earthquakes…')
    try {
      const res  = await fetch(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson'
      )
      const json = await res.json()
      const points = json.features.map(f => ({
        lat:       f.geometry.coordinates[1],
        lng:       f.geometry.coordinates[0],
        magnitude: f.properties.mag,
        category:  'earthquake',
        metadata:  f.properties,
      }))
      engineRef.current?.renderMarkers(points, 'cylinder')
      setStatus(`${points.length} earthquakes loaded`)
    } catch {
      setStatus('Failed to load data')
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {/* Globe Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 40% 50%, #0a1628 0%, #020509 100%)'
        }}
      />

      {/* Sidebar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: 220, background: 'rgba(8,15,35,0.85)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(100,160,255,0.18)',
        padding: '20px 16px', display: 'flex',
        flexDirection: 'column', gap: 10, zIndex: 10,
        fontFamily: 'monospace', color: '#e2e8f0'
      }}>
        <div style={{ fontSize: 14, color: '#60a5fa', fontWeight: 'bold', paddingBottom: 12, borderBottom: '1px solid rgba(100,160,255,0.18)' }}>
          🌍 TerraViz 3D
        </div>

        <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.1em', marginTop: 8 }}>
          DATA LAYERS
        </div>

        <button onClick={loadEarthquakes} style={{
          padding: '9px 12px', background: 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8,
          color: '#60a5fa', cursor: 'pointer', textAlign: 'left', fontSize: 13
        }}>
          🔴 Earthquakes
        </button>

        <button onClick={() => { engineRef.current?.clearMarkers(); setStatus(''); setSelected(null) }} style={{
          padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(100,160,255,0.18)', borderRadius: 8,
          color: '#94a3b8', cursor: 'pointer', textAlign: 'left', fontSize: 13
        }}>
          ✕ Clear
        </button>

        {status && (
          <div style={{ fontSize: 11, color: '#64748b', padding: '4px 2px' }}>
            {status}
          </div>
        )}

        <div style={{ marginTop: 'auto', fontSize: 10, color: '#475569', lineHeight: 1.9, borderTop: '1px solid rgba(100,160,255,0.1)', paddingTop: 10 }}>
          <div>Drag → Rotate</div>
          <div>Scroll → Zoom</div>
          <div>Click marker → Info</div>
        </div>
      </div>

      {/* Info Panel — appears when a marker is clicked */}
      {selected && (
        <div style={{
          position: 'absolute', bottom: 32, right: 32,
          width: 260, background: 'rgba(8,15,35,0.9)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(100,160,255,0.2)',
          borderRadius: 14, padding: 20, zIndex: 20,
          fontFamily: 'monospace', color: '#e2e8f0'
        }}>
          <button
            onClick={() => setSelected(null)}
            style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}
          >✕</button>
          <div style={{ fontSize: 9, color: '#60a5fa', letterSpacing: '0.15em', marginBottom: 6 }}>
            EARTHQUAKE
          </div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: selected.magnitude > 5 ? '#ef4444' : '#f59e0b' }}>
            M {selected.magnitude?.toFixed(1)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', margin: '4px 0 8px' }}>
            {selected.lat?.toFixed(2)}°, {selected.lng?.toFixed(2)}°
          </div>
          {selected.metadata?.place && (
            <div style={{ fontSize: 12, marginBottom: 8 }}>{selected.metadata.place}</div>
          )}
        </div>
      )}
    </div>
  )
}