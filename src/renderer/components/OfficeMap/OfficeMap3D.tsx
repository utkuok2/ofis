import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { useOfisStore } from '../../store/useOfisStore'
import { uzakKarakterOlustur } from './RemotePlayer'
import { herkeseGonder } from '../../services/peerService'
import { tahtaGuncelleGonder, gorevSenkronla } from '../../services/multiplayerService'
import { gorevDurumGuncelle } from '../../services/dbService'
import { ProjePaneli } from './ProjePaneli'
import type { Ekip } from '../../types'

const TILE = 45
const COLS = 30
const ROWS = 20
const WALL_H = 20
const ROOM_H = 16
const FLOOR2_Y = 56
const EYE_H = 28

const GEZINME_NOKTALARI = [
  { x: 280, z: 240 }, { x: 280, z: 500 }, { x: 280, z: 700 },
  { x: 600, z: 240 }, { x: 600, z: 500 }, { x: 600, z: 700 },
  { x: 900, z: 240 }, { x: 900, z: 500 }, { x: 900, z: 700 },
  { x: 1200, z: 240 }, { x: 1200, z: 500 }, { x: 1200, z: 700 },
  { x: 280, z: 60 }, { x: 600, z: 60 }, { x: 900, z: 60 }, { x: 1200, z: 60 },
]
const SOSYAL_NOKTALAR = [
  { x: 130, z: 60 }, { x: 472, z: 72 }, { x: 900, z: 72 },
  { x: 600, z: 770 }, { x: 440, z: 82 }, { x: 890, z: 82 },
]
const KAT2_BATI_NOKTALARI = [{ x: 200, z: 385 }, { x: 300, z: 760 }, { x: 500, z: 385 }]
const KAT2_DOGU_NOKTALARI = [{ x: 1000, z: 385 }, { x: 900, z: 600 }, { x: 1200, z: 450 }, { x: 1200, z: 650 }]

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

function kitaplik(scene: THREE.Scene | THREE.Group, x: number, z: number, yBase = 0, rot = 0) {
  const g = new THREE.Group()
  g.position.set(x, yBase, z)
  g.rotation.y = rot
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.7 })
  const w = 16, h = 26, d = 6
  for (const [dx, dy, dw, dh, dd] of [
    [-w / 2, h / 2, 1.5, h, d], [w / 2, h / 2, 1.5, h, d], [0, h / 2, w, 1.5, d], [0, 1, w, 1.5, d]
  ] as [number, number, number, number, number][]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dd), frameMat)
    m.position.set(dx, dy, 0)
    m.castShadow = true
    g.add(m)
  }
  const bookColors = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085]
  for (const s of [8, 14, 20]) {
    for (let j = 0; j < 8; j++) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 3.5 + (j % 3) * 1.5, 3.5),
        new THREE.MeshStandardMaterial({ color: bookColors[(s + j) % bookColors.length], roughness: 0.9 })
      )
      b.position.set(-w / 2 + 2.2 + j * 1.35, s + 2.75 + (j % 3) * 0.5, -1.2)
      b.castShadow = true
      g.add(b)
    }
  }
  scene.add(g)
}

function yazTahtasi(scene: THREE.Scene | THREE.Group, x: number, z: number, yBase = 0, rot = 0) {
  const g = new THREE.Group()
  g.position.set(x, yBase, z)
  g.rotation.y = rot
  const board = new THREE.Mesh(new THREE.BoxGeometry(24, 14, 0.6), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }))
  board.position.set(0, 16, 0)
  board.castShadow = true
  g.add(board)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 })
  for (const [dx, dy, dw, dh] of [[-12, 16, 0.8, 14], [12, 16, 0.8, 14], [0, 9.2, 24.8, 0.8], [0, 22.8, 24.8, 0.8]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.7), frameMat)
    m.position.set(dx, dy, 0)
    g.add(m)
  }
  for (const dx of [-10, 10]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), frameMat)
    l.position.set(dx, 4.5, 0)
    l.castShadow = true
    g.add(l)
  }
  const tray = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 2), frameMat)
  tray.position.set(0, 3, 1.5)
  g.add(tray)
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 3), new THREE.MeshStandardMaterial({ color: 0xe53e3e }))
  marker.position.set(-8, 3.6, 2)
  g.add(marker)
  scene.add(g)
}

function dosyaDolabi(scene: THREE.Scene | THREE.Group, x: number, z: number, yBase = 0, rot = 0) {
  const g = new THREE.Group()
  g.position.set(x, yBase, z)
  g.rotation.y = rot
  const body = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 7), new THREE.MeshStandardMaterial({ color: 0x718096, roughness: 0.5, metalness: 0.4 }))
  body.position.set(0, 7, 0)
  body.castShadow = true
  g.add(body)
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, metalness: 0.6 })
  for (const dy of [5, 12]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 0.8), handleMat)
    h.position.set(0, dy, 3.6)
    g.add(h)
  }
  scene.add(g)
}

function bitki(scene: THREE.Scene | THREE.Group, x: number, z: number, k = 1, yBase = 0) {
  const g = new THREE.Group()
  g.position.set(x, yBase, z)
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(5 * k, 3.5 * k, 6 * k, 10), new THREE.MeshStandardMaterial({ color: 0xb5533a, roughness: 0.8 }))
  pot.position.set(0, 3 * k, 0)
  pot.castShadow = true
  g.add(pot)
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(4.6 * k, 4.6 * k, 1 * k, 10), new THREE.MeshStandardMaterial({ color: 0x3b2a1a }))
  soil.position.set(0, 6 * k, 0)
  g.add(soil)
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.2 * k, 10 * k, 1.2 * k), new THREE.MeshStandardMaterial({ color: 0x5d4037 }))
  trunk.position.set(0, 11 * k, 0)
  g.add(trunk)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9e44, roughness: 0.8 })
  for (const [dx, dy, dz, r] of [[0, 18 * k, 0, 6 * k], [4 * k, 15 * k, 2 * k, 3.5 * k], [-3.5 * k, 16 * k, -3 * k, 3 * k], [2 * k, 14 * k, -4 * k, 2.5 * k]]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), leafMat)
    s.position.set(dx, dy, dz)
    s.castShadow = true
    g.add(s)
  }
  scene.add(g)
}

function hali(scene: THREE.Scene | THREE.Group, x: number, z: number, w: number, d: number, color = 0x2c5282, yBase = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }))
  m.position.set(x, yBase + 0.08, z)
  m.receiveShadow = true
  scene.add(m)
}

function bank(scene: THREE.Scene | THREE.Group, x: number, z: number, rot = 0) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rot
  const wood = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 })
  const seat = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 6), wood)
  seat.position.set(0, 4, 0)
  seat.castShadow = true
  g.add(seat)
  const back = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 1.5), wood)
  back.position.set(0, 8.5, -3.5)
  back.castShadow = true
  g.add(back)
  const legMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 })
  for (const dx of [-7, 7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 1.5), legMat)
    l.position.set(dx, 2, 0)
    g.add(l)
  }
  scene.add(g)
}

function tavanLambasi(scene: THREE.Scene | THREE.Group, x: number, z: number, y: number) {
  const g = new THREE.Group()
  const housing = new THREE.Mesh(new THREE.BoxGeometry(20, 1.5, 10), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 }))
  g.add(housing)
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff6e5, emissive: 0xfff1d6, emissiveIntensity: 2 })
  )
  panel.position.set(0, -1, 0)
  g.add(panel)
  g.position.set(x, y, z)
  scene.add(g)
}

function resepsiyon(scene: THREE.Scene | THREE.Group, x: number, z: number, yBase = 0, rot = 0) {
  const g = new THREE.Group()
  g.position.set(x, yBase, z)
  g.rotation.y = rot
  const body = new THREE.Mesh(new THREE.BoxGeometry(40, 7, 12), new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 }))
  body.position.set(0, 3.5, 0)
  body.castShadow = true; body.receiveShadow = true
  g.add(body)
  const top = new THREE.Mesh(new THREE.BoxGeometry(44, 1.5, 16), new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.7 }))
  top.position.set(0, 7.75, 0)
  top.castShadow = true
  g.add(top)
  const front = new THREE.Mesh(new THREE.BoxGeometry(42, 5, 0.5), new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 }))
  front.position.set(0, 3.5, 6.5)
  g.add(front)
  scene.add(g)
}

function suSebili(scene: THREE.Scene | THREE.Group, x: number, z: number, rot = 0) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rot
  const body = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 8), new THREE.MeshStandardMaterial({ color: 0x9aa5b1, roughness: 0.5, metalness: 0.4 }))
  body.position.set(0, 6, 0)
  body.castShadow = true
  g.add(body)
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 9, 10), new THREE.MeshStandardMaterial({ color: 0x90cdf4, roughness: 0.2, transparent: true, opacity: 0.8 }))
  bottle.position.set(0, 18, 0)
  g.add(bottle)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0x2b6cb0 }))
  cap.position.set(0, 22.9, 0)
  g.add(cap)
  const tap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 2), new THREE.MeshStandardMaterial({ color: 0x718096, metalness: 0.6 }))
  tap.position.set(0, 8.5, 4.5)
  g.add(tap)
  const tray = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 5), new THREE.MeshStandardMaterial({ color: 0x4a5568 }))
  tray.position.set(0, 1.2, 3.5)
  g.add(tray)
  scene.add(g)
}

function copKovasi(scene: THREE.Scene | THREE.Group, x: number, z: number, yBase = 0, rot = 0) {
  const g = new THREE.Group()
  g.position.set(x, yBase, z)
  g.rotation.y = rot
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 7, 10), new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 }))
  body.position.set(0, 3.5, 0)
  body.castShadow = true
  g.add(body)
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 }))
  lid.position.set(0, 7.2, 0)
  g.add(lid)
  const band = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.8, 6.2), new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.6 }))
  band.position.set(0, 5, 0)
  g.add(band)
  scene.add(g)
}

function kahveKosesi(scene: THREE.Scene | THREE.Group, x: number, z: number, rot = 0) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rot
  const counter = new THREE.Mesh(new THREE.BoxGeometry(40, 8, 12), new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 }))
  counter.position.set(0, 4, 0)
  counter.castShadow = true; counter.receiveShadow = true
  g.add(counter)
  const top = new THREE.Mesh(new THREE.BoxGeometry(42, 1.2, 14), new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.7 }))
  top.position.set(0, 8.6, 0)
  g.add(top)
  const machine = new THREE.Mesh(new THREE.BoxGeometry(10, 11, 7), new THREE.MeshStandardMaterial({ color: 0x718096, roughness: 0.4, metalness: 0.5 }))
  machine.position.set(-8, 13.5, 0)
  machine.castShadow = true
  g.add(machine)
  const machineFace = new THREE.Mesh(new THREE.BoxGeometry(8, 7, 0.6), new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.3 }))
  machineFace.position.set(-8, 12.5, 3.7)
  g.add(machineFace)
  const drip = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 2.5), new THREE.MeshStandardMaterial({ color: 0x4a5568 }))
  drip.position.set(-8, 9.5, 3.2)
  g.add(drip)
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xf7fafc, roughness: 0.3 })
  for (const dx of [8, 13]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1, 3.5, 10), cupMat)
    cup.position.set(dx, 10.4, 0)
    cup.castShadow = true
    g.add(cup)
  }
  scene.add(g)
}

