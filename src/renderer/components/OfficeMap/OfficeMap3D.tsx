import React, { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { useOfisStore } from '../../store/useOfisStore'

const TILE = 40
const COLS = 30
const ROWS = 20
const WALL_H = 20
const ROOM_H = 16
const FLOOR2_Y = 56
const EYE_H = 28

function woodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#d4a574'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 256, y = Math.random() * 256
    ctx.strokeStyle = `rgba(139,90,43,${Math.random() * 0.25 + 0.05})`
    ctx.lineWidth = Math.random() * 2 + 0.3
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 8,
      x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 8,
      x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 16)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(COLS / 2, ROWS / 2)
  tex.anisotropy = 4
  return tex
}

function grid() {
  const g: string[][] = []
  for (let r = 0; r < ROWS; r++) {
    const row: string[] = []
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) row.push('duvar')
      else if (r === 1 && c > 1 && c < COLS - 2 && c !== 10 && c !== 20) row.push('koridor')
      else row.push('zemin')
    }
    g.push(row)
  }
  return g
}

function masa(scene: THREE.Scene | THREE.Group, x: number, z: number, yBase = 0) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 })
  const top = new THREE.Mesh(new THREE.BoxGeometry(24, 1.5, 14), mat)
  top.position.set(x, yBase + 7, z)
  top.castShadow = true; top.receiveShadow = true
  scene.add(top)
  const legMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9 })
  for (const [dx, dz] of [[-10, -5], [10, -5], [-10, 5], [10, 5]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.5, 7, 1.5), legMat)
    l.position.set(x + dx, yBase + 3.5, z + dz)
    l.castShadow = true
    scene.add(l)
  }
}

function sandalye(scene: THREE.Scene | THREE.Group, x: number, z: number, yBase = 0, rot = 0) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rot
  const mat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.6 })
  const seat = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 10), mat)
  seat.position.set(0, yBase + 5, 0)
  seat.castShadow = true; seat.receiveShadow = true
  g.add(seat)
  const back = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 1.5), mat)
  back.position.set(0, yBase + 11, -5.5)
  back.castShadow = true
  g.add(back)
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a202c })
  for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5, 1.5), legMat)
    l.position.set(dx, yBase + 2.5, dz)
    l.castShadow = true
    g.add(l)
  }
  scene.add(g)
}

function bilgisayar(scene: THREE.Scene | THREE.Group, x: number, z: number, yBase = 0) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.3, metalness: 0.2 })
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 1), dark)
  monitor.position.set(x, yBase + 10.5, z - 4)
  monitor.castShadow = true
  scene.add(monitor)
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(9, 7, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, emissive: 0x1e3a5f, emissiveIntensity: 0.3 })
  )
  screen.position.set(x, yBase + 10.5, z - 3.4)
  scene.add(screen)
  for (const [s, yOff] of [[1.5, 6.5], [1.5, 6.5], [4, 5.25]] as const) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(s === 4 ? 4 : 1.5, s === 4 ? 0.5 : 3, s === 4 ? 3 : 1.5),
      dark
    )
    p.position.set(x, yBase + yOff, z - 4)
    scene.add(p)
  }
  const kb = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 3), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 }))
  kb.position.set(x, yBase + 7.25, z + 1)
  scene.add(kb)
}

function toplantiMasasi(scene: THREE.Scene | THREE.Group, x: number, z: number, w = 60, d = 30, yBase = 0) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.7, metalness: 0.1 })
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), mat)
  top.position.set(x, yBase + 7, z)
  top.castShadow = true; top.receiveShadow = true
  scene.add(top)
  const legMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9 })
  for (const [dx, dz] of [[-w / 2 + 4, -d / 2 + 4], [w / 2 - 4, -d / 2 + 4], [-w / 2 + 4, d / 2 - 4], [w / 2 - 4, d / 2 - 4]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(2, 7, 2), legMat)
    l.position.set(x + dx, yBase + 3.5, z + dz)
    l.castShadow = true
    scene.add(l)
  }
}

function mobilyaEkip(group: THREE.Group, x: number, z: number) {
  for (let i = 0; i < 3; i++) {
    const ox = 30 + i * 50
    sandalye(group, x + ox, z + 15)
    masa(group, x + ox, z + 30)
    bilgisayar(group, x + ox, z + 30)
  }
}

