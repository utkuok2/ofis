import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { UzakKullanici } from '../../types'

const RENKLER = [0x22c55e, 0xef4444, 0xeab308, 0x06b6d4, 0xf97316, 0xec4899, 0x8b5cf6]

export function renkSec(metin: string): number {
  let hash = 0
  for (let i = 0; i < metin.length; i++) {
    hash = metin.charCodeAt(i) + ((hash << 5) - hash)
  }
  return RENKLER[Math.abs(hash) % RENKLER.length]
}

export function uzakKarakterOlustur(
  scene: THREE.Scene,
  kullanici: UzakKullanici
): { group: THREE.Group; label: CSS2DObject } {
  const renk = renkSec(kullanici.peerId || kullanici.githubKullanici)
  const g = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 9, 22, 8),
    new THREE.MeshStandardMaterial({ color: renk, roughness: 0.5, metalness: 0.1 })
  )
  body.position.y = 11
  body.castShadow = true
  g.add(body)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(6, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xf5d0a9, roughness: 0.6 })
  )
  head.position.y = 24
  head.castShadow = true
  g.add(head)

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(6.1, 10, 10, 0, Math.PI * 2, 0.5, 0.8),
    new THREE.MeshStandardMaterial({ color: renk, roughness: 0.3, metalness: 0.2 })
  )
  visor.position.y = 24
  g.add(visor)

  g.position.set(kullanici.konum_x, 0, kullanici.konum_y)
  scene.add(g)

  const d = document.createElement('div')
  d.style.cssText = `color:#fff;font-size:11px;font-weight:bold;text-shadow:0 1px 4px rgba(0,0,0,0.9);background:${'#' + renk.toString(16).padStart(6, '0')}cc;padding:2px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;`
  d.textContent = kullanici.githubKullanici || kullanici.kullaniciAdi
  const label = new CSS2DObject(d)
  label.position.set(kullanici.konum_x, 34, kullanici.konum_y)
  scene.add(label)

  return { group: g, label }
}