function duvarCerceve(scene: THREE.Scene | THREE.Group, x: number, z: number, y: number, rot = 0, renk = 0x8e44ad) {
  const g = new THREE.Group()
  g.position.set(x, y, z)
  g.rotation.y = rot
  const outer = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 0.6), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 }))
  outer.castShadow = true
  g.add(outer)
  const inner = new THREE.Mesh(new THREE.BoxGeometry(13, 8, 0.3), new THREE.MeshStandardMaterial({ color: renk, roughness: 0.8 }))
  inner.position.set(0, 0, 0.4)
  g.add(inner)
  scene.add(g)
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

function mobilyaEkip(group: THREE.Group, x: number, z: number, cb: { x: number; z: number; w: number; d: number; f: number }[]) {
  for (let i = 0; i < 3; i++) {
    const ox = 30 + i * 50
    sandalye(group, x + ox, z + 15)
    masa(group, x + ox, z + 30)
    bilgisayar(group, x + ox, z + 30)
    cb.push({ x: x + ox, z: z + 30, w: 26, d: 16, f: 1 })
    cb.push({ x: x + ox, z: z + 15, w: 14, d: 14, f: 1 })
  }
}

function aiKarakter(scene: THREE.Scene | THREE.Group, x: number, z: number, renk: string, yonetici = false) {
  const g = new THREE.Group()
  const kumas = new THREE.MeshStandardMaterial({ color: new THREE.Color(renk), roughness: 0.7 })
  const koyu = new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.8 })
  const ten = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.6 })
  const sac = new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.9 })
  const beyaz = new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.4 })
  const siyah = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })

  for (const bx of [-2.8, 2.8]) {
    const bacak = new THREE.Mesh(new THREE.BoxGeometry(3.2, 10, 3.2), koyu)
    bacak.position.set(bx, 5, 0)
    bacak.castShadow = true
    g.add(bacak)
  }

  const govde = new THREE.Mesh(new THREE.BoxGeometry(10, 13, 5), kumas)
  govde.position.y = 16.5
  govde.castShadow = true
  g.add(govde)

  for (const kx of [-6.6, 6.6]) {
    const kol = new THREE.Mesh(new THREE.BoxGeometry(2.6, 11, 2.6), kumas)
    kol.position.set(kx, 16.5, 0)
    kol.castShadow = true
    g.add(kol)
  }

  const kafa = new THREE.Mesh(new THREE.SphereGeometry(5.8, 12, 12), ten)
  kafa.position.y = 31
  kafa.castShadow = true
  g.add(kafa)

  const sacTop = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), sac)
  sacTop.position.y = 31.5
  g.add(sacTop)

  const goz = (gx: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 0.4), beyaz)
    b.position.set(gx, 32.2, 5.4)
    g.add(b)
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), siyah)
    p.position.set(gx, 32.2, 5.6)
    g.add(p)
  }
  goz(-1.9)
  goz(1.9)
  const agiz = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.4), siyah)
  agiz.position.set(0, 30.1, 5.7)
  g.add(agiz)

  if (yonetici) {
    for (const gx of [-1.9, 1.9]) {
      const cam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.9, 0.5), siyah)
      cam.position.set(gx, 32.2, 5.15)
      g.add(cam)
    }
    const kopru = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.5), siyah)
    kopru.position.set(0, 32.2, 5.15)
    g.add(kopru)
  }

  g.position.set(x, 0, z)
  scene.add(g)
  return g
}

