import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import type { PeerMesaj } from '../types'

let peer: Peer | null = null
const baglantilar = new Map<string, DataConnection>()

export function peerOlustur(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    if (peer) peer.destroy()
    const p = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 })
    peer = p
    p.on('open', () => resolve(p))
    p.on('error', (err) => reject(err))
  })
}

export function peerAl(): Peer | null {
  return peer
}

export function baglantiEkle(conn: DataConnection) {
  baglantilar.set(conn.peer, conn)
}

export function baglantiKaldir(peerId: string) {
  baglantilar.delete(peerId)
}

export function tumBaglantilar(): DataConnection[] {
  return Array.from(baglantilar.values())
}

export function mesajGonder(conn: DataConnection, mesaj: PeerMesaj) {
  if (conn.open) conn.send(mesaj)
}

export function herkeseGonder(mesaj: PeerMesaj) {
  for (const conn of baglantilar.values()) {
    if (conn.open) conn.send(mesaj)
  }
}

export function peerKapat() {
  for (const conn of baglantilar.values()) conn.close()
  baglantilar.clear()
  peer?.destroy()
  peer = null
}