function aiKarakter(scene: THREE.Scene | THREE.Group, x: number, z: number, renk: string) {
  const color = new THREE.Color(renk)
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 10, 24, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.4, emissive: color, emissiveIntensity: 0.15 })
  )
  body.position.y = 12
  body.castShadow = true
  g.add(body)
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(7, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.2, emissive: 0x9333ea, emissiveIntensity: 0.3 })
  )
  head.position.y = 27
  head.castShadow = true
  g.add(head)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(10, 0.8, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x7c3aed, emissiveIntensity: 0.5, transparent: true, opacity: 0.6 })
  )
  ring.position.y = 14
  ring.rotation.x = Math.PI / 2
  g.add(ring)
  g.position.set(x, 0, z)
  scene.add(g)
  return g
}

function merdiven(scene: THREE.Scene) {
  const sm = new THREE.MeshStandardMaterial({ color: 0x718096, roughness: 0.7 })
  const n = Math.ceil(FLOOR2_Y / 8)
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(60, 8, 16), sm)
    s.position.set(COLS * TILE - 80, (i + 0.5) * 8, ROWS * TILE - 80 - i * 16)
    s.castShadow = true; s.receiveShadow = true
    scene.add(s)
  }
  const rm = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.5 })
  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, n * 16), rm)
    r.position.set(COLS * TILE - 80 + side * 31, FLOOR2_Y - 4, ROWS * TILE - 80 - (n - 1) * 8)
    scene.add(r)
  }
}

