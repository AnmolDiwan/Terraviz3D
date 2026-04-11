import * as THREE from 'three'

export class GlobeEngine {
  constructor(canvas, onMarkerClick) {
    this.canvas = canvas
    this.onMarkerClick = onMarkerClick
    this.isDragging = false
    this.prevMouse = { x: 0, y: 0 }
    this.autoRotate = true
    this.clock = new THREE.Clock()

    // Named layer groups — supports multiple simultaneous layers
    this.layerGroups = {}

    // Keep backward-compat reference
    this.markers = this._getOrCreateLayer('earthquakes')

    this.init()
  }

  // ── Layer management ────────────────────────────────────────
  _getOrCreateLayer(name) {
    if (!this.layerGroups[name]) {
      const group = new THREE.Group()
      group.name = name
      this.layerGroups[name] = group
      if (this.scene) this.scene.add(group)
    }
    return this.layerGroups[name]
  }

  _getAllLayerChildren() {
    const children = []
    Object.values(this.layerGroups).forEach(g => {
      children.push(...g.children)
    })
    return children
  }

  _syncLayerRotations() {
    Object.values(this.layerGroups).forEach(g => {
      g.rotation.copy(this.globe.rotation)
    })
  }

  init() {
    this.scene = new THREE.Scene()

    // ── GPU: Force dedicated GPU, enable high-quality rendering ──
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',  // ← Use dedicated GPU
      stencil: false,                        // ← Disable unused buffer
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    // Log which GPU is being used
    const gl = this.renderer.getContext()
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      const gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      console.log(`🎮 GPU: ${gpu}`)
    }

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      45, window.innerWidth / window.innerHeight, 0.1, 1000
    )
    this.camera.position.z = 2.5

    // Lights — richer setup
    const ambient = new THREE.AmbientLight(0x88aaff, 0.4)
    this.scene.add(ambient)

    const sun = new THREE.DirectionalLight(0xfff5e6, 1.4)
    sun.position.set(5, 3, 5)
    this.scene.add(sun)

    // Subtle rim light from behind
    const rim = new THREE.DirectionalLight(0x4488ff, 0.3)
    rim.position.set(-3, -1, -5)
    this.scene.add(rim)

    this.buildGlobe()
    this.buildAtmosphere()
    this.buildStarfield()

    // Add all layer groups to scene
    Object.values(this.layerGroups).forEach(g => this.scene.add(g))

    this.bindEvents()
    this.animate()
  }

  buildGlobe() {
    const loader = new THREE.TextureLoader()
    const geometry = new THREE.SphereGeometry(1, 96, 96)
    const material = new THREE.MeshPhongMaterial({
      map: loader.load('/textures/earth_day.jpg'),
      bumpMap: loader.load('/textures/earth_bump.jpg'),
      bumpScale: 0.006,
      specular: new THREE.Color(0x444466),
      shininess: 15,
    })
    this.globe = new THREE.Mesh(geometry, material)
    this.scene.add(this.globe)
  }

  buildAtmosphere() {
    // Inner atmosphere — subtle blue fresnel
    const innerGeo = new THREE.SphereGeometry(1.015, 96, 96)
    const innerMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float intensity = pow(0.72 - dot(vNormal, vec3(0,0,1.0)), 2.5);
          vec3 color = mix(vec3(0.15, 0.4, 1.0), vec3(0.4, 0.7, 1.0), intensity);
          gl_FragColor = vec4(color, intensity * 0.6);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    })
    this.scene.add(new THREE.Mesh(innerGeo, innerMat))

    // Outer atmosphere — glow halo
    const outerGeo = new THREE.SphereGeometry(1.12, 96, 96)
    const outerMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.55 - dot(vNormal, vec3(0,0,1.0)), 3.0);
          gl_FragColor = vec4(0.25, 0.55, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
    this.atmosphere = new THREE.Mesh(outerGeo, outerMat)
    this.scene.add(this.atmosphere)
  }

  buildStarfield() {
    const geometry = new THREE.BufferGeometry()
    const count    = 8000
    const positions = new Float32Array(count * 3)
    const sizes     = new Float32Array(count)
    const colors    = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 60 + Math.random() * 140

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      sizes[i] = Math.random() * 1.8 + 0.2

      // Slight color variation
      const temp = Math.random()
      if (temp < 0.15) {
        colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1.0
      } else if (temp < 0.05) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.7
      } else {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 1.0; colors[i * 3 + 2] = 1.0
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size:        0.12,
      sizeAttenuation: true,
      transparent: true,
      opacity:     0.9,
      vertexColors: true,
    })

    const stars = new THREE.Points(geometry, material)
    this.scene.add(stars)
  }

  bindEvents() {
    const c = this.canvas

    c.addEventListener('mousedown', (e) => {
      this.isDragging = true
      this.autoRotate = false
      this.prevMouse = { x: e.clientX, y: e.clientY }
    })

    c.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return
      const dx = (e.clientX - this.prevMouse.x) * 0.005
      const dy = (e.clientY - this.prevMouse.y) * 0.005
      this.globe.rotation.y += dx
      this.globe.rotation.x += dy
      this.globe.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.globe.rotation.x))
      this._syncLayerRotations()
      this.prevMouse = { x: e.clientX, y: e.clientY }
    })

    c.addEventListener('mouseup', () => {
      this.isDragging = false
      setTimeout(() => { this.autoRotate = true }, 3000)
    })

    c.addEventListener('wheel', (e) => {
      e.preventDefault()
      const MIN = 1.2, MAX = 4.0
      this.camera.position.z = Math.max(MIN, Math.min(MAX, this.camera.position.z + e.deltaY * 0.001))
    }, { passive: false })

    // Click → raycast across ALL layer groups
    c.addEventListener('click', (e) => {
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, this.camera)
      const hits = raycaster.intersectObjects(this._getAllLayerChildren())
      if (hits.length > 0 && hits[0].object.userData?.dataPoint) {
        this.onMarkerClick?.(hits[0].object.userData.dataPoint)
      }
    })

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }

  latLngToVec3(lat, lng, radius = 1.001) {
    const phi   = (90 - lat) * (Math.PI / 180)
    const theta = (lng + 180) * (Math.PI / 180)
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
       radius * Math.cos(phi),
       radius * Math.sin(phi) * Math.sin(theta)
    )
  }

  // ── Earthquake markers ────────────────────────────────────────
  renderMarkers(dataPoints, type = 'cylinder') {
    const layer = this._getOrCreateLayer('earthquakes')
    layer.clear()

    dataPoints.forEach((dp) => {
      const norm = Math.min(dp.magnitude / 10, 1)

      const color = new THREE.Color().setHSL(0.6 - norm * 0.6, 1, 0.6)
      const tipColor = new THREE.Color().setHSL(0.6 - norm * 0.6, 1, 0.95)

      const h = 0.12 + norm * 0.55
      const pos = this.latLngToVec3(dp.lat, dp.lng)
      const outward = pos.clone().normalize()

      // CORE BEAM
      const coreGeo = new THREE.CylinderGeometry(0.002, 0.008, h, 8, 1, true)
      coreGeo.translate(0, h / 2, 0)
      const coreMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
      const core = new THREE.Mesh(coreGeo, coreMat)
      core.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward)
      core.position.copy(pos)
      core.userData = { dataPoint: dp, type: 'marker' }

      // OUTER GLOW
      const glowGeo = new THREE.CylinderGeometry(0.006, 0.022, h * 1.1, 8, 1, true)
      glowGeo.translate(0, (h * 1.1) / 2, 0)
      const glowMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
      const glow = new THREE.Mesh(glowGeo, glowMat)
      glow.quaternion.copy(core.quaternion)
      glow.position.copy(pos)
      glow.userData = { type: 'glow' }
      glow.raycast = () => null

      // TIP FLARE
      const tipGeo = new THREE.SphereGeometry(0.008 + norm * 0.012, 8, 8)
      const tipMat = new THREE.MeshBasicMaterial({
        color: tipColor, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
      const tip = new THREE.Mesh(tipGeo, tipMat)
      tip.position.copy(pos.clone().addScaledVector(outward, h))
      tip.userData = { type: 'glow' }
      tip.raycast = () => null

      // BASE RING
      const ringGeo = new THREE.RingGeometry(0.01, 0.025 + norm * 0.02, 16)
      const ringMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward)
      ring.position.copy(pos)
      ring.userData = { type: 'glow' }
      ring.raycast = () => null

      layer.add(glow)
      layer.add(core)
      layer.add(tip)
      layer.add(ring)
    })

    layer.rotation.copy(this.globe.rotation)
  }

  // ── Population markers — teal pillars ─────────────────────────
  renderPopulationMarkers(dataPoints) {
    const layer = this._getOrCreateLayer('population')
    layer.clear()

    const LOG_MIN = 4
    const LOG_MAX = 9.2

    dataPoints.forEach((dp) => {
      const pop = dp.metadata?.population ?? 0
      if (pop < 10000) return

      const logPop = Math.log10(pop)
      const norm = Math.max(0, Math.min(1, (logPop - LOG_MIN) / (LOG_MAX - LOG_MIN)))

      const hue = 0.48 - norm * 0.06
      const sat = 0.85 - norm * 0.2
      const lum = 0.45 + norm * 0.2
      const color    = new THREE.Color().setHSL(hue, sat, lum)
      const capColor = new THREE.Color().setHSL(hue, 0.6, 0.85)

      const h   = 0.04 + norm * 0.38
      const w   = 0.006 + norm * 0.008
      const pos = this.latLngToVec3(dp.lat, dp.lng)
      const outward = pos.clone().normalize()

      // CORE PILLAR
      const pillarGeo = new THREE.CylinderGeometry(w * 0.7, w, h, 6, 1)
      pillarGeo.translate(0, h / 2, 0)
      const pillarMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
      const pillar = new THREE.Mesh(pillarGeo, pillarMat)
      pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward)
      pillar.position.copy(pos)
      pillar.userData = { dataPoint: dp, type: 'marker' }

      // OUTER GLOW
      const glowGeo = new THREE.CylinderGeometry(w * 1.4, w * 2.2, h * 1.05, 6, 1, true)
      glowGeo.translate(0, (h * 1.05) / 2, 0)
      const glowMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
      const glow = new THREE.Mesh(glowGeo, glowMat)
      glow.quaternion.copy(pillar.quaternion)
      glow.position.copy(pos)
      glow.userData = { type: 'glow' }
      glow.raycast = () => null

      // FLAT CAP
      const capGeo = new THREE.CircleGeometry(w * 0.9, 6)
      const capMat = new THREE.MeshBasicMaterial({
        color: capColor, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
      const cap = new THREE.Mesh(capGeo, capMat)
      cap.position.copy(pos.clone().addScaledVector(outward, h))
      cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward)
      cap.userData = { type: 'glow' }
      cap.raycast = () => null

      // BASE RING
      const ringGeo = new THREE.RingGeometry(w * 0.5, w * 2.5, 16)
      const ringMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward)
      ring.position.copy(pos)
      ring.userData = { type: 'glow' }
      ring.raycast = () => null

      layer.add(glow)
      layer.add(pillar)
      layer.add(cap)
      layer.add(ring)
    })

    layer.rotation.copy(this.globe.rotation)
  }

  clearMarkers(layerName) {
    if (layerName) {
      const layer = this.layerGroups[layerName]
      if (layer) layer.clear()
    } else {
      Object.values(this.layerGroups).forEach(g => g.clear())
    }
  }

  animate() {
    this.animId = requestAnimationFrame(this.animate.bind(this))
    if (this.autoRotate) {
      this.globe.rotation.y += 0.0005
      Object.values(this.layerGroups).forEach(g => {
        g.rotation.y += 0.0005
      })
    }
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.animId)
    this.renderer.dispose()
  }
}