function ekipEtiketiOlustur(metin: string, renk: string, altMetin?: string) {
  const d = document.createElement('div')
  d.style.cssText = `display:flex;flex-direction:column;align-items:center;color:#fff;font-size:11px;font-weight:bold;text-shadow:0 1px 4px rgba(0,0,0,0.9);background:rgba(0,0,0,0.75);border-left:3px solid ${renk};padding:2px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;`
  const u = document.createElement('div')
  u.textContent = metin
  d.appendChild(u)
  if (altMetin) {
    const a = document.createElement('div')
    a.style.cssText = 'font-size:8px;opacity:0.85;text-align:center;'
    a.textContent = altMetin
    d.appendChild(a)
  }
  return new CSS2DObject(d)
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

export interface OfficeMap3DRef {
  gorevRaporla: (ekipId: number, mesaj: string, tamam: boolean) => void
}

export const OfficeMap3D = forwardRef<OfficeMap3DRef, {}>(function OfficeMap3D(_props, forwardRef) {
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
  const kat1LabelRefs = useRef<CSS2DObject[]>([])
  const chairPositionsRef = useRef<{ x: number; z: number; yBase: number }[]>([])
  const meetingChairPositionsRef = useRef<{ x: number; z: number; yBase: number }[]>([])
  const collisionBoxesRef = useRef<{ x: number; z: number; w: number; d: number; f: number }[]>([])
  const meetingCollisionRef = useRef<{ x: number; z: number; w: number; d: number; f: number }[]>([])
  const sitRequestedRef = useRef(false)
  const sittingRef = useRef(false)
  const prevCamPosRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const aiSpotsRef = useRef<{ x: number; z: number; ekipId: number; kat: number; yonetici?: boolean }[]>([])
  const nearestAiTeamRef = useRef<number | null>(null)
  const nearestYoneticiTeamRef = useRef<number | null>(null)
  const tahtaTexRef = useRef<{ tex: THREE.CanvasTexture; canvas: HTMLCanvasElement } | null>(null)
  const tahtaKonumRef = useRef<{ x: number; z: number } | null>(null)
  const tahtaYakinRef = useRef(false)
  const tahtaAktifRef = useRef(false)
  const tahtaCizimRef = useRef({ ciziyor: false, sonX: 0, sonY: 0, renk: '#111111', boyut: 3 })
  const tahtaCizimCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [tahtaAktif, setTahtaAktif] = useState(false)

  interface AiKayitSpot { x: number; z: number; ekipId: number; kat: number; yonetici?: boolean }
  interface AiKayit { grup: THREE.Group; spot: AiKayitSpot; oks: { x: number; z: number } }
  const aiHaritaRef = useRef<Map<number, { uye: AiKayit | null; yonetici: AiKayit | null }>>(new Map())
  const aiHareketlerRef = useRef<{ grup: THREE.Group; yollar: [number, number, number][]; hedefIdx: number; spot: { x: number; z: number } | null; oks: { x: number; z: number } | null; donus: boolean }[]>([])
  const toplantiKonumRef = useRef<{ tx: number; tz: number; tw: number; td: number } | null>(null)
  const oncekiToplantiRef = useRef<number[]>([])
  const projeTerminalRef = useRef<{ x: number; z: number } | null>(null)
  const projeTerminalYakinRef = useRef(false)
  const projeAktifRef = useRef(false)
  const projeRafGroupRef = useRef<THREE.Group | null>(null)
  const [projeAktif, setProjeAktif] = useState(false)

  interface DavranisDurum { mod: 'serbest' | 'calisiyor'; hedef: { x: number; z: number } | null; isNoktasi: { x: number; z: number } | null; varisZamani: number }
  const davranisRef = useRef<Map<number, DavranisDurum>>(new Map())
  const gorusmedekiEkipRef = useRef<number | null>(null)
  const yoneticiDavranisRef = useRef<Map<number, { hedef: { x: number; z: number } | null; varisZamani: number }>>(new Map())
  const gorevBitisRef = useRef<Map<number, { bitis: number; deneme: number; ekipId: number }>>(new Map())
  const raporRef = useRef<Map<number, { mesaj: string; tamam: boolean; sonYolYenile: number }>>(new Map())
  const raporGrupRef = useRef<Map<THREE.Group, number>>(new Map())
  const balonRef = useRef<{ balon: CSS2DObject; bitis: number } | null>(null)
  const davranisTickRef = useRef(0)
  const gorevScanRef = useRef(0)
  const ekiplerRef = useRef<Ekip[] | null>(null)
  const uzakKarakterlerRef = useRef<Map<string, { group: THREE.Group; label: CSS2DObject }>>(new Map())
  const uzakHedefRef = useRef<Map<string, { x: number; z: number; f: number }>>(new Map())
  const sonKonumGonderimRef = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const w = el.clientWidth, h = el.clientHeight

    const sc = new THREE.Scene()
    sc.background = new THREE.Color(0x87ceeb)
    sc.fog = new THREE.Fog(0x87ceeb, 1500, 2800)
    sceneRef.current = sc

    const cam = new THREE.PerspectiveCamera(72, w / h, 0.5, 3200)
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

    sc.add(new THREE.AmbientLight(0x8899bb, 0.7))
    sc.add(new THREE.HemisphereLight(0x87ceeb, 0x8b6f47, 0.8))

    const dl = new THREE.DirectionalLight(0xffeedd, 2.0)
    dl.position.set(COLS * TILE / 2, 500, 100)
    dl.castShadow = true
    dl.shadow.mapSize.width = 4096
    dl.shadow.mapSize.height = 4096
    dl.shadow.camera.near = 1
    dl.shadow.camera.far = 1000
    dl.shadow.camera.left = -1000
    dl.shadow.camera.right = 1000
    dl.shadow.camera.top = 1000
    dl.shadow.camera.bottom = -1000
    sc.add(dl)

    const woodTex = woodTexture()
    const g = grid()
    const tileGeo = new THREE.BoxGeometry(TILE, 1, TILE)

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE + TILE / 2, z = r * TILE + TILE / 2
        const tile = g[r][c]
        if (tile === 'duvar') {
          const m = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({
            color: 0x5a7a9a, roughness: 0.15, metalness: 0.4,
            transparent: true, opacity: 0.45, side: THREE.DoubleSide
          }))
          m.position.set(x, WALL_H / 2, z)
          m.scale.y = WALL_H
          m.castShadow = true; m.receiveShadow = true
          sc.add(m)
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(TILE + 2, 0.5, TILE + 2),
            new THREE.MeshStandardMaterial({ color: 0x8a9aaa, roughness: 0.3, metalness: 0.5 })
          )
          frame.position.set(x, 0.25, z)
          sc.add(frame)
          const cap = new THREE.Mesh(
            new THREE.BoxGeometry(TILE + 4, 1, TILE + 4),
            new THREE.MeshStandardMaterial({ color: 0x8a9aaa, roughness: 0.3, metalness: 0.5 })
          )
          cap.position.set(x, WALL_H + 0.5, z)
          sc.add(cap)
        } else {
          const m = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85, metalness: 0.05 }))
          m.position.set(x, 0.5, z)
          m.receiveShadow = true
          sc.add(m)
        }
      }
    }

    const margin = 900
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x6b8e5a, roughness: 0.95 })
    const ground = new THREE.Mesh(new THREE.BoxGeometry(COLS * TILE + margin * 2, 0.5, ROWS * TILE + margin * 2), groundMat)
    ground.position.set(COLS * TILE / 2, -0.25, ROWS * TILE / 2)
    ground.receiveShadow = true
    sc.add(ground)

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.9 })
    const roadW = 30
    for (const [cx, cz, rw, rd] of [[COLS * TILE / 2, -roadW / 2, COLS * TILE + margin, roadW],
    [COLS * TILE / 2, ROWS * TILE + roadW / 2, COLS * TILE + margin, roadW],
    [-roadW / 2, ROWS * TILE / 2, roadW, ROWS * TILE + margin],
    [COLS * TILE + roadW / 2, ROWS * TILE / 2, roadW, ROWS * TILE + margin],
    ] as const) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.3, rd), roadMat)
      r.position.set(cx, 0.15, cz)
      r.receiveShadow = true
      sc.add(r)
    }

    function tree(x: number, z: number) {
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(3.5, 16, 3.5), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 }))
      trunk.position.set(x, 8, z)
      trunk.castShadow = true
      sc.add(trunk)
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(11, 8, 8), new THREE.MeshStandardMaterial({ color: 0x3a7d3a, roughness: 0.8 }))
      canopy.position.set(x, 22, z)
      canopy.castShadow = true
      sc.add(canopy)
    }
    function cali(x: number, z: number) {
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9e44, roughness: 0.9 })
      for (const [dx, dz, r] of [[0, 0, 6], [4, 3, 4], [-4, 2, 4.5]] as const) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 7), leafMat)
        s.position.set(x + dx, 3, z + dz)
        s.castShadow = true
        sc.add(s)
      }
    }
    for (let x = -margin + 30; x < COLS * TILE + margin; x += 150) {
      tree(x, -40)
      tree(x, ROWS * TILE + 40)
    }
    for (let z = 0; z < ROWS * TILE; z += 150) {
      tree(-40, z)
      tree(COLS * TILE + 40, z)
    }

    interface Vehicle { mesh: THREE.Group; path: [number, number][]; speed: number; targetIdx: number; t: number }
    const vehicles: Vehicle[] = []
    const carColors = [0xe53e3e, 0x3182ce, 0x38a169, 0xd69e2e, 0x805ad5, 0xdd6b20]
    function makeCar(color: number) {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(15, 4.5, 6.5), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }))
      body.position.y = 3.75
      body.castShadow = true
      g.add(body)
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.2, 5.5), new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.3, metalness: 0.2 }))
      cabin.position.set(0, 6.2, 0)
      g.add(cabin)
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.9 })
      for (const [wx, wz] of [[-5, -2.6], [5, -2.6], [-5, 2.6], [5, 2.6]]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.2, 10), wheelMat)
        w.rotation.x = Math.PI / 2
        w.position.set(wx, 1.5, wz)
        g.add(w)
      }
      return g
    }
    const paths: [number, number][][] = [
      [[-15, -15], [COLS * TILE + 15, -15], [COLS * TILE + 15, ROWS * TILE + 15], [-15, ROWS * TILE + 15]],
      [[COLS * TILE + 15, 100], [COLS * TILE + 15, ROWS * TILE + 15], [-15, ROWS * TILE + 15], [-15, 100]],
      [[-15, ROWS * TILE + 15], [COLS * TILE + 15, ROWS * TILE + 15], [COLS * TILE + 15, 100], [-15, 100]],
    ]
    for (const path of paths) {
      const c = makeCar(carColors[vehicles.length % carColors.length])
      const start = path[0]
      c.position.set(start[0], 0.5, start[1])
      sc.add(c)
      vehicles.push({ mesh: c, path, speed: 20 + Math.random() * 15, targetIdx: 1, t: 0 })
    }

    hali(sc, COLS * TILE / 2, TILE * 1.5, COLS * TILE - 140, 16, 0x2b6cb0)
    for (const c of [2, 6, 14, 18, 26]) {
      bitki(sc, c * TILE + TILE / 2, TILE * 1.5 - 12)
    }
    bank(sc, 10 * TILE + TILE / 2, TILE * 1.5 + 4)
    bank(sc, 20 * TILE + TILE / 2, TILE * 1.5 + 4)
    suSebili(sc, 10 * TILE - 10, TILE * 1.5 + 14)
    suSebili(sc, 20 * TILE - 10, TILE * 1.5 + 14)
    kahveKosesi(sc, 130, TILE * 1.5 - 8)
    copKovasi(sc, 172, TILE * 1.5 - 4)
    for (const cx2 of [180, 380, 580, 780, 980, 1180]) {
      duvarCerceve(sc, cx2, TILE + 2, 11)
    }

    for (let x = 60; x < COLS * TILE - 40; x += 130) {
      cali(x, -8)
      cali(x, ROWS * TILE + 8)
    }
    for (let z = 60; z < ROWS * TILE - 40; z += 130) {
      cali(-8, z)
      cali(COLS * TILE + 8, z)
    }
    const flowerColors = [0xff6b6b, 0xfeca57, 0xffffff, 0xd8a0ff, 0x5eead4]
    for (let i = 0; i < 70; i++) {
      let fx: number, fz: number
      const side = i % 4
      if (side === 0) { fx = 40 + Math.random() * (COLS * TILE - 80); fz = -60 - Math.random() * (margin - 100) }
      else if (side === 1) { fx = 40 + Math.random() * (COLS * TILE - 80); fz = ROWS * TILE + 60 + Math.random() * (margin - 100) }
      else if (side === 2) { fx = -60 - Math.random() * (margin - 100); fz = 40 + Math.random() * (ROWS * TILE - 80) }
      else { fx = COLS * TILE + 60 + Math.random() * (margin - 100); fz = 40 + Math.random() * (ROWS * TILE - 80) }
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x2f9e44 }))
      stem.position.set(fx, 1.25, fz)
      sc.add(stem)
      const fl = new THREE.Mesh(new THREE.SphereGeometry(1.3, 6, 6), new THREE.MeshStandardMaterial({
        color: flowerColors[i % flowerColors.length],
        emissive: flowerColors[i % flowerColors.length],
        emissiveIntensity: 0.15
      }))
      fl.position.set(fx, 2.8, fz)
      sc.add(fl)
    }

    resepsiyon(sc, 600, ROWS * TILE - 110)
    bilgisayar(sc, 612, ROWS * TILE - 110, 2.5)
    bitki(sc, 540, ROWS * TILE - 95, 1.4)
    bank(sc, 665, ROWS * TILE - 90, Math.PI)
    sandalye(sc, 625, ROWS * TILE - 68)
    sandalye(sc, 658, ROWS * TILE - 68)
    copKovasi(sc, 642, ROWS * TILE - 100)

    const girDiv = document.createElement('div')
    girDiv.style.cssText = 'color:#e2e8f0;font-size:13px;font-weight:bold;text-shadow:0 2px 6px rgba(0,0,0,0.9);background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:6px;pointer-events:none;'
    girDiv.textContent = '🚪 Giriş / Resepsiyon'
    const girLabel = new CSS2DObject(girDiv)
    girLabel.position.set(600, 12, ROWS * TILE - 145)
    sc.add(girLabel)

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
    const tWallH = 80
    const tMat = new THREE.MeshStandardMaterial({ color: 0x8a9acf, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.2, side: THREE.DoubleSide })

    function tWall(s: [number, number, number], p: [number, number, number]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), tMat)
      m.position.set(p[0], p[1], p[2])
      m.castShadow = true; m.receiveShadow = true
      sc.add(m)
    }

    tWall([tw, tWallH, 1], [tx, FLOOR2_Y + tWallH / 2, tz - td / 2])
    const doorW = 18, doorH = 40
    const halfGap = doorW / 2
    const leftW = tw / 2 - halfGap
    const rightW = tw / 2 - halfGap
    tWall([leftW, tWallH, 1], [tx - halfGap - leftW / 2, FLOOR2_Y + tWallH / 2, tz + td / 2])
    tWall([rightW, tWallH, 1], [tx + halfGap + rightW / 2, FLOOR2_Y + tWallH / 2, tz + td / 2])
    tWall([1, tWallH, td], [tx - tw / 2, FLOOR2_Y + tWallH / 2, tz])
    tWall([1, tWallH, td], [tx + tw / 2, FLOOR2_Y + tWallH / 2, tz])

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.8, side: THREE.DoubleSide })
    const roof = new THREE.Mesh(new THREE.BoxGeometry(tw + 2, 1, td + 2), roofMat)
    roof.position.set(tx, FLOOR2_Y + tWallH, tz)
    roof.receiveShadow = true
    sc.add(roof)

    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0xd0d8e8, roughness: 0.2, metalness: 0.6 })
    function doorPost(x: number) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1, doorH, 1), doorFrameMat)
      p.position.set(x, FLOOR2_Y + 4 + doorH / 2, tz + td / 2)
      sc.add(p)
    }
    doorPost(tx - halfGap)
    doorPost(tx + halfGap)
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(doorW + 2, 1, 1), doorFrameMat)
    topBar.position.set(tx, FLOOR2_Y + 4 + doorH, tz + td / 2)
    sc.add(topBar)

    toplantiMasasi(sc, tx, tz, tw - 80, td - 80, FLOOR2_Y)
    const mc = meetingCollisionRef.current
    mc.length = 0
    mc.push({ x: tx, z: tz, w: tw - 70, d: td - 70, f: 2 })
    mc.push({ x: tx, z: tz - td / 2, w: tw + 4, d: 6, f: 2 })
    mc.push({ x: tx - halfGap - leftW / 2, z: tz + td / 2, w: leftW, d: 6, f: 2 })
    mc.push({ x: tx + halfGap + rightW / 2, z: tz + td / 2, w: rightW, d: 6, f: 2 })
    mc.push({ x: tx - tw / 2, z: tz, w: 6, d: td + 4, f: 2 })
    mc.push({ x: tx + tw / 2, z: tz, w: 6, d: td + 4, f: 2 })
    collisionBoxesRef.current.push(...mc)
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
      const b = { x: sx, z: sz, w: 14, d: 14, f: 2 }
      collisionBoxesRef.current.push(b)
      mc.push(b)
    }

    chairPositionsRef.current.push(...chairs2)
    meetingChairPositionsRef.current = chairs2
    toplantiKonumRef.current = { tx, tz, tw, td }

    hali(sc, tx, tz, tw - 30, td - 30, 0x7f1d1d, FLOOR2_Y)
    kitaplik(sc, tx + 90, tz - td / 2 + 8, FLOOR2_Y, Math.PI)
    kitaplik(sc, tx - 90, tz - td / 2 + 8, FLOOR2_Y, Math.PI)

    const tahtaCanvas = document.createElement('canvas')
    tahtaCanvas.width = 640
    tahtaCanvas.height = 320
    const tctx = tahtaCanvas.getContext('2d')!
    tctx.fillStyle = '#ffffff'
    tctx.fillRect(0, 0, 640, 320)
    const tahtaTex = new THREE.CanvasTexture(tahtaCanvas)
    tahtaTex.colorSpace = THREE.SRGBColorSpace
    const tBoard = new THREE.Mesh(
      new THREE.BoxGeometry(52, 28, 0.8),
      new THREE.MeshStandardMaterial({ map: tahtaTex, roughness: 0.4 })
    )
    tBoard.position.set(tx, FLOOR2_Y + 16, tz - td / 2 + 5)
    tBoard.castShadow = true
    sc.add(tBoard)
    const tbFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 })
    for (const [dx, dy, dw, dh] of [[-26, 16, 1, 28], [26, 16, 1, 28], [0, 2, 53, 1], [0, 30, 53, 1]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.9), tbFrameMat)
      f.position.set(tx + dx, FLOOR2_Y + dy, tz - td / 2 + 5)
      sc.add(f)
    }
    const tTray = new THREE.Mesh(new THREE.BoxGeometry(52, 1.2, 2.5), tbFrameMat)
    tTray.position.set(tx, FLOOR2_Y + 2, tz - td / 2 + 7)
    sc.add(tTray)
    for (const [mx, mc] of [[-20, 0xe53e3e], [20, 0x3182ce]] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 4), new THREE.MeshStandardMaterial({ color: mc }))
      m.position.set(tx + mx, FLOOR2_Y + 3.4, tz - td / 2 + 8)
      sc.add(m)
    }
    tahtaTexRef.current = { tex: tahtaTex, canvas: tahtaCanvas }
    tahtaKonumRef.current = { x: tx, z: tz - td / 2 }

    const tahtaDiv = document.createElement('div')
    tahtaDiv.style.cssText = 'color:#e2e8f0;font-size:11px;font-weight:bold;text-shadow:0 1px 4px rgba(0,0,0,0.9);background:rgba(0,0,0,0.65);padding:2px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;'
    tahtaDiv.textContent = '✏️ Yazı Tahtası — yaklaş ve E'
    const tahtaLabel = new CSS2DObject(tahtaDiv)
    tahtaLabel.position.set(tx, FLOOR2_Y + 36, tz - td / 2 + 8)
    tahtaLabel.visible = false
    sc.add(tahtaLabel)
    kat2LabelRefs.current.push(tahtaLabel)
    bitki(sc, tx - tw / 2 + 20, tz + td / 2 - 20, 1.2, FLOOR2_Y)
    bitki(sc, tx + tw / 2 - 20, tz + td / 2 - 20, 1.2, FLOOR2_Y)
    tavanLambasi(sc, tx - 60, tz, FLOOR2_Y + tWallH - 2)
    tavanLambasi(sc, tx + 60, tz, FLOOR2_Y + tWallH - 2)
    const spot = new THREE.PointLight(0xfff1d6, 900, 600)
    spot.position.set(tx, FLOOR2_Y + tWallH - 10, tz)
    sc.add(spot)

    const ptx = 260, ptz = 545, ptw = 400, ptd = 290
    const pWallH = 60
    const pMat = new THREE.MeshStandardMaterial({ color: 0x7fa88f, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    function pWall(s: [number, number, number], p: [number, number, number]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), pMat)
      m.position.set(p[0], p[1], p[2])
      m.castShadow = true; m.receiveShadow = true
      sc.add(m)
    }
    pWall([ptw, pWallH, 1], [ptx, FLOOR2_Y + pWallH / 2, ptz - ptd / 2])
    pWall([ptw, pWallH, 1], [ptx, FLOOR2_Y + pWallH / 2, ptz + ptd / 2])
    pWall([1, pWallH, ptd], [ptx - ptw / 2, FLOOR2_Y + pWallH / 2, ptz])
    const pDoorW = 18
    pWall([1, pWallH, (ptd - pDoorW) / 2], [ptx + ptw / 2, FLOOR2_Y + pWallH / 2, ptz - (ptd + pDoorW) / 4])
    pWall([1, pWallH, (ptd - pDoorW) / 2], [ptx + ptw / 2, FLOOR2_Y + pWallH / 2, ptz + (ptd + pDoorW) / 4])
    const pDoorFrameMat = new THREE.MeshStandardMaterial({ color: 0xd0d8e8, roughness: 0.2, metalness: 0.6 })
    for (const pz2 of [ptz - pDoorW / 2, ptz + pDoorW / 2]) {
      const pp = new THREE.Mesh(new THREE.BoxGeometry(1, pWallH - 20, 1), pDoorFrameMat)
      pp.position.set(ptx + ptw / 2, FLOOR2_Y + 10 + (pWallH - 20) / 2, pz2)
      sc.add(pp)
    }
    const pTopBar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, pDoorW + 2), pDoorFrameMat)
    pTopBar.position.set(ptx + ptw / 2, FLOOR2_Y + pWallH - 4, ptz)
    sc.add(pTopBar)
    const pRoof = new THREE.Mesh(new THREE.BoxGeometry(ptw + 2, 1, ptd + 2), roofMat)
    pRoof.position.set(ptx, FLOOR2_Y + pWallH, ptz)
    pRoof.receiveShadow = true
    sc.add(pRoof)

    hali(sc, ptx, ptz, ptw - 40, ptd - 40, 0x2d6a4f, FLOOR2_Y)
    masa(sc, 290, 620, FLOOR2_Y)
    bilgisayar(sc, 290, 620, FLOOR2_Y)
    sandalye(sc, 265, 600, FLOOR2_Y)
    sandalye(sc, 315, 600, FLOOR2_Y)
    masa(sc, 165, 620, FLOOR2_Y)
    bilgisayar(sc, 165, 620, FLOOR2_Y)
    sandalye(sc, 165, 595, FLOOR2_Y)
    for (const [bx, bz] of [[75, 415], [445, 415], [75, 665], [445, 665]]) {
      bitki(sc, bx, bz, 1.2, FLOOR2_Y)
    }
    copKovasi(sc, 430, 655, FLOOR2_Y, Math.PI)
    tavanLambasi(sc, 200, 500, FLOOR2_Y + pWallH - 2)
    tavanLambasi(sc, 330, 600, FLOOR2_Y + pWallH - 2)
    projeTerminalRef.current = { x: 165, z: 620 }

    collisionBoxesRef.current.push(
      { x: ptx, z: ptz - ptd / 2, w: ptw + 4, d: 4, f: 2 },
      { x: ptx, z: ptz + ptd / 2, w: ptw + 4, d: 4, f: 2 },
      { x: ptx - ptw / 2, z: ptz, w: 4, d: ptd + 4, f: 2 },
      { x: ptx + ptw / 2, z: ptz - (ptd + pDoorW) / 4, w: 4, d: (ptd - pDoorW) / 2 + 4, f: 2 },
      { x: ptx + ptw / 2, z: ptz + (ptd + pDoorW) / 4, w: 4, d: (ptd - pDoorW) / 2 + 4, f: 2 },
      { x: 290, z: 620, w: 60, d: 40, f: 2 },
      { x: 165, z: 620, w: 40, d: 30, f: 2 },
    )

    const projeDiv = document.createElement('div')
    projeDiv.style.cssText = 'color:#e2e8f0;font-size:13px;font-weight:bold;text-shadow:0 2px 6px rgba(0,0,0,0.9);background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:6px;pointer-events:none;'
    projeDiv.textContent = '📁 Proje Odası'
    const projeLabel = new CSS2DObject(projeDiv)
    projeLabel.position.set(ptx + ptw / 2 + 1, FLOOR2_Y + pWallH + 4, ptz - 30)
    projeLabel.visible = false
    sc.add(projeLabel)
    kat2LabelRefs.current.push(projeLabel)

    const projeKatDiv = document.createElement('div')
    projeKatDiv.style.cssText = 'color:#94a3b8;font-size:11px;text-shadow:0 1px 3px rgba(0,0,0,0.8);background:rgba(0,0,0,0.6);padding:2px 8px;border-radius:4px;pointer-events:none;'
    projeKatDiv.textContent = '2. Kat — Proje Odası'
    const projeKatLabel = new CSS2DObject(projeKatDiv)
    projeKatLabel.position.set(ptx, FLOOR2_Y + 2, ptz)
    projeKatLabel.visible = false
    sc.add(projeKatLabel)
    kat2LabelRefs.current.push(projeKatLabel)

    const termDiv = document.createElement('div')
    termDiv.style.cssText = 'color:#e2e8f0;font-size:11px;font-weight:bold;text-shadow:0 1px 4px rgba(0,0,0,0.9);background:rgba(0,0,0,0.65);padding:2px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;'
    termDiv.textContent = '💻 Proje Terminali — yaklaş ve E'
    const termLabel = new CSS2DObject(termDiv)
    termLabel.position.set(165, FLOOR2_Y + 16, 645)
    termLabel.visible = false
    sc.add(termLabel)
    kat2LabelRefs.current.push(termLabel)

    const tDiv = document.createElement('div')
    tDiv.style.cssText = 'color:#e2e8f0;font-size:14px;font-weight:bold;text-shadow:0 2px 6px rgba(0,0,0,0.9);background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:6px;pointer-events:none;'
    tDiv.textContent = '🏢 Toplantı Salonu'
    const tLabel = new CSS2DObject(tDiv)
    tLabel.position.set(tx, FLOOR2_Y + tWallH + 4, tz - td / 2)
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

    function collides(x: number, z: number, f: number) {
      for (const b of collisionBoxesRef.current) {
        if (b.f !== 0 && b.f !== f) continue
        if (x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && z >= b.z - b.d / 2 && z <= b.z + b.d / 2) return true
      }
      return false
    }

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
            let nx = Math.max(0, Math.min(COLS * TILE, k.konum_x + dx))
            let nz = Math.max(0, Math.min(ROWS * TILE, k.konum_y + dz))
            if (collides(nx, nz, currentFloorRef.current)) {
              nx = cam.position.x
              nz = cam.position.z
            }
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
        for (const l of kat1LabelRefs.current) l.visible = newFloor === 1
        labelGroupRef.current.visible = newFloor === 1
      }

      if (!sitting) {
        let closestChair = -1
        let minDist = 40
        const chairs = chairPositionsRef.current
        const cf = currentFloorRef.current
        for (let i = 0; i < chairs.length; i++) {
          const c = chairs[i]
          const cFloor = c.yBase >= FLOOR2_Y ? 2 : 1
          if (cFloor !== cf) continue
          const d = Math.sqrt((px - c.x) ** 2 + (pz - c.z) ** 2)
          if (d < minDist) { minDist = d; closestChair = i }
        }
        let yakinAI: { ekipId: number; yonetici: boolean } | null = null
        let aiMinDist = 50
        const kisiler: { k: AiKayit | null; ekipId: number; yonetici: boolean }[] = []
        for (const [ekipId, kayit] of aiHaritaRef.current) {
          kisiler.push({ k: kayit.uye, ekipId, yonetici: false })
          kisiler.push({ k: kayit.yonetici, ekipId, yonetici: true })
        }
        for (const { k, ekipId, yonetici: y } of kisiler) {
          if (!k) continue
          if ((k.grup.position.y >= FLOOR2_Y - 1 ? 2 : 1) !== cf) continue
          const d = Math.sqrt((px - k.grup.position.x) ** 2 + (pz - k.grup.position.z) ** 2)
          if (d < aiMinDist) { aiMinDist = d; yakinAI = { ekipId, yonetici: y } }
        }
        const yonetici = yakinAI?.yonetici === true
        const store = useOfisStore.getState()
        const tk = tahtaKonumRef.current
        tahtaYakinRef.current = tk !== null && cf === 2 && Math.sqrt((px - tk.x) ** 2 + (pz - tk.z) ** 2) < 70
        const ptt = projeTerminalRef.current
        projeTerminalYakinRef.current = ptt !== null && cf === 2 && Math.sqrt((px - ptt.x) ** 2 + (pz - ptt.z) ** 2) < 80
        if (tahtaYakinRef.current) {
          store.setSitPrompt('')
          store.setAiPrompt('E: Tahtaya Yaz')
        } else if (projeTerminalYakinRef.current) {
          store.setSitPrompt('')
          store.setAiPrompt('E: Projeler')
        } else if (yakinAI && yonetici) {
          store.setSitPrompt('')
          store.setAiPrompt('E: Yönetici ile Görüş')
        } else if (yakinAI) {
          store.setSitPrompt('')
          store.setAiPrompt('E: Sohbet Et')
        } else if (closestChair >= 0) {
          store.setAiPrompt('')
          store.setSitPrompt('E: Otur')
        } else {
          store.setSitPrompt('')
          store.setAiPrompt('')
        }
        nearestAiTeamRef.current = !tahtaYakinRef.current && !projeTerminalYakinRef.current && yakinAI && !yakinAI.yonetici ? yakinAI.ekipId : null
        nearestYoneticiTeamRef.current = !tahtaYakinRef.current && !projeTerminalYakinRef.current && yakinAI && yakinAI.yonetici ? yakinAI.ekipId : null
      }

      if (sitRequestedRef.current) {
        sitRequestedRef.current = false
        if (sittingRef.current) {
          const prev = prevCamPosRef.current
          if (prev) {
            cam.position.set(prev.x, prev.y, prev.z)
          }
          sittingRef.current = false
          useOfisStore.getState().setIsSitting(false)
          useOfisStore.getState().setSitPrompt('')
        } else {
          const chairs = chairPositionsRef.current
          let closest = -1
          let minDist = 30
          const cf = currentFloorRef.current
          for (let i = 0; i < chairs.length; i++) {
            const c = chairs[i]
            const cFloor = c.yBase >= FLOOR2_Y ? 2 : 1
            if (cFloor !== cf) continue
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
      }

      for (const v of vehicles) {
        const p = v.path
        const from = p[v.targetIdx === 0 ? p.length - 1 : v.targetIdx - 1]
        const to = p[v.targetIdx]
        v.t += 0.01 * v.speed / Math.sqrt((to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2)
        if (v.t >= 1) { v.t = 0; v.targetIdx = (v.targetIdx + 1) % p.length }
        const x = from[0] + (to[0] - from[0]) * v.t
        const z = from[1] + (to[1] - from[1]) * v.t
        v.mesh.position.x = x
        v.mesh.position.z = z
        v.mesh.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1])
      }

      const uzakState = useOfisStore.getState()
      if (uzakState.multiplayerMod !== 'tek') {
        for (const [pid, obj] of uzakKarakterlerRef.current) {
          const hedef = uzakHedefRef.current.get(pid)
          if (!hedef) continue
          const gorunur = hedef.f === currentFloorRef.current
          obj.group.visible = gorunur
          obj.label.visible = gorunur
          obj.group.position.x += (hedef.x - obj.group.position.x) * 0.2
          obj.group.position.z += (hedef.z - obj.group.position.z) * 0.2
          obj.label.position.x = obj.group.position.x
          obj.label.position.z = obj.group.position.z
        }
        const now = performance.now()
        if (now - sonKonumGonderimRef.current > 120) {
          sonKonumGonderimRef.current = now
          herkeseGonder({
            type: 'konum_guncelle',
            payload: { peerId: uzakState.peerId, x: px, y: pz, kat: currentFloorRef.current },
          })
        }
      }

      const hk2 = aiHareketlerRef.current
      for (let i = hk2.length - 1; i >= 0; i--) {
        const h = hk2[i]
        const hedef = h.yollar[h.hedefIdx]
        const dx = hedef[0] - h.grup.position.x
        const dy = hedef[1] - h.grup.position.y
        const dz = hedef[2] - h.grup.position.z
        const mesafe = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const adim = 1.4
        if (mesafe <= adim) {
          h.grup.position.set(hedef[0], hedef[1], hedef[2])
          if (h.hedefIdx >= h.yollar.length - 1) {
            if (h.donus && h.oks) {
              if (h.spot) { h.spot.x = h.oks.x; h.spot.z = h.oks.z }
              h.grup.rotation.y = 0
            } else {
              const tk3 = toplantiKonumRef.current
              if (tk3) h.grup.rotation.y = Math.atan2(tk3.tx - hedef[0], tk3.tz - hedef[2])
            }
            hk2.splice(i, 1)
            const raporEkipId = raporGrupRef.current.get(h.grup)
            if (raporEkipId !== undefined) {
              raporGrupRef.current.delete(h.grup)
              const r = raporRef.current.get(raporEkipId)
              if (r) {
                raporRef.current.delete(raporEkipId)
                const k = useOfisStore.getState().kullanici
                const s = sceneRef.current
                if (k && s) {
                  const hx2 = Math.max(2, Math.min(COLS * TILE - 2, k.konum_x))
                  const hz2 = Math.max(2, Math.min(ROWS * TILE - 2, k.konum_y))
                  let nokta: [number, number, number] | null = null
                  const gx = h.grup.position.x, gz = h.grup.position.z
                  if (Math.abs(gx - hx2) > 140 || Math.abs(gz - hz2) > 140) {
                    const koridor = hedef[1] >= FLOOR2_Y - 1 ? 385 : 30
                    if (Math.abs(gx - koridor) <= 140) nokta = [koridor, hedef[1], hz2]
                    else if (Math.abs(gz - koridor) <= 140) nokta = [hx2, hedef[1], koridor]
                    else nokta = [koridor, hedef[1], hz2]
                  } else {
                    nokta = [hx2, hedef[1], hz2]
                  }
                  h.grup.position.set(nokta[0], nokta[1], nokta[2])
                  h.grup.rotation.y = Math.atan2(hx2 - nokta[0], hz2 - nokta[2])
                  balonGoster(r.mesaj, r.tamam ? '#38a169' : '#d69e2e')
                }
              }
            }
            continue
          }
          h.hedefIdx++
          continue
        }
        h.grup.position.x += (dx / mesafe) * adim
        h.grup.position.y += (dy / mesafe) * adim
        h.grup.position.z += (dz / mesafe) * adim
        h.grup.rotation.y = Math.atan2(dx, dz)
      }

      const gorusmedeEkip = gorusmedekiEkipRef.current
      if (gorusmedeEkip !== null) {
        const kayit2 = aiHaritaRef.current.get(gorusmedeEkip)
        const k2 = useOfisStore.getState().kullanici
        if (kayit2 && k2) {
          const g2 = kayit2.uye?.grup ?? kayit2.yonetici?.grup
          if (g2 && !aiHareketlerRef.current.some((h) => h.grup === g2) && (g2.position.y >= FLOOR2_Y - 1 ? 2 : 1) === currentFloorRef.current) {
            g2.rotation.y = Math.atan2(k2.konum_x - g2.position.x, k2.konum_y - g2.position.z)
          }
        }
      }

      const balon = balonRef.current
      if (balon && Date.now() > balon.bitis) {
        balon.balon.parent?.remove(balon.balon)
        balonRef.current = null
      }

      if (Date.now() % 500 < 16) {
        davranisTara()
        const kr = raporRef.current
        if (kr.size > 0) {
          const k = useOfisStore.getState().kullanici
          const kat = useOfisStore.getState().currentFloor
          for (const [ekipId, r] of kr) {
            if (Date.now() - r.sonYolYenile < 1200) continue
            const kayit = aiHaritaRef.current.get(ekipId)
            const g = kayit?.uye?.grup
            if (!g) continue
            const basKat = g.position.y >= FLOOR2_Y - 1 ? 2 : 1
            if (basKat !== kat) continue
            const hx = k ? k.konum_x : g.position.x
            const hz = k ? k.konum_y : g.position.z
            const mevcutYol = hk2.find((hh) => hh.grup === g)
            if (mevcutYol) {
              const son = mevcutYol.yollar[mevcutYol.yollar.length - 1]
              if (Math.abs(son[0] - hx) < 10 && Math.abs(son[2] - hz) < 10) continue
              const idx = hk2.indexOf(mevcutYol)
              hk2.splice(idx, 1)
              raporBaslat(ekipId, { uye: kayit.uye }, r)
              r.sonYolYenile = Date.now()
            }
          }
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

  function tahtaAc() {
    document.exitPointerLock()
    tahtaAktifRef.current = true
    setTahtaAktif(true)
  }

  function tahtaKapat() {
    const kaynak = tahtaTexRef.current
    const cv = tahtaCizimCanvasRef.current
    if (kaynak && cv) {
      const ctx = kaynak.canvas.getContext('2d')!
      ctx.clearRect(0, 0, kaynak.canvas.width, kaynak.canvas.height)
      ctx.drawImage(cv, 0, 0)
      kaynak.tex.needsUpdate = true
      tahtaGuncelleGonder(cv.toDataURL())
    }
    tahtaAktifRef.current = false
    setTahtaAktif(false)
  }

  function projeKapat() {
    projeAktifRef.current = false
    setProjeAktif(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (tahtaAktifRef.current) {
        if (e.type === 'keydown' && e.key === 'Escape') tahtaKapat()
        return
      }
      if (projeAktifRef.current) {
        if (e.type === 'keydown' && e.key === 'Escape') projeKapat()
        return
      }
      if (useOfisStore.getState().aktifPanel !== 'harita') return
      if (e.type === 'keydown' && (e.key === 'e' || e.key === 'E')) {
        if (tahtaYakinRef.current && !sittingRef.current) {
          tahtaAc()
          e.preventDefault()
          return
        }
        if (projeTerminalYakinRef.current && !sittingRef.current) {
          document.exitPointerLock()
          projeAktifRef.current = true
          setProjeAktif(true)
          e.preventDefault()
          return
        }
        const yonId = nearestYoneticiTeamRef.current
        if (yonId !== null && !sittingRef.current) {
          gorusmeBaslat(yonId, 'yonetici')
          const store = useOfisStore.getState()
          store.setSeciliEkipId(yonId)
          store.setSohbetModu('yonetici')
          store.setAktifPanel('sohbet')
          store.setAiPrompt('')
          e.preventDefault()
          return
        }
        const aiId = nearestAiTeamRef.current
        if (aiId !== null && !sittingRef.current) {
          gorusmeBaslat(aiId, 'uye')
          const store = useOfisStore.getState()
          store.setSeciliEkipId(aiId)
          store.setSohbetModu('ekip')
          store.setAktifPanel('sohbet')
          store.setAiPrompt('')
          e.preventDefault()
          return
        }
        sitRequestedRef.current = true
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

  useEffect(() => {
    if (!tahtaAktif) return
    const kaynak = tahtaTexRef.current
    const cv = tahtaCizimCanvasRef.current
    if (kaynak && cv) {
      const ctx = cv.getContext('2d')!
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.drawImage(kaynak.canvas, 0, 0)
    }
  }, [tahtaAktif])

  const tahtaDataUrl = useOfisStore((s) => s.tahtaDataUrl)
  useEffect(() => {
    if (!tahtaDataUrl) return
    const kaynak = tahtaTexRef.current
    if (!kaynak) return
    const img = new Image()
    img.onload = () => {
      const ctx = kaynak.canvas.getContext('2d')!
      ctx.clearRect(0, 0, kaynak.canvas.width, kaynak.canvas.height)
      ctx.drawImage(img, 0, 0)
      kaynak.tex.needsUpdate = true
    }
    img.src = tahtaDataUrl
  }, [tahtaDataUrl])

  const ekipler = useOfisStore((s) => s.ekipler)
  const ekipGruplari = useOfisStore((s) => s.ekipGruplari)

  useEffect(() => {
    if (ekiplerRef.current === null) {
      ekiplerRef.current = ekipler
      return
    }
    if (ekiplerRef.current === ekipler) return
    ekiplerRef.current = ekipler
    const group = roomGroupRef.current
    const labelGroup = labelGroupRef.current
    while (group.children.length) group.remove(group.children[0])
    while (labelGroup.children.length) labelGroup.remove(labelGroup.children[0])
    for (const c of aiCharsRef.current) c.parent?.remove(c)
    aiCharsRef.current = []
    chairPositionsRef.current = [...meetingChairPositionsRef.current]
    aiSpotsRef.current = []
    aiHaritaRef.current.clear()
    aiHareketlerRef.current.length = 0
    davranisRef.current.clear()
    yoneticiDavranisRef.current.clear()
    gorevBitisRef.current.clear()
    raporRef.current.clear()
    gorusmedekiEkipRef.current = null
    kat1LabelRefs.current = []
    kat2LabelRefs.current = []
  }, [ekipler])

  useEffect(() => {
    const group = roomGroupRef.current
    const cb = collisionBoxesRef.current
    cb.length = 0
    cb.push(...meetingCollisionRef.current)

    for (const ekip of ekipler) {
      const grp = ekipGruplari.find((g) => g.id === ekip.ekip_grubu_id)
      const color = new THREE.Color(grp?.renk || '#4A90D9')
      const ex = ekip.oda_konum_x + ekip.oda_genislik / 2
      const ez = ekip.oda_konum_y + ekip.oda_yukseklik / 2
      const kayit: { uye: AiKayit | null; yonetici: AiKayit | null } = { uye: null, yonetici: null }

      const roomMat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.12, roughness: 0.15, metalness: 0.3, side: THREE.DoubleSide })
      const rm = new THREE.Mesh(new THREE.BoxGeometry(ekip.oda_genislik, ROOM_H, ekip.oda_yukseklik), roomMat)
      rm.position.set(ex, ROOM_H / 2, ez)
      rm.receiveShadow = true
      group.add(rm)

      mobilyaEkip(group, ekip.oda_konum_x, ekip.oda_konum_y, cb)
      hali(group, ekip.oda_konum_x + ekip.oda_genislik / 2, ekip.oda_konum_y + 30, ekip.oda_genislik - 24, 85, 0x2c5282)
      kitaplik(group, ekip.oda_konum_x + ekip.oda_genislik - 24, ekip.oda_konum_y + ekip.oda_yukseklik - 8, 0, Math.PI)
      dosyaDolabi(group, ekip.oda_konum_x + ekip.oda_genislik - 36, ekip.oda_konum_y + ekip.oda_yukseklik - 8, 0, Math.PI)
      yazTahtasi(group, ekip.oda_konum_x + ekip.oda_genislik - 30, ekip.oda_konum_y + 5)
      bitki(group, ekip.oda_konum_x + 12, ekip.oda_konum_y + ekip.oda_yukseklik - 12)
      copKovasi(group, ekip.oda_konum_x + ekip.oda_genislik - 14, ekip.oda_konum_y + 32)
      for (let i = 0; i < 3; i++) {
        const ox = 30 + i * 50
        chairPositionsRef.current.push({ x: ekip.oda_konum_x + ox, z: ekip.oda_konum_y + 15, yBase: 0 })
      }

      if (ekip.ai_model_id) {
        const ax = ekip.oda_konum_x + 100, az = ekip.oda_konum_y + 40
        const ai = aiKarakter(group, ax, az, grp?.renk || '#9333ea')
        aiCharsRef.current.push(ai)
        const etiket = ekipEtiketiOlustur(ekip.ad, grp?.renk || '#9333ea', ekip.yonetici_adi ? `👔 ${ekip.yonetici_adi}` : undefined)
        etiket.position.set(0, 43, 0)
        etiket.visible = currentFloorRef.current === 1
        ai.add(etiket)
        kat1LabelRefs.current.push(etiket)
        const spot: AiKayitSpot = { x: ax, z: az, ekipId: ekip.id, kat: 1 }
        aiSpotsRef.current.push(spot)
        kayit.uye = { grup: ai, spot, oks: { x: ax, z: az } }
      }
      aiHaritaRef.current.set(ekip.id, kayit)
    }

    let mIdx = 0
    const ofisW = 170, ofisD = 140
    const gelenYoneticiler = new Set<string>()
    for (const ekip of ekipler) {
      if (!ekip.yonetici_adi) continue
      if (gelenYoneticiler.has(ekip.yonetici_adi)) continue
      gelenYoneticiler.add(ekip.yonetici_adi)
      const row = mIdx < 5 ? 0 : 1
      const col = mIdx < 5 ? mIdx : mIdx - 5
      mIdx++
      if (row === 1 && col > 1) break
      const grp = ekipGruplari.find((g) => g.id === ekip.ekip_grubu_id)
      const color = new THREE.Color(grp?.renk || '#B7791F')
      const ox = 90 + col * 200
      const oz = row === 0 ? 80 : 230
      const cx = ox + ofisW / 2
      const cz = oz + ofisD / 2

      const roomMat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.12, roughness: 0.15, metalness: 0.3, side: THREE.DoubleSide })
      const rm = new THREE.Mesh(new THREE.BoxGeometry(ofisW, ROOM_H, ofisD), roomMat)
      rm.position.set(cx, FLOOR2_Y + ROOM_H / 2, cz)
      rm.receiveShadow = true
      group.add(rm)

      hali(group, cx, oz + 55, ofisW - 30, 95, 0x4a3a8c, FLOOR2_Y)
      masa(group, ox + 45, oz + 60, FLOOR2_Y)
      sandalye(group, ox + 45, oz + 40, FLOOR2_Y)
      bilgisayar(group, ox + 45, oz + 60, FLOOR2_Y)
      sandalye(group, ox + 115, oz + 65, FLOOR2_Y, Math.PI)
      kitaplik(group, ox + 152, oz + ofisD - 8, FLOOR2_Y, Math.PI)
      bitki(group, ox + 16, oz + ofisD - 16, 1.2, FLOOR2_Y)

      chairPositionsRef.current.push({ x: ox + 45, z: oz + 40, yBase: FLOOR2_Y })
      chairPositionsRef.current.push({ x: ox + 115, z: oz + 65, yBase: FLOOR2_Y })
      cb.push({ x: ox + 45, z: oz + 60, w: 26, d: 16, f: 2 })
      cb.push({ x: ox + 45, z: oz + 40, w: 14, d: 14, f: 2 })
      cb.push({ x: ox + 115, z: oz + 65, w: 14, d: 14, f: 2 })

      const ai = aiKarakter(group, ox + 100, oz + 95, '#' + color.getHexString(), true)
      aiCharsRef.current.push(ai)
      const etiket = ekipEtiketiOlustur(`👔 ${ekip.yonetici_adi}`, '#' + color.getHexString(), ekip.ad)
      etiket.position.set(0, 43, 0)
      etiket.visible = currentFloorRef.current === 2
      ai.add(etiket)
      kat2LabelRefs.current.push(etiket)
      const ySpot: AiKayitSpot = { x: ox + 100, z: oz + 95, ekipId: ekip.id, kat: 2, yonetici: true }
      aiSpotsRef.current.push(ySpot)
      const yKayit = aiHaritaRef.current.get(ekip.id)
      if (yKayit) {
        yKayit.yonetici = { grup: ai, spot: ySpot, oks: { x: ox + 100, z: oz + 95 } }
      }
    }

    const simdiki = useOfisStore.getState().toplantiEkipleri
    for (const eid of simdiki) toplantiyaYurut(eid)
  }, [ekipler, ekipGruplari])

  const toplantiKoltugu = (ekipId: number, liste: number[]): [number, number] | null => {
    const tk = toplantiKonumRef.current
    if (!tk) return null
    const pozlar: [number, number][] = [
      [tk.tx, tk.tz - tk.td / 2 + 20], [tk.tx, tk.tz + tk.td / 2 - 20],
      [tk.tx - tk.tw / 2 + 20, tk.tz], [tk.tx + tk.tw / 2 - 20, tk.tz],
      [tk.tx - 40, tk.tz - tk.td / 2 + 20], [tk.tx + 40, tk.tz + tk.td / 2 - 20],
    ]
    const idx = Math.max(0, liste.indexOf(ekipId)) % pozlar.length
    return pozlar[idx]
  }

  const toplantiOdasiYolu = (hx: number, hz: number): [number, number, number][] => {
    const tk = toplantiKonumRef.current
    if (!tk) return [[hx, FLOOR2_Y, hz]]
    const yol: [number, number, number][] = []
    yol.push([tk.tx, FLOOR2_Y, tk.tz + tk.td / 2 + 2])
    const kuzey = hz < tk.tz - 40
    const bati = hx < tk.tx - 60
    if (kuzey) {
      yol.push([tk.tx + tk.tw / 2 + 20, FLOOR2_Y, tk.tz + tk.td / 2 - 20])
      yol.push([tk.tx + tk.tw / 2 + 20, FLOOR2_Y, tk.tz - tk.td / 2 + 20])
      if (bati) yol.push([tk.tx - tk.tw / 2 + 20, FLOOR2_Y, tk.tz - tk.td / 2 + 20])
    } else if (bati) {
      yol.push([tk.tx - tk.tw / 2 + 20, FLOOR2_Y, tk.tz + tk.td / 2 - 20])
    }
    yol.push([hx, FLOOR2_Y, hz])
    return yol
  }

  const uyeToplantiYolu = (ax: number, az: number, hx: number, hz: number): [number, number, number][] => {
    const nS = Math.ceil(FLOOR2_Y / 8)
    const zStart = ROWS * TILE - 80
    const zEnd = ROWS * TILE - 80 - nS * 16
    const stairX = COLS * TILE - 80
    const yol: [number, number, number][] = [[ax, 0, az]]
    yol.push([ax, 0, TILE * 1.5])
    yol.push([stairX, 0, TILE * 1.5])
    yol.push([stairX, 0, zStart])
    for (let i = 0; i < nS; i++) yol.push([stairX, (i + 1) * 8, ROWS * TILE - 80 - (i + 1) * 16])
    yol.push([stairX, FLOOR2_Y, zEnd])
    yol.push([stairX, FLOOR2_Y, 600])
    yol.push(...toplantiOdasiYolu(hx, hz))
    return yol
  }

  const yoneticiToplantiYolu = (ox2: number, oz2: number, hx: number, hz: number): [number, number, number][] => {
    const tk = toplantiKonumRef.current
    const yol: [number, number, number][] = [[ox2, FLOOR2_Y, oz2]]
    yol.push([ox2, FLOOR2_Y, 385])
    yol.push([900, FLOOR2_Y, 385])
    yol.push([900, FLOOR2_Y, 575])
    if (tk) {
      yol.push([tk.tx + 10, FLOOR2_Y, 575])
      yol.push(...toplantiOdasiYolu(hx, hz))
    } else {
      yol.push([hx, FLOOR2_Y, hz])
    }
    return yol
  }

  const yuruyusuKes = (ekipId: number) => {
    const kayit = aiHaritaRef.current.get(ekipId)
    if (!kayit) return
    const grupSet = new Set<THREE.Group>()
    if (kayit.uye) grupSet.add(kayit.uye.grup)
    if (kayit.yonetici) grupSet.add(kayit.yonetici.grup)
    const h = aiHareketlerRef.current
    for (let i = h.length - 1; i >= 0; i--) {
      if (grupSet.has(h[i].grup)) h.splice(i, 1)
    }
    for (const g of grupSet) raporGrupRef.current.delete(g)
  }

  const gorusmeBaslat = (ekipId: number, tip: 'uye' | 'yonetici') => {
    const kayit = aiHaritaRef.current.get(ekipId)
    const k = useOfisStore.getState().kullanici
    if (!kayit || !k) return
    const g = tip === 'yonetici' ? kayit.yonetici?.grup : kayit.uye?.grup
    if (!g) return
    yuruyusuKes(ekipId)
    gorusmedekiEkipRef.current = ekipId
    const yaw = yawRef.current
    const hx = Math.max(2, Math.min(COLS * TILE - 2, k.konum_x - Math.sin(yaw) * 35))
    const hz = Math.max(2, Math.min(ROWS * TILE - 2, k.konum_y - Math.cos(yaw) * 35))
    const hedefKat = currentFloorRef.current
    const basKat = g.position.y >= FLOOR2_Y - 1 ? 2 : 1
    const yol = yuruyusYolu(g.position.x, g.position.z, basKat, hx, hz, hedefKat)
    aiHareketlerRef.current.push({ grup: g, yollar: yol, hedefIdx: 1, spot: null, oks: null, donus: false })
  }

  const toplantiyaYurut = (ekipId: number) => {
    const kayit = aiHaritaRef.current.get(ekipId)
    if (!kayit) return
    yuruyusuKes(ekipId)
    const koltuk = toplantiKoltugu(ekipId, useOfisStore.getState().toplantiEkipleri)
    if (!koltuk) return
    if (kayit.uye) {
      const yol = uyeToplantiYolu(kayit.uye.oks.x, kayit.uye.oks.z, koltuk[0], koltuk[1])
      aiHareketlerRef.current.push({ grup: kayit.uye.grup, yollar: yol, hedefIdx: 1, spot: kayit.uye.spot, oks: null, donus: false })
      kayit.uye.spot.x = koltuk[0]
      kayit.uye.spot.z = koltuk[1]
    }
    if (kayit.yonetici) {
      const yol = yoneticiToplantiYolu(kayit.yonetici.oks.x, kayit.yonetici.oks.z, koltuk[0], koltuk[1])
      aiHareketlerRef.current.push({ grup: kayit.yonetici.grup, yollar: yol, hedefIdx: 1, spot: kayit.yonetici.spot, oks: null, donus: false })
      kayit.yonetici.spot.x = koltuk[0]
      kayit.yonetici.spot.z = koltuk[1]
    }
  }

  const geriYurut = (ekipId: number, onceki: number[]) => {
    const kayit = aiHaritaRef.current.get(ekipId)
    if (!kayit) return
    yuruyusuKes(ekipId)
    const rapor = raporRef.current.get(ekipId)
    if (rapor && kayit.uye) {
      raporBaslat(ekipId, kayit, rapor)
      return
    }
    const koltuk = toplantiKoltugu(ekipId, onceki)
    if (!koltuk) return
    if (kayit.uye) {
      const yol = uyeToplantiYolu(kayit.uye.oks.x, kayit.uye.oks.z, koltuk[0], koltuk[1]).reverse()
      aiHareketlerRef.current.push({ grup: kayit.uye.grup, yollar: yol, hedefIdx: 1, spot: kayit.uye.spot, oks: kayit.uye.oks, donus: true })
    }
    if (kayit.yonetici) {
      const yol = yoneticiToplantiYolu(kayit.yonetici.oks.x, kayit.yonetici.oks.z, koltuk[0], koltuk[1]).reverse()
      aiHareketlerRef.current.push({ grup: kayit.yonetici.grup, yollar: yol, hedefIdx: 1, spot: kayit.yonetici.spot, oks: kayit.yonetici.oks, donus: true })
    }
  }

  const yuruyusYolu = (ax: number, az: number, basKat: number, hx: number, hz: number, hedefKat: number): [number, number, number][] => {
    const nS = Math.ceil(FLOOR2_Y / 8)
    const zStart = ROWS * TILE - 80
    const zEnd = ROWS * TILE - 80 - nS * 16
    const stairX = COLS * TILE - 80
    const yFloor = basKat === 2 ? FLOOR2_Y : 0
    const yol: [number, number, number][] = [[ax, yFloor, az]]
    if (basKat === hedefKat) {
      if (basKat === 1) {
        yol.push([ax, 0, TILE * 1.5])
        yol.push([hx, 0, TILE * 1.5])
      }
      yol.push([hx, hedefKat === 2 ? FLOOR2_Y : 0, hz])
      return yol
    }
    if (basKat === 1) {
      yol.push([ax, 0, TILE * 1.5])
      yol.push([stairX, 0, TILE * 1.5])
      yol.push([stairX, 0, zStart])
      for (let i = 0; i < nS; i++) yol.push([stairX, (i + 1) * 8, ROWS * TILE - 80 - (i + 1) * 16])
      yol.push([stairX, FLOOR2_Y, zEnd])
      yol.push([stairX, FLOOR2_Y, 600])
      yol.push([hx, FLOOR2_Y, hz])
    } else {
      yol.push([ax, FLOOR2_Y, 385])
      yol.push([900, FLOOR2_Y, 385])
      yol.push([900, FLOOR2_Y, 700])
      yol.push([stairX, FLOOR2_Y, 700])
      yol.push([stairX, FLOOR2_Y, zEnd])
      for (let i = nS - 1; i >= 0; i--) yol.push([stairX, (i + 0.5) * 8, ROWS * TILE - 80 - (i + 1) * 16])
      yol.push([stairX, 0, zStart])
      yol.push([stairX, 0, TILE * 1.5])
      yol.push([hx, 0, hz])
    }
    return yol
  }

  const yuruyusBaslat = (grup: THREE.Group, hx: number, hz: number, hedefKat: number) => {
    const basKat = grup.position.y >= FLOOR2_Y - 1 ? 2 : 1
    const yol = yuruyusYolu(grup.position.x, grup.position.z, basKat, hx, hz, hedefKat)
    aiHareketlerRef.current.push({ grup, yollar: yol, hedefIdx: 1, spot: null, oks: null, donus: false })
  }

  const balonGoster = (metin: string, renk: string, saniye = 8) => {
    const eski = balonRef.current
    if (eski) { eski.balon.parent?.remove(eski.balon); balonRef.current = null }
    const sc = sceneRef.current
    if (!sc) return
    const d = document.createElement('div')
    d.style.cssText = `color:#fff;font-size:12px;font-weight:bold;text-shadow:0 1px 4px rgba(0,0,0,0.9);background:rgba(0,0,0,0.85);border-left:3px solid ${renk};padding:4px 10px;border-radius:6px;white-space:nowrap;pointer-events:none;`
    d.textContent = metin
    const balon = new CSS2DObject(d)
    sc.add(balon)
    balonRef.current = { balon, bitis: Date.now() + saniye * 1000 }
  }

  const raporBaslat = (ekipId: number, kayit: { uye: AiKayit | null }, rapor: { mesaj: string; tamam: boolean; sonYolYenile: number }) => {
    if (!kayit.uye) { raporRef.current.delete(ekipId); return }
    const k = useOfisStore.getState().kullanici
    const hedefKat = useOfisStore.getState().currentFloor
    const g = kayit.uye.grup
    const basKat = g.position.y >= FLOOR2_Y - 1 ? 2 : 1
    const hx = k ? k.konum_x : g.position.x
    const hz = k ? k.konum_y : g.position.z
    const yol = yuruyusYolu(g.position.x, g.position.z, basKat, hx, hz, hedefKat)
    raporGrupRef.current.set(g, ekipId)
    aiHareketlerRef.current.push({ grup: g, yollar: yol, hedefIdx: 1, spot: null, oks: null, donus: false })
  }

  const gorevRaporla = (ekipId: number, mesaj: string, tamam: boolean) => {
    yuruyusuKes(ekipId)
    raporRef.current.set(ekipId, { mesaj, tamam, sonYolYenile: 0 })
    const kayit = aiHaritaRef.current.get(ekipId)
    if (!kayit?.uye) { raporRef.current.delete(ekipId); return }
    if (useOfisStore.getState().toplantiEkipleri.includes(ekipId) || gorusmedekiEkipRef.current === ekipId) {
      raporRef.current.delete(ekipId)
      balonGoster(mesaj, tamam ? '#38a169' : '#d69e2e')
      return
    }
    raporBaslat(ekipId, kayit, raporRef.current.get(ekipId)!)
  }
  useImperativeHandle(forwardRef, () => ({ gorevRaporla }))

  const davranisTara = () => {
    const store = useOfisStore.getState()
    const simdi = performance.now()

    const gorusmede = gorusmedekiEkipRef.current
    if (gorusmede !== null && (store.aktifPanel !== 'sohbet' || store.seciliEkipId !== gorusmede)) {
      gorusmedekiEkipRef.current = null
    }

    if (store.multiplayerMod !== 'katilimci' && simdi - gorevScanRef.current > 2500) {
      gorevScanRef.current = simdi
      const gorevler = store.gorevler
      const ids = new Set<number>()
      const zaman = Date.now()
      for (const g of gorevler) {
        if (!g.id) continue
        ids.add(g.id)
        const kayit = gorevBitisRef.current.get(g.id)
        if (g.durum === 'bekliyor') {
          if (!kayit) {
            gorevBitisRef.current.set(g.id, { bitis: zaman + 120000 + Math.random() * 240000, deneme: 0, ekipId: g.ekip_id })
          } else if (zaman >= kayit.bitis) {
            const tamam = Math.random() < 0.85 || kayit.deneme >= 2
            if (tamam) {
              gorevDurumGuncelle(g.id, 'tamamlandi').catch(() => {})
              store.setGorevlerEkip(g.ekip_id, store.gorevler.map((x) => (x.id === g.id ? { ...x, durum: 'tamamlandi' } : x)))
              gorevSenkronla(g.ekip_id)
              gorevBitisRef.current.delete(g.id)
              gorevRaporla(g.ekip_id, `"${g.icerik}" görevini tamamladım! ✅`, true)
            } else {
              kayit.deneme++
              kayit.bitis = zaman + 60000 + Math.random() * 120000
              gorevRaporla(g.ekip_id, `"${g.icerik}" görevini tamamlayamadım, biraz daha süreye ihtiyacım var ⚠️`, false)
            }
          }
        } else if (kayit) {
          gorevBitisRef.current.delete(g.id)
        }
      }
      for (const [id] of gorevBitisRef.current) if (!ids.has(id)) gorevBitisRef.current.delete(id)
    }

    if (simdi - davranisTickRef.current < 2500) return
    davranisTickRef.current = simdi
    const toplantidaki = store.toplantiEkipleri
    const hareketler = aiHareketlerRef.current

    for (const [ekipId, kayit] of aiHaritaRef.current) {
      if (!kayit.uye) continue
      if (toplantidaki.includes(ekipId) || raporRef.current.has(ekipId) || gorusmedekiEkipRef.current === ekipId) continue
      const g = kayit.uye.grup
      if (hareketler.some((h) => h.grup === g)) continue
      const bekliyor = store.gorevler.some((x) => x.ekip_id === ekipId && x.durum === 'bekliyor')
      const d = davranisRef.current.get(ekipId)
      if (bekliyor) {
        if (!d || d.mod !== 'calisiyor' || !d.isNoktasi) {
          const ekip = store.ekipler.find((e) => e.id === ekipId)
          const tablolar = [30, 80, 130]
          const ox = tablolar[Math.floor(Math.random() * tablolar.length)]
          const is = { x: (ekip?.oda_konum_x ?? 0) + ox, z: (ekip?.oda_konum_y ?? 0) + 22 }
          davranisRef.current.set(ekipId, { mod: 'calisiyor', hedef: null, isNoktasi: is, varisZamani: 0 })
          yuruyusBaslat(g, is.x, is.z, 1)
        } else if (Math.sqrt((g.position.x - d.isNoktasi.x) ** 2 + (g.position.z - d.isNoktasi.z) ** 2) > 6) {
          yuruyusBaslat(g, d.isNoktasi.x, d.isNoktasi.z, 1)
        }
      } else {
        if (!d) {
          davranisRef.current.set(ekipId, { mod: 'serbest', hedef: null, isNoktasi: null, varisZamani: 0 })
          continue
        }
        if (d.mod !== 'serbest') {
          d.mod = 'serbest'
          d.hedef = null
          d.isNoktasi = null
          d.varisZamani = 0
        }
        if (!d.hedef) {
          const hedef = Math.random() < 0.4
            ? SOSYAL_NOKTALAR[Math.floor(Math.random() * SOSYAL_NOKTALAR.length)]
            : GEZINME_NOKTALARI[Math.floor(Math.random() * GEZINME_NOKTALARI.length)]
          yuruyusBaslat(g, hedef.x, hedef.z, 1)
          d.hedef = hedef
          d.varisZamani = simdi + 12000 + Math.random() * 20000
        } else if (Math.sqrt((g.position.x - d.hedef.x) ** 2 + (g.position.z - d.hedef.z) ** 2) < 6 && simdi > d.varisZamani) {
          d.hedef = null
        }
      }
    }

    for (const [ekipId, kayit] of aiHaritaRef.current) {
      if (!kayit.yonetici) continue
      if (toplantidaki.includes(ekipId) || gorusmedekiEkipRef.current === ekipId) continue
      const g = kayit.yonetici.grup
      if (hareketler.some((h) => h.grup === g)) continue
      const bekliyor = store.gorevler.some((x) => x.ekip_id === ekipId && x.durum === 'bekliyor')
      const d = yoneticiDavranisRef.current.get(ekipId)
      if (bekliyor) {
        const oks = kayit.yonetici.oks
        if (Math.sqrt((g.position.x - oks.x) ** 2 + (g.position.z - oks.z) ** 2) > 6) {
          yuruyusBaslat(g, oks.x, oks.z, 2)
        }
        yoneticiDavranisRef.current.delete(ekipId)
      } else {
        if (!d) {
          yoneticiDavranisRef.current.set(ekipId, { hedef: null, varisZamani: 0 })
        } else if (!d.hedef) {
          const ekip = store.ekipler.find((e) => e.id === ekipId)
          const bati = (ekip?.oda_konum_x ?? 100) < 480
          const noktalar = bati ? KAT2_BATI_NOKTALARI : KAT2_DOGU_NOKTALARI
          const hedef = noktalar[Math.floor(Math.random() * noktalar.length)]
          yuruyusBaslat(g, hedef.x, hedef.z, 2)
          d.hedef = hedef
          d.varisZamani = simdi + 30000 + Math.random() * 30000
        } else if (Math.sqrt((g.position.x - d.hedef.x) ** 2 + (g.position.z - d.hedef.z) ** 2) < 6 && simdi > d.varisZamani) {
          d.hedef = null
        }
      }
    }
  }

  const toplantiEkipleri = useOfisStore((s) => s.toplantiEkipleri)

  useEffect(() => {
    const simdiki = toplantiEkipleri
    const onceki = oncekiToplantiRef.current
    for (const eid of simdiki) if (!onceki.includes(eid)) toplantiyaYurut(eid)
    for (const eid of onceki) if (!simdiki.includes(eid)) geriYurut(eid, onceki)
    oncekiToplantiRef.current = simdiki
  }, [toplantiEkipleri])

  const projeler = useOfisStore((s) => s.projeler)

  useEffect(() => {
    const sc = sceneRef.current
    if (!sc) return
    const eski = projeRafGroupRef.current
    if (eski) {
      sc.remove(eski)
      eski.traverse((o) => { if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose() })
    }
    const g = new THREE.Group()
    projeRafGroupRef.current = g
    const rafMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.8 })
    const raf = new THREE.Mesh(new THREE.BoxGeometry(340, 6, 26), rafMat)
    raf.position.set(200, FLOOR2_Y + 38, 418)
    raf.castShadow = true
    g.add(raf)
    for (const [ax, az] of [[80, 405], [320, 405], [80, 431], [320, 431]]) {
      const ayak = new THREE.Mesh(new THREE.BoxGeometry(4, 38, 4), rafMat)
      ayak.position.set(ax, FLOOR2_Y + 19, az)
      g.add(ayak)
    }
    const renkler = [0x4A90D9, 0xD94A4A, 0x38a169, 0xd69e2e, 0x805ad5, 0xdd6b20, 0x06b6d4, 0xec4899, 0x84cc16]
    projeler.forEach((p, i) => {
      if (i >= 9) return
      const renk = renkler[i % renkler.length]
      const kub = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 18), new THREE.MeshStandardMaterial({ color: renk, roughness: 0.35, metalness: 0.25, emissive: renk, emissiveIntensity: 0.12 }))
      kub.position.set(92 + i * 27, FLOOR2_Y + 50, 418)
      kub.castShadow = true
      g.add(kub)
      const d = document.createElement('div')
      d.style.cssText = 'color:#e2e8f0;font-size:10px;font-weight:bold;text-shadow:0 1px 4px rgba(0,0,0,0.9);background:rgba(0,0,0,0.65);padding:1px 6px;border-radius:4px;white-space:nowrap;pointer-events:none;'
      d.textContent = `📁 ${p.ad}`
      const lbl = new CSS2DObject(d)
      lbl.position.set(92 + i * 27, FLOOR2_Y + 66, 418)
      lbl.visible = currentFloorRef.current === 2
      g.add(lbl)
      kat2LabelRefs.current.push(lbl)
    })
    sc.add(g)
  }, [projeler])

  const uzakKullanicilar = useOfisStore((s) => s.uzakKullanicilar)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const mevcut = uzakKarakterlerRef.current

    for (const [pid, obj] of mevcut) {
      if (!uzakKullanicilar.some((u) => u.peerId === pid)) {
        scene.remove(obj.group)
        scene.remove(obj.label)
        mevcut.delete(pid)
        uzakHedefRef.current.delete(pid)
      }
    }

    for (const u of uzakKullanicilar) {
      if (!mevcut.has(u.peerId)) {
        const olusan = uzakKarakterOlustur(scene, u)
        mevcut.set(u.peerId, olusan)
      }
      uzakHedefRef.current.set(u.peerId, { x: u.konum_x, z: u.konum_y, f: u.mevcutKat })
    }
  }, [uzakKullanicilar])

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
  const aiPrompt = useOfisStore((s) => s.aiPrompt)
  const aktifPanel = useOfisStore((s) => s.aktifPanel)

  useEffect(() => {
    if (aktifPanel !== 'harita') {
      document.exitPointerLock()
    }
  }, [aktifPanel])

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
      {(sitPrompt || aiPrompt) && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-gray-900/80 px-5 py-2 rounded-full text-sm text-white select-none pointer-events-none">
          {sitPrompt || aiPrompt}
        </div>
      )}
      {tahtaAktif && (
        <div
          className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-900 rounded-xl p-4 shadow-2xl select-none" style={{ width: 720 }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-bold text-lg">✏️ Yazı Tahtası</span>
              <span className="text-gray-500 text-xs">ESC veya Kapat ile kaydet ve paylaş</span>
            </div>
            <div className="bg-white rounded-lg p-2 mb-3">
              <canvas
                ref={tahtaCizimCanvasRef}
                width={640}
                height={320}
                className="block cursor-crosshair w-full touch-none rounded"
                style={{ aspectRatio: '2 / 1' }}
                onPointerDown={(e) => {
                  const cv = tahtaCizimCanvasRef.current
                  if (!cv) return
                  const rect = cv.getBoundingClientRect()
                  const x = (e.clientX - rect.left) * (cv.width / rect.width)
                  const y = (e.clientY - rect.top) * (cv.height / rect.height)
                  const c = tahtaCizimRef.current
                  c.ciziyor = true
                  c.sonX = x
                  c.sonY = y
                  const ctx = cv.getContext('2d')!
                  ctx.strokeStyle = c.renk
                  ctx.lineWidth = c.boyut
                  ctx.lineCap = 'round'
                  ctx.beginPath()
                  ctx.moveTo(x, y)
                  ctx.lineTo(x + 0.1, y + 0.1)
                  ctx.stroke()
                  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                }}
                onPointerMove={(e) => {
                  const cv = tahtaCizimCanvasRef.current
                  const c = tahtaCizimRef.current
                  if (!cv || !c.ciziyor) return
                  const rect = cv.getBoundingClientRect()
                  const x = (e.clientX - rect.left) * (cv.width / rect.width)
                  const y = (e.clientY - rect.top) * (cv.height / rect.height)
                  const ctx = cv.getContext('2d')!
                  ctx.strokeStyle = c.renk
                  ctx.lineWidth = c.boyut
                  ctx.lineTo(x, y)
                  ctx.stroke()
                  c.sonX = x
                  c.sonY = y
                }}
                onPointerUp={() => { tahtaCizimRef.current.ciziyor = false }}
                onPointerCancel={() => { tahtaCizimRef.current.ciziyor = false }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {([
                  ['Siyah', '#111111', 3],
                  ['Kırmızı', '#e53e3e', 4],
                  ['Mavi', '#3182ce', 4],
                  ['Silgi', '#ffffff', 14],
                ] as [string, string, number][]).map(([ad, renk, boyut]) => (
                  <button
                    key={ad}
                    onClick={() => {
                      tahtaCizimRef.current.renk = renk
                      tahtaCizimRef.current.boyut = boyut
                    }}
                    className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    {ad}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const cv = tahtaCizimCanvasRef.current
                    if (cv) {
                      const ctx = cv.getContext('2d')!
                      ctx.fillStyle = '#ffffff'
                      ctx.fillRect(0, 0, cv.width, cv.height)
                    }
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  🧹 Temizle
                </button>
                <button
                  onClick={tahtaKapat}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  ✔ Kapat ve Paylaş
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {projeAktif && (
        <ProjePaneli
          acik={projeAktif}
          kapat={() => {
            projeAktifRef.current = false
            setProjeAktif(false)
          }}
        />
      )}
    </div>
  )
})
