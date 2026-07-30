import React, { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { useOfisStore } from '../../store/useOfisStore'

const TILE_SIZE = 40
const MAP_COLS = 30
const MAP_ROWS = 20
const WALL_HEIGHT = 20
const ROOM_HEIGHT = 16

function createGrid() {
  const grid: string[][] = []
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: string[] = []
    for (let c = 0; c < MAP_COLS; c++) {
      if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) {
        row.push('duvar')
      } else if (r === 1 && c > 1 && c < MAP_COLS - 2 && c !== 10 && c !== 20) {
        row.push('koridor')
      } else {
        row.push('zemin')
      }
    }
    grid.push(row)
  }
  return grid
}

export function OfficeMap3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const labelRendererRef = useRef<CSS2DRenderer | null>(null)
  const animFrameRef = useRef<number>(0)
  const roomGroupRef = useRef<THREE.Group>(new THREE.Group())
  const labelGroupRef = useRef<THREE.Group>(new THREE.Group())
  const characterRef = useRef<THREE.Group | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const w = container.clientWidth
    const h = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a202c)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 3000)
    camera.position.set(800, 600, 800)
    camera.lookAt(600, 0, 400)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(w, h)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.left = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(labelRenderer.domElement)
    labelRendererRef.current = labelRenderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(600, 0, 400)
    controls.maxPolarAngle = Math.PI / 2.1
    controls.minDistance = 200
    controls.maxDistance = 1500
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controlsRef.current = controls

    const ambientLight = new THREE.AmbientLight(0x404060, 0.6)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(400, 500, 300)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    dirLight.shadow.camera.near = 1
    dirLight.shadow.camera.far = 1200
    dirLight.shadow.camera.left = -800
    dirLight.shadow.camera.right = 800
    dirLight.shadow.camera.top = 800
    dirLight.shadow.camera.bottom = -800
    scene.add(dirLight)

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3)
    fillLight.position.set(-300, 200, -200)
    scene.add(fillLight)

    const grid = createGrid()
    const tileGeo = new THREE.BoxGeometry(TILE_SIZE, 1, TILE_SIZE)

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const x = c * TILE_SIZE + TILE_SIZE / 2
        const z = r * TILE_SIZE + TILE_SIZE / 2
        const tile = grid[r][c]

        if (tile === 'duvar') {
          const mat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.8 })
          const mesh = new THREE.Mesh(tileGeo, mat)
          mesh.position.set(x, WALL_HEIGHT / 2, z)
          mesh.scale.y = WALL_HEIGHT
          mesh.castShadow = true
          mesh.receiveShadow = true
          scene.add(mesh)
        } else {
          const color = tile === 'koridor' ? 0xcbd5e0 : 0xe2e8f0
          const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
          const mesh = new THREE.Mesh(tileGeo, mat)
          mesh.position.set(x, 0.5, z)
          mesh.receiveShadow = true
          scene.add(mesh)
        }
      }
    }

    scene.add(roomGroupRef.current)
    scene.add(labelGroupRef.current)

    const charGroup = new THREE.Group()
    const bodyGeo = new THREE.CylinderGeometry(10, 12, 28, 8)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4299e1, roughness: 0.5, metalness: 0.1 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 14
    body.castShadow = true
    charGroup.add(body)

    const headGeo = new THREE.SphereGeometry(8, 12, 12)
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 })
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 30
    head.castShadow = true
    charGroup.add(head)

    const k = useOfisStore.getState().kullanici
    if (k) {
      charGroup.position.x = k.konum_x
      charGroup.position.z = k.konum_y
    }
    scene.add(charGroup)
    characterRef.current = charGroup

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    }
    animate()

    function handleResize() {
      const c = container
      if (!c) return
      const cw = c.clientWidth
      const ch = c.clientHeight
      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
      renderer.setSize(cw, ch)
      labelRenderer.setSize(cw, ch)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      controls.dispose()
      renderer.dispose()
      window.removeEventListener('resize', handleResize)
      if (renderer.domElement.parentNode) container.removeChild(renderer.domElement)
      if (labelRenderer.domElement.parentNode) container.removeChild(labelRenderer.domElement)
    }
  }, [])

  const ekipler = useOfisStore((s) => s.ekipler)
  const ekipGruplari = useOfisStore((s) => s.ekipGruplari)

  useEffect(() => {
    const group = roomGroupRef.current
    const labelGroup = labelGroupRef.current
    while (group.children.length) group.remove(group.children[0])
    while (labelGroup.children.length) labelGroup.remove(labelGroup.children[0])

    for (const ekip of ekipler) {
      const grp = ekipGruplari.find((g) => g.id === ekip.ekip_grubu_id)
      const color = new THREE.Color(grp?.renk || '#4A90D9')
      const ex = ekip.oda_konum_x + ekip.oda_genislik / 2
      const ez = ekip.oda_konum_y + ekip.oda_yukseklik / 2
      const ew = ekip.oda_genislik
      const eh = ekip.oda_yukseklik

      const roomMat = new THREE.MeshStandardMaterial({
        color, transparent: true, opacity: 0.15,
        roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide,
      })
      const roomGeo = new THREE.BoxGeometry(ew, ROOM_HEIGHT, eh)
      const roomMesh = new THREE.Mesh(roomGeo, roomMat)
      roomMesh.position.set(ex, ROOM_HEIGHT / 2, ez)
      roomMesh.receiveShadow = true
      group.add(roomMesh)

      const edgeMat = new THREE.LineBasicMaterial({ color })
      const edgeGeo = new THREE.EdgesGeometry(roomGeo)
      const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat)
      edgeLine.position.copy(roomMesh.position)
      group.add(edgeLine)

      const div = document.createElement('div')
      div.style.color = '#e2e8f0'
      div.style.fontSize = '12px'
      div.style.fontWeight = 'bold'
      div.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)'
      div.style.background = 'rgba(0,0,0,0.6)'
      div.style.padding = '2px 8px'
      div.style.borderRadius = '4px'
      div.style.whiteSpace = 'nowrap'
      div.textContent = ekip.ad
      const label = new CSS2DObject(div)
      label.position.set(ekip.oda_konum_x + 8, ROOM_HEIGHT + 2, ekip.oda_konum_y + 8)
      labelGroup.add(label)

      if (ekip.yonetici_adi || ekip.ai_model_adi) {
        const subDiv = document.createElement('div')
        subDiv.style.color = '#94a3b8'
        subDiv.style.fontSize = '10px'
        subDiv.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)'
        subDiv.style.background = 'rgba(0,0,0,0.5)'
        subDiv.style.padding = '1px 6px'
        subDiv.style.borderRadius = '3px'
        subDiv.style.whiteSpace = 'nowrap'
        const parts: string[] = []
        if (ekip.yonetici_adi) parts.push(`👤 ${ekip.yonetici_adi}`)
        if (ekip.ai_model_adi) parts.push(`🤖 ${ekip.ai_model_adi}`)
        subDiv.textContent = parts.join('  ')
        const subLabel = new CSS2DObject(subDiv)
        subLabel.position.set(ekip.oda_konum_x + 8, ROOM_HEIGHT - 4, ekip.oda_konum_y + 8)
        labelGroup.add(subLabel)
      }
    }
  }, [ekipler, ekipGruplari])

  useEffect(() => {
    const char = characterRef.current
    if (!char) return
    const unsub = useOfisStore.subscribe((s) => {
      const k = s.kullanici
      if (k) {
        char.position.x = k.konum_x
        char.position.z = k.konum_y
      }
    })
    const k = useOfisStore.getState().kullanici
    if (k) {
      char.position.x = k.konum_x
      char.position.z = k.konum_y
    }
    return () => unsub()
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const { kullaniciHareket } = useOfisStore.getState()
      const step = 12
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': kullaniciHareket(0, -step); break
        case 'ArrowDown': case 's': case 'S': kullaniciHareket(0, step); break
        case 'ArrowLeft': case 'a': case 'A': kullaniciHareket(-step, 0); break
        case 'ArrowRight': case 'd': case 'D': kullaniciHareket(step, 0); break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    const scene = sceneRef.current
    const k = useOfisStore.getState().kullanici
    if (!renderer || !camera || !scene || !k) return

    const rect = renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)

    const floorMeshes: THREE.Mesh[] = []
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.position.y === 0.5) floorMeshes.push(obj as THREE.Mesh)
    })

    const intersects = raycaster.intersectObjects(floorMeshes)
    if (intersects.length > 0) {
      const point = intersects[0].point
      const dx = point.x - k.konum_x
      const dz = point.z - k.konum_y
      useOfisStore.getState().kullaniciHareket(dx, dz)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex-1 relative"
      onClick={handleClick}
      style={{ width: '100%', height: '100%' }}
    >
      <div className="absolute bottom-4 left-4 bg-gray-900/80 px-3 py-2 rounded text-xs text-gray-400 z-10 pointer-events-none select-none">
        WASD / Ok tuşları ile hareket · Sol tık ile git · Sağ tık sürükle kamera döndür
      </div>
    </div>
  )
}
