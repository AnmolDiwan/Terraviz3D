import * as THREE from 'three'
import { uniform } from 'three/src/nodes/core/UniformNode.js'

export class GlobeEngine {
  constructor(canvas, onMarkerClick) {
    this.canvas = canvas
    this.onMarkerClick = onMarkerClick
    this.isDragging = false
    this.prevMouse = { x: 0, y: 0 }
    this.autoRotate = true
    this.markers = new THREE.Group()
    this.init()
  }

  init() {
    // Scene
    this.scene = new THREE.Scene()

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    this.camera.position.z = 2.5

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(5, 3, 5)
    this.scene.add(sun)

    this.buildGlobe()
    this.buildAtmosphere()
    this.scene.add(this.markers)
    this.bindEvents()
    this.animate()
  }

  buildGlobe() {
    const loader = new THREE.TextureLoader()
    const geometry = new THREE.SphereGeometry(1, 64, 64)
    const material = new THREE.MeshPhongMaterial({
      map: loader.load('/textures/earth_day.jpg'),
      bumpMap: loader.load('/textures/earth_bump.jpg'),
      bumpScale: 0.005,
      specular: new THREE.Color(0x333333),
    })
    this.globe = new THREE.Mesh(geometry, material)
    this.scene.add(this.globe)
  }

  buildAtmosphere() {
    const geometry = new THREE.SphereGeometry(1.05, 64, 64)
    const material = new THREE.ShaderMaterial({
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
          float intensity = pow(0.65 - dot(vNormal, vec3(0,0,1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    })
    this.atmosphere = new THREE.Mesh(geometry, material)
    this.scene.add(this.atmosphere)
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
      this.markers.rotation.copy(this.globe.rotation)
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

    // Click → raycast for marker selection
    c.addEventListener('click', (e) => {
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, this.camera)
      const hits = raycaster.intersectObjects(this.markers.children)
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

  // Convert lat/lng to 3D point on sphere
  latLngToVec3(lat, lng, radius = 1.001) {
    const phi   = (90 - lat) * (Math.PI / 180)
    const theta = (lng + 180) * (Math.PI / 180)
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
       radius * Math.cos(phi),
       radius * Math.sin(phi) * Math.sin(theta)
    )
  }

  // Render data markers on the globe
  renderMarkers(dataPoints, type = 'cylinder') {
  this.markers.clear()
  dataPoints.forEach((dp) => {
    const norm  = Math.min(dp.magnitude / 10, 1)
    const color = new THREE.Color().setHSL(0.0, 1, 0.5 + norm * 0.3)
    const h = 0.15 + norm * 0.6

    let geo
    if (type === 'cylinder') {
      geo = new THREE.CylinderGeometry(0.01, 0.01, h, 8)
      geo.translate(0, h / 2, 0)
    } else {
      geo = new THREE.SphereGeometry(0.015 + norm * 0.03, 8, 8)
    }

    const mat  = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 1.5 })
    const mesh = new THREE.Mesh(geo, mat)

    const pos     = this.latLngToVec3(dp.lat, dp.lng)
    const outward = pos.clone().normalize()

    // point the cylinder outward from globe center
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward)
    mesh.position.copy(pos)
    mesh.userData = { dataPoint: dp }
    this.markers.add(mesh)
  })

  this.markers.rotation.copy(this.globe.rotation)
}

  clearMarkers() {
    this.markers.clear()
  }

  animate() {
    this.animId = requestAnimationFrame(this.animate.bind(this))
    if (this.autoRotate) {
      this.globe.rotation.y   += 0.0005
      this.markers.rotation.y += 0.0005
    }
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.animId)
    this.renderer.dispose()
  }
}