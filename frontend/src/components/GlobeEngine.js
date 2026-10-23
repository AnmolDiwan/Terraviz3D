import * as THREE from 'three'

const DAY_NIGHT_VERT = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const DAY_NIGHT_FRAG = `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDirection;

  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    float sunDot = dot(vWorldNormal, normalize(sunDirection));
    // Smooth transition at the terminator
    float blend = smoothstep(-0.15, 0.25, sunDot);

    vec4 day = texture2D(dayMap, vUv);
    vec4 night = texture2D(nightMap, vUv);

    // Night lights glow slightly brighter on dark side
    vec4 nightBoosted = vec4(night.rgb * 1.8, night.a);

    gl_FragColor = mix(nightBoosted, day, blend);
  }
`

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
    if (this.baseAtmosphere) this.baseAtmosphere.rotation.copy(this.globe.rotation)
    if (this.atmosphere) this.atmosphere.rotation.copy(this.globe.rotation)
    if (this.innerAtmosphere) this.innerAtmosphere.rotation.copy(this.globe.rotation)
  }

  init() {
    this.scene = new THREE.Scene()

    // ── GPU: Dedicated GPU, high-performance rendering ──
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2
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

    // Lighting — clean sun + dim ambient
    const sun = new THREE.DirectionalLight(0xfff5e4, 2.0)
    sun.position.set(5, 2, 5)
    this.scene.add(sun)

    const ambient = new THREE.AmbientLight(0x22222a, 0.12)
    this.scene.add(ambient)

    this.buildGlobe()
    this.buildClouds()
    this.buildAtmosphere()
    this.buildStarfield()

    // Add all layer groups to scene
    Object.values(this.layerGroups).forEach(g => this.scene.add(g))

    this.bindEvents()
    this.animate()
  }

  buildGlobe() {
    const loader = new THREE.TextureLoader()
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy()
    const dayMap = loader.load('/textures/8k_earth_daymap.jpg')
    const nightMap = loader.load('/textures/8k_earth_nightmap.jpg')
    dayMap.anisotropy = maxAniso
    nightMap.anisotropy = maxAniso

    const geometry = new THREE.SphereGeometry(1, 128, 128)
    const material = new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: dayMap },
        nightMap: { value: nightMap },
        sunDirection: { value: new THREE.Vector3(5, 2, 5).normalize() },
      },
      vertexShader: DAY_NIGHT_VERT,
      fragmentShader: DAY_NIGHT_FRAG,
    })
    this.globe = new THREE.Mesh(geometry, material)
    this.scene.add(this.globe)
  }

  buildClouds() {
    const loader = new THREE.TextureLoader()
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy()
    const geo = new THREE.SphereGeometry(1.008, 96, 96)
    const cloudTex = loader.load('/textures/8k_earth_clouds.jpg')
    cloudTex.anisotropy = maxAniso
    const mat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      alphaMap: cloudTex,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      roughness: 0.0,
      metalness: 0.0,
    })
    this.clouds = new THREE.Mesh(geo, mat)
    this.scene.add(this.clouds)
  }

  buildAtmosphere() {
    // ── 1. Base Earth Atmosphere (subtle natural blue limb) ────────
    const baseGeo = new THREE.SphereGeometry(1.015, 96, 96)
    const baseMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = 1.0 - clamp(dot(vNormal, viewDir), 0.0, 1.0);
          float intensity = pow(fresnel, 3.5);
          vec3 blueColor = vec3(0.12, 0.35, 0.65);
          gl_FragColor = vec4(blueColor * (intensity * 0.18), intensity * 0.18);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    })
    this.baseAtmosphere = new THREE.Mesh(baseGeo, baseMat)
    this.scene.add(this.baseAtmosphere)

    // ── 2. Red Translucent Layer ON TOP of the atmosphere (3D Inner Rim) ──
    const redInnerGeo = new THREE.SphereGeometry(1.02, 96, 96)
    const redInnerMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: new THREE.Vector3(5, 2, 5).normalize() },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = 1.0 - clamp(dot(vNormal, viewDir), 0.0, 1.0);
          float intensity = pow(fresnel, 2.8);

          // 3D rotation streamer detail
          float rotStream = 1.0 + sin(vUv.x * 24.0 + vUv.y * 8.0) * 0.10;

          // Clearly visible translucent light-red rim
          vec3 lightRed = vec3(1.0, 0.40, 0.46);
          float alpha = intensity * 0.45;
          gl_FragColor = vec4(lightRed * (alpha * rotStream), alpha);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    })
    this.innerAtmosphere = new THREE.Mesh(redInnerGeo, redInnerMat)
    this.scene.add(this.innerAtmosphere)

    // ── 3. Red Translucent Layer ON TOP of the atmosphere (3D Outer Shell) ──
    const redOuterGeo = new THREE.SphereGeometry(1.08, 96, 96)
    const redOuterMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: new THREE.Vector3(5, 2, 5).normalize() },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float viewDot = dot(vNormal, viewDir);

          // Continuous 3D falloff surrounding the globe (clearly visible & translucent)
          float intensity = pow(clamp(0.68 - viewDot, 0.0, 1.0), 2.5);

          // 3D Sun lighting depth
          float sunDot = dot(vWorldNormal, normalize(sunDirection));
          float sunGlow = 1.0 + 0.25 * max(sunDot, 0.0);

          // 3D rotation streamer detail
          float rotFlow = 1.0 + sin(vUv.x * 24.0 + vUv.y * 8.0) * 0.10;

          // Translucent yet clearly visible light-red glow
          vec3 lightRed = vec3(1.0, 0.38, 0.45);
          vec3 warmLuminance = vec3(1.0, 0.52, 0.58);
          vec3 glowColor = mix(lightRed, warmLuminance, intensity * 0.35);

          float alpha = intensity * 0.65;
          gl_FragColor = vec4(glowColor * (alpha * sunGlow * rotFlow), alpha);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
    this.atmosphere = new THREE.Mesh(redOuterGeo, redOuterMat)
    this.scene.add(this.atmosphere)
  }

  buildStarfield() {
    const loader = new THREE.TextureLoader()
    const geo = new THREE.SphereGeometry(400, 64, 64)
    const mat = new THREE.MeshBasicMaterial({
      map: loader.load('/textures/8k_stars_milky_way.jpg'),
      side: THREE.BackSide,
    })
    this.starSphere = new THREE.Mesh(geo, mat)
    this.scene.add(this.starSphere)
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
      if (this.clouds) {
        this.clouds.rotation.y = this.globe.rotation.y
        this.clouds.rotation.x = this.globe.rotation.x
      }
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
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lng + 180) * (Math.PI / 180)
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
       radius * Math.cos(phi),
       radius * Math.sin(phi) * Math.sin(theta)
    )
  }

  flyTo(lat, lng, duration = 1200) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return
    const targetY = -((lng + 90) * (Math.PI / 180))
    const targetX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, (lat * (Math.PI / 180))))

    const startX = this.globe.rotation.x
    const startY = this.globe.rotation.y

    // Shortest angular distance for Y
    let diffY = (targetY - (startY % (Math.PI * 2))) % (Math.PI * 2)
    if (diffY < -Math.PI) diffY += Math.PI * 2
    if (diffY > Math.PI) diffY -= Math.PI * 2
    const finalTargetY = startY + diffY

    const startTime = performance.now()
    this.autoRotate = false

    const animateFly = (now) => {
      const elapsed = (now - startTime) / duration
      const t = Math.min(1, Math.max(0, elapsed))
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3)

      this.globe.rotation.x = startX + (targetX - startX) * ease
      this.globe.rotation.y = startY + (finalTargetY - startY) * ease
      if (this.clouds) {
        this.clouds.rotation.x = this.globe.rotation.x
        this.clouds.rotation.y = this.globe.rotation.y
      }
      this._syncLayerRotations()

      if (t < 1) {
        requestAnimationFrame(animateFly)
      } else {
        setTimeout(() => { this.autoRotate = true }, 2500)
      }
    }
    requestAnimationFrame(animateFly)
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

    if (dataPoints.length > 0) {
      this.flyTo(dataPoints[0].lat, dataPoints[0].lng)
    }
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
      const color = new THREE.Color().setHSL(hue, sat, lum)
      const capColor = new THREE.Color().setHSL(hue, 0.6, 0.85)

      const h = 0.04 + norm * 0.38
      const w = 0.006 + norm * 0.008
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
      const speed = 0.0005
      this.globe.rotation.y += speed
      Object.values(this.layerGroups).forEach(g => {
        g.rotation.y += speed
      })
      if (this.clouds) this.clouds.rotation.y += speed * 1.1
      if (this.baseAtmosphere) this.baseAtmosphere.rotation.copy(this.globe.rotation)
      if (this.atmosphere) this.atmosphere.rotation.copy(this.globe.rotation)
      if (this.innerAtmosphere) this.innerAtmosphere.rotation.copy(this.globe.rotation)
      if (this.starSphere) this.starSphere.rotation.y -= speed * 0.2
    }
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.animId)
    this.renderer.dispose()
  }
}