export function OfficeMap3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const labelRendererRef = useRef<CSS2DRenderer | null>(null)
  const animRef = useRef<number>(0)
  const roomGroupRef = useRef<THREE.Group>(new THREE.Group())
  const labelGroupRef = useRef<THREE.Group>(new THREE.Group())
  const aiCharsRef = useRef<THREE.Group[]>([])
  const yawRef = useRef(0)
  const pitchRef = useRef(0)
  const lockedRef = useRef(false)
  const keysRef = useRef<Set<string>>(new Set())
  const currentFloorRef = useRef(1)
  const kat2LabelRefs = useRef<CSS2DObject[]>([])
  const chairPositionsRef = useRef<{ x: number; z: number; yBase: number }[]>([])
  const sittingRef = useRef(false)
  const prevCamPosRef = useRef<{ x: number; y: number; z: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const w = el.clientWidth, h = el.clientHeight

    const sc = new THREE.Scene()
    sc.background = new THREE.Color(0x1a202c)
    sc.fog = new THREE.Fog(0x1a202c, 900, 1800)
    sceneRef.current = sc

    const cam = new THREE.PerspectiveCamera(72, w / h, 0.5, 2000)
    const k0 = useOfisStore.getState().kullanici
    cam.position.set(k0?.konum_x || 400, EYE_H, k0?.konum_y || 300)
    cameraRef.current = cam

    const ren = new THREE.WebGLRenderer({ antialias: true })
    ren.setSize(w, h)
    ren.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    ren.shadowMap.enabled = true
    ren.shadowMap.type = THREE.PCFSoftShadowMap
    ren.toneMapping = THREE.ACESFilmicToneMapping
    ren.toneMappingExposure = 1.2
    el.appendChild(ren.domElement)
    rendererRef.current = ren

    const lr = new CSS2DRenderer()
    lr.setSize(w, h)
    lr.domElement.style.position = 'absolute'
    lr.domElement.style.top = '0'
    lr.domElement.style.left = '0'
    lr.domElement.style.pointerEvents = 'none'
    el.appendChild(lr.domElement)
    labelRendererRef.current = lr

    sc.add(new THREE.AmbientLight(0x404070, 0.4))
    sc.add(new THREE.HemisphereLight(0x87ceeb, 0x362d59, 0.6))

    const dl = new THREE.DirectionalLight(0xffeedd, 1.5)
    dl.position.set(COLS * TILE / 2, 400, 200)
    dl.castShadow = true
    dl.shadow.mapSize.width = 2048
    dl.shadow.mapSize.height = 2048
    dl.shadow.camera.near = 1
    dl.shadow.camera.far = 800
    dl.shadow.camera.left = -800
    dl.shadow.camera.right = 800
    dl.shadow.camera.top = 800
    dl.shadow.camera.bottom = -800
    sc.add(dl)
    const fl = new THREE.DirectionalLight(0x8888ff, 0.3)
    fl.position.set(-300, 200, -400)
    sc.add(fl)

    const woodTex = woodTexture()
    const g = grid()
    const tileGeo = new THREE.BoxGeometry(TILE, 1, TILE)

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE + TILE / 2, z = r * TILE + TILE / 2
        const tile = g[r][c]
        if (tile === 'duvar') {
          const m = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.85 }))
          m.position.set(x, WALL_H / 2, z)
          m.scale.y = WALL_H
          m.castShadow = true; m.receiveShadow = true
          sc.add(m)
        } else {
          const m = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85, metalness: 0.05 }))
          m.position.set(x, 0.5, z)
          m.receiveShadow = true
          sc.add(m)
        }
      }
    }

    const nSteps = Math.ceil(FLOOR2_Y / 8)
    const stairZEnd = ROWS * TILE - 80 - nSteps * 16
    const stairZStart = ROWS * TILE - 80

    const slabMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide })
    const hl = COLS * TILE - 80 - 38
    const hr = COLS * TILE - 80 + 38
    const hb = ROWS * TILE - 80 + 10
    const ht = ROWS * TILE - 80 - nSteps * 16 - 10
    function slabBox(w: number, d: number, cx: number, cz: number) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), slabMat)
      m.position.set(cx, FLOOR2_Y, cz)
      m.receiveShadow = true
      sc.add(m)
    }
    slabBox(COLS * TILE, ht, COLS * TILE / 2, ht / 2)
    slabBox(hl, hb - ht, hl / 2, ht + (hb - ht) / 2)
    slabBox(COLS * TILE - hr, hb - ht, hr + (COLS * TILE - hr) / 2, ht + (hb - ht) / 2)
    slabBox(COLS * TILE, ROWS * TILE - hb, COLS * TILE / 2, hb + (ROWS * TILE - hb) / 2)

    merdiven(sc)

    const tx = COLS * TILE / 2, tz = ROWS * TILE / 2, tw = 300, td = 200
    const tMat = new THREE.MeshStandardMaterial({ color: 0x6b7b8d, roughness: 0.8, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    for (const [s, p] of [
      [[tw, WALL_H, 1], [tx, FLOOR2_Y + WALL_H / 2, tz - td / 2]] as const,
      [[tw, WALL_H, 1], [tx, FLOOR2_Y + WALL_H / 2, tz + td / 2]] as const,
      [[1, WALL_H, td], [tx - tw / 2, FLOOR2_Y + WALL_H / 2, tz]] as const,
      [[1, WALL_H, td], [tx + tw / 2, FLOOR2_Y + WALL_H / 2, tz]] as const,
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), tMat)
      m.position.set(p[0], p[1], p[2])
      m.castShadow = true; m.receiveShadow = true
      sc.add(m)
    }

    toplantiMasasi(sc, tx, tz, tw - 80, td - 80, FLOOR2_Y)
    const chairs2: { x: number; z: number; yBase: number }[] = []
    const tChairPositions: [number, number][] = [
      [tx, tz - td / 2 + 20], [tx, tz + td / 2 - 20],
      [tx - tw / 2 + 20, tz], [tx + tw / 2 - 20, tz],
      [tx - 40, tz - td / 2 + 20], [tx + 40, tz + td / 2 - 20],
    ]
    for (const [sx, sz] of tChairPositions) {
      const angle = Math.atan2(tx - sx, tz - sz)
      sandalye(sc, sx, sz, FLOOR2_Y, angle)
      chairs2.push({ x: sx, z: sz, yBase: FLOOR2_Y })
    }

    chairPositionsRef.current.push(...chairs2)

    const tDiv = document.createElement('div')
    tDiv.style.cssText = 'color:#e2e8f0;font-size:14px;font-weight:bold;text-shadow:0 2px 6px rgba(0,0,0,0.9);background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:6px;pointer-events:none;'
    tDiv.textContent = '🏢 Toplantı Salonu'
    const tLabel = new CSS2DObject(tDiv)
    tLabel.position.set(tx, FLOOR2_Y + WALL_H + 4, tz - td / 2)
    sc.add(tLabel)
    tLabel.visible = false
    kat2LabelRefs.current.push(tLabel)

    const katDiv = document.createElement('div')
    katDiv.style.cssText = 'color:#94a3b8;font-size:11px;text-shadow:0 1px 3px rgba(0,0,0,0.8);background:rgba(0,0,0,0.6);padding:2px 8px;border-radius:4px;pointer-events:none;'
    katDiv.textContent = '2. Kat — Toplantı Salonu'
    const katLabel = new CSS2DObject(katDiv)
    katLabel.position.set(tx, FLOOR2_Y + 2, tz)
    sc.add(katLabel)
    katLabel.visible = false
    kat2LabelRefs.current.push(katLabel)

    sc.add(roomGroupRef.current)
    sc.add(labelGroupRef.current)

    function anim() {
      animRef.current = requestAnimationFrame(anim)
      const pressed = keysRef.current
      const sitting = sittingRef.current

      if (lockedRef.current && !sitting && pressed.size > 0) {
        const yaw = yawRef.current
        const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
        const rgt = new THREE.Vector3(-fwd.z, 0, fwd.x)
        const spd = 8
        let dx = 0, dz = 0
        if (pressed.has('w') || pressed.has('W') || pressed.has('ArrowUp')) { dx += fwd.x * spd; dz += fwd.z * spd }
        if (pressed.has('s') || pressed.has('S') || pressed.has('ArrowDown')) { dx -= fwd.x * spd; dz -= fwd.z * spd }
        if (pressed.has('a') || pressed.has('A') || pressed.has('ArrowLeft')) { dx -= rgt.x * spd; dz -= rgt.z * spd }
        if (pressed.has('d') || pressed.has('D') || pressed.has('ArrowRight')) { dx += rgt.x * spd; dz += rgt.z * spd }
        if (dx !== 0 || dz !== 0) {
          const k = useOfisStore.getState().kullanici
          if (k) {
            const nx = Math.max(0, Math.min(COLS * TILE, k.konum_x + dx))
            const nz = Math.max(0, Math.min(ROWS * TILE, k.konum_y + dz))
            cam.position.x = nx; cam.position.z = nz
            useOfisStore.getState().kullaniciHareket(nx - k.konum_x, nz - k.konum_y)
          }
        }
      }

      const px = cam.position.x
      const pz = cam.position.z
      const inStairX = px >= COLS * TILE - 110 && px <= COLS * TILE - 50

      if (inStairX && pz >= stairZEnd && pz <= stairZStart) {
        let targetY = cam.position.y > FLOOR2_Y + 8 ? FLOOR2_Y + EYE_H : EYE_H
        for (let i = 0; i < nSteps; i++) {
          const stepZ = ROWS * TILE - 80 - i * 16
          if (pz >= stepZ - 8 && pz <= stepZ + 8) {
            targetY = (i + 0.5) * 8 + EYE_H
            break
          }
        }
        cam.position.y += (targetY - cam.position.y) * 0.25
      } else {
        const floorY = cam.position.y > FLOOR2_Y ? FLOOR2_Y + EYE_H : EYE_H
        cam.position.y = floorY
      }

      const onStairsNow = inStairX && pz >= stairZEnd - 16 && pz <= stairZStart + 16
      let newFloor = currentFloorRef.current
      if (!onStairsNow) {
        newFloor = cam.position.y > FLOOR2_Y + 8 ? 2 : 1
      }
      if (newFloor !== currentFloorRef.current) {
        currentFloorRef.current = newFloor
        useOfisStore.getState().setCurrentFloor(newFloor)
        for (const l of kat2LabelRefs.current) l.visible = newFloor === 2
        labelGroupRef.current.visible = newFloor === 1
      }

      if (!sitting) {
        let closest = -1
        let minDist = 40
        const chairs = chairPositionsRef.current
        for (let i = 0; i < chairs.length; i++) {
          const c = chairs[i]
          const d = Math.sqrt((px - c.x) ** 2 + (pz - c.z) ** 2)
          if (d < minDist) { minDist = d; closest = i }
        }
        const store = useOfisStore.getState()
        if (closest >= 0) {
          store.setSitPrompt('E: Otur')
        } else {
          store.setSitPrompt('')
        }
      }

      cam.quaternion.setFromEuler(new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ'))
      ren.render(sc, cam)
      lr.render(sc, cam)
    }
    anim()

    const onResize = () => {
      const cw = el.clientWidth, ch = el.clientHeight
      cam.aspect = cw / ch
      cam.updateProjectionMatrix()
      ren.setSize(cw, ch)
      lr.setSize(cw, ch)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animRef.current)
      ren.dispose()
      window.removeEventListener('resize', onResize)
      el.removeChild(ren.domElement)
      el.removeChild(lr.domElement)
    }
  }, [])

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!lockedRef.current) return
      yawRef.current -= e.movementX * 0.003
      pitchRef.current -= e.movementY * 0.003
      pitchRef.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitchRef.current))
    }
    const onLock = () => {
      lockedRef.current = document.pointerLockElement === rendererRef.current?.domElement
      if (!lockedRef.current) keysRef.current.clear()
    }
    document.addEventListener('mousemove', onMouse)
    document.addEventListener('pointerlockchange', onLock)
    return () => { document.removeEventListener('mousemove', onMouse); document.removeEventListener('pointerlockchange', onLock) }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.type === 'keydown' && (e.key === 'e' || e.key === 'E')) {
        const sitting = sittingRef.current
        const cam = cameraRef.current
        if (!cam) return
        if (sitting) {
          const prev = prevCamPosRef.current
          if (prev) {
            cam.position.set(prev.x, prev.y, prev.z)
          }
          sittingRef.current = false
          useOfisStore.getState().setIsSitting(false)
          useOfisStore.getState().setSitPrompt('')
        } else {
          const chairs = chairPositionsRef.current
          const px = cam.position.x
          const pz = cam.position.z
          let closest = -1
          let minDist = 30
          for (let i = 0; i < chairs.length; i++) {
            const c = chairs[i]
            const d = Math.sqrt((px - c.x) ** 2 + (pz - c.z) ** 2)
            if (d < minDist) { minDist = d; closest = i }
          }
          if (closest >= 0) {
            prevCamPosRef.current = { x: cam.position.x, y: cam.position.y, z: cam.position.z }
            const c = chairs[closest]
            cam.position.set(c.x, c.yBase + 12, c.z)
            sittingRef.current = true
            useOfisStore.getState().setIsSitting(true)
            useOfisStore.getState().setSitPrompt('E: Kalk')
          }
        }
        e.preventDefault()
        return
      }
      if (e.type === 'keydown') keysRef.current.add(e.key)
      else keysRef.current.delete(e.key)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey) }
  }, [])

  const ekipler = useOfisStore((s) => s.ekipler)
  const ekipGruplari = useOfisStore((s) => s.ekipGruplari)

  useEffect(() => {
    const group = roomGroupRef.current
    const labelGroup = labelGroupRef.current
    while (group.children.length) group.remove(group.children[0])
    while (labelGroup.children.length) labelGroup.remove(labelGroup.children[0])
    for (const c of aiCharsRef.current) c.parent?.remove(c)
    aiCharsRef.current = []
    chairPositionsRef.current = []

    for (const ekip of ekipler) {
      const grp = ekipGruplari.find((g) => g.id === ekip.ekip_grubu_id)
      const color = new THREE.Color(grp?.renk || '#4A90D9')
      const ex = ekip.oda_konum_x + ekip.oda_genislik / 2
      const ez = ekip.oda_konum_y + ekip.oda_yukseklik / 2

      const roomMat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.12, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide })
      const rm = new THREE.Mesh(new THREE.BoxGeometry(ekip.oda_genislik, ROOM_H, ekip.oda_yukseklik), roomMat)
      rm.position.set(ex, ROOM_H / 2, ez)
      rm.receiveShadow = true
      group.add(rm)

      const el = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(ekip.oda_genislik, ROOM_H, ekip.oda_yukseklik)),
        new THREE.LineBasicMaterial({ color })
      )
      el.position.copy(rm.position)
      group.add(el)

      const d = document.createElement('div')
      d.style.cssText = 'color:#e2e8f0;font-size:11px;font-weight:bold;text-shadow:0 1px 4px rgba(0,0,0,0.9);background:rgba(0,0,0,0.65);padding:2px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;'
      d.textContent = ekip.ad
      const l = new CSS2DObject(d)
      l.position.set(ekip.oda_konum_x + 8, ROOM_H + 1, ekip.oda_konum_y + 8)
      labelGroup.add(l)

      if (ekip.yonetici_adi || ekip.ai_model_adi) {
        const sd = document.createElement('div')
        const p: string[] = []
        if (ekip.yonetici_adi) p.push(`👤 ${ekip.yonetici_adi}`)
        if (ekip.ai_model_adi) p.push(`🤖 ${ekip.ai_model_adi}`)
        sd.style.cssText = 'color:#94a3b8;font-size:9px;text-shadow:0 1px 3px rgba(0,0,0,0.8);background:rgba(0,0,0,0.5);padding:1px 6px;border-radius:3px;white-space:nowrap;pointer-events:none;'
        sd.textContent = p.join('  ')
        const sl = new CSS2DObject(sd)
        sl.position.set(ekip.oda_konum_x + 8, ROOM_H - 5, ekip.oda_konum_y + 8)
        labelGroup.add(sl)
      }

      mobilyaEkip(group, ekip.oda_konum_x, ekip.oda_konum_y)
      for (let i = 0; i < 3; i++) {
        const ox = 30 + i * 50
        chairPositionsRef.current.push({ x: ekip.oda_konum_x + ox, z: ekip.oda_konum_y + 15, yBase: 0 })
      }

      if (ekip.ai_model_id) {
        const ai = aiKarakter(group, ekip.oda_konum_x + 100, ekip.oda_konum_y + 40, grp?.renk || '#9333ea')
        aiCharsRef.current.push(ai)
      }
    }
  }, [ekipler, ekipGruplari])

  useEffect(() => {
    const unsub = useOfisStore.subscribe((s) => {
      const k = s.kullanici
      if (!k || !cameraRef.current) return
      if (!lockedRef.current) {
        cameraRef.current.position.x = k.konum_x
        cameraRef.current.position.z = k.konum_y
      }
    })
    const k = useOfisStore.getState().kullanici
    if (k && cameraRef.current) {
      cameraRef.current.position.x = k.konum_x
      cameraRef.current.position.z = k.konum_y
    }
    return () => unsub()
  }, [])

  const onClick = useCallback(() => {
    rendererRef.current?.domElement.requestPointerLock()
  }, [])

  const currentFloorStore = useOfisStore((s) => s.currentFloor)
  const setAktifPanel = useOfisStore((s) => s.setAktifPanel)
  const bildirimGoster = useOfisStore((s) => s.bildirimGoster)
  const sitPrompt = useOfisStore((s) => s.sitPrompt)

  const toplantiCagir = useCallback(() => {
    setAktifPanel('sohbet')
    bildirimGoster('Toplantı odasına hoş geldiniz!', 'bilgi')
  }, [setAktifPanel, bildirimGoster])

  return (
    <div ref={containerRef} className="flex-1 relative" onClick={onClick} style={{ width: '100%', height: '100%' }}>
      <div className="absolute bottom-4 left-4 bg-gray-900/80 px-3 py-2 rounded text-xs text-gray-400 z-10 pointer-events-none select-none">
        Tıkla ve fareyi kilitle &middot; WASD ile yürü &middot; Fare ile bak &middot; ESC çıkış &middot; Merdiven sağ arkada
      </div>
      {currentFloorStore === 2 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); toplantiCagir() }}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg text-lg transition-colors cursor-pointer"
          >
            🏢 Toplantıya Katıl
          </button>
        </div>
      )}
      {sitPrompt && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-gray-900/80 px-5 py-2 rounded-full text-sm text-white select-none pointer-events-none">
          {sitPrompt}
        </div>
      )}
    </div>
  )
}
