import { useOfisStore } from '../store/useOfisStore'
import {
  peerOlustur,
  peerKapat,
  baglantiEkle,
  baglantiKaldir,
  mesajGonder,
  herkeseGonder,
  tumBaglantilar,
} from './peerService'
import { veriYukle, gorevleriTumuYukle, gorevleriDegistir } from './dbService'
import type { PeerMesaj, UzakKullanici, Gorev } from '../types'

export function peerIdOlustur(kullaniciAdi: string): string {
  return 'ofis-' + kullaniciAdi.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

function baglantiKur(conn: any) {
  const store = useOfisStore.getState()
  conn.on('open', () => {
    const k = store.kullanici
    mesajGonder(conn, {
      type: 'kullanici_bilgi',
      payload: {
        peerId: useOfisStore.getState().peerId,
        kullaniciAdi: store.kullaniciAdi,
        avatar: store.githubAvatar,
        githubKullanici: store.githubKullanici || store.kullaniciAdi,
        konum_x: k?.konum_x ?? 400,
        konum_y: k?.konum_y ?? 300,
        mevcutKat: store.currentFloor,
      },
    })
    conn.on('data', (d: PeerMesaj) => mesajIsle(conn, d))
  })
  conn.on('close', () => {
    baglantiKaldir(conn.peer)
    const s = useOfisStore.getState()
    s.uzakKullaniciKaldir(conn.peer)
    s.bildirimGoster('Bir kullanıcı ofisten ayrıldı', 'bilgi')
  })
  conn.on('error', () => {
    baglantiKaldir(conn.peer)
    useOfisStore.getState().uzakKullaniciKaldir(conn.peer)
  })
}

function mesajIsle(conn: any, mesaj: PeerMesaj) {
  const store = useOfisStore.getState()
  const p = mesaj.payload

  switch (mesaj.type) {
    case 'kullanici_bilgi': {
      if (store.multiplayerMod === 'evsahibi') {
        const k: UzakKullanici = {
          peerId: p.peerId || conn.peer,
          kullaniciAdi: p.kullaniciAdi,
          avatar: p.avatar || '',
          githubKullanici: p.githubKullanici,
          konum_x: p.konum_x,
          konum_y: p.konum_y,
          mevcutKat: p.mevcutKat,
        }
        store.uzakKullaniciEkle(k)
        store.bildirimGoster(`${p.kullaniciAdi} ofise katıldı`, 'basarili')
        for (const u of useOfisStore.getState().uzakKullanicilar) {
          if (u.peerId !== conn.peer) {
            mesajGonder(conn, { type: 'kullanici_bilgi', payload: { ...u } })
          }
        }
        for (const c of tumBaglantilar()) {
          if (c.peer !== conn.peer) {
            mesajGonder(c, { type: 'kullanici_bilgi', payload: { ...k } })
          }
        }
        ofisVerisiniBaglantiyaGonder(conn)
      } else {
        store.uzakKullaniciEkle({
          peerId: p.peerId,
          kullaniciAdi: p.kullaniciAdi,
          avatar: p.avatar || '',
          githubKullanici: p.githubKullanici,
          konum_x: p.konum_x,
          konum_y: p.konum_y,
          mevcutKat: p.mevcutKat,
        })
      }
      break
    }
    case 'konum_guncelle': {
      store.uzakKullaniciKonumGuncelle(p.peerId, p.x, p.y, p.kat)
      if (store.multiplayerMod === 'evsahibi') {
        for (const c of tumBaglantilar()) {
          if (c.peer !== conn.peer) mesajGonder(c, mesaj)
        }
      }
      break
    }
    case 'ofis_verisi':
    case 'ekip_guncelle': {
      if (store.multiplayerMod === 'katilimci') {
        store.setEkipler(p.ekipler)
        store.setEkipGruplari(p.ekipGruplari)
        store.setYoneticiler(p.yoneticiler)
        store.setAiModelleri(p.aiModelleri)
        if (Array.isArray(p.gorevler)) {
          store.setGorevler(p.gorevler)
          const ekipIdler = new Set<number>(p.gorevler.map((g: Gorev) => g.ekip_id))
          for (const eid of ekipIdler) {
            gorevleriDegistir(eid, p.gorevler.filter((g: Gorev) => g.ekip_id === eid)).catch(() => {})
          }
        }
        if (Array.isArray(p.toplantiEkipleri)) store.setToplantiEkipleri(p.toplantiEkipleri)
      }
      break
    }
    case 'sohbet_mesaji': {
      store.takimMesajiEkle(p)
      if (store.multiplayerMod === 'evsahibi') {
        for (const c of tumBaglantilar()) {
          if (c.peer !== conn.peer) mesajGonder(c, mesaj)
        }
      }
      break
    }
    case 'tahta_guncelle': {
      store.setTahtaDataUrl(p.dataUrl)
      if (store.multiplayerMod === 'evsahibi') {
        for (const c of tumBaglantilar()) {
          if (c.peer !== conn.peer) mesajGonder(c, mesaj)
        }
      }
      break
    }
    case 'gorev_guncelle': {
      const gorevler: Gorev[] = p.gorevler || []
      store.setGorevlerEkip(p.ekipId, gorevler)
      gorevleriDegistir(p.ekipId, gorevler).catch(() => {})
      if (store.multiplayerMod === 'evsahibi') {
        for (const c of tumBaglantilar()) {
          if (c.peer !== conn.peer) mesajGonder(c, mesaj)
        }
      }
      break
    }
    case 'toplanti_guncelle': {
      store.setToplantiEkipleri(p.list || [])
      if (store.multiplayerMod === 'evsahibi') {
        for (const c of tumBaglantilar()) {
          if (c.peer !== conn.peer) mesajGonder(c, mesaj)
        }
      }
      break
    }
  }
}

async function ofisVerisiniBaglantiyaGonder(conn: any) {
  const [data, gorevler] = await Promise.all([veriYukle(), gorevleriTumuYukle()])
  const store = useOfisStore.getState()
  mesajGonder(conn, {
    type: 'ofis_verisi',
    payload: {
      ekipler: data.ekipler,
      ekipGruplari: data.ekipGruplari,
      yoneticiler: data.yoneticiler,
      aiModelleri: data.aiModelleri,
      gorevler,
      toplantiEkipleri: store.toplantiEkipleri,
    },
  })
}

export async function onlineOfisAc(): Promise<string> {
  const store = useOfisStore.getState()
  if (store.multiplayerMod !== 'tek') return store.peerId

  const id = peerIdOlustur(store.githubKullanici || store.kullaniciAdi)
  const peer = await peerOlustur(id)
  store.setPeerId(id)
  store.setMultiplayerMod('evsahibi')
  store.bildirimGoster('Çevrimiçi ofis açıldı!', 'basarili')

  peer.on('connection', (conn) => {
    baglantiEkle(conn)
    baglantiKur(conn)
  })

  return id
}

export async function onlineOfiseKatil(hedefPeerId: string) {
  const store = useOfisStore.getState()
  if (store.multiplayerMod !== 'tek') onlineOfistenAyril()

  const peer = await peerOlustur()
  store.setPeerId(peer.id)
  store.setMultiplayerMod('katilimci')

  const conn = peer.connect(hedefPeerId, { reliable: true })
  baglantiEkle(conn)
  baglantiKur(conn)
}

export function onlineOfistenAyril() {
  peerKapat()
  const store = useOfisStore.getState()
  store.setMultiplayerMod('tek')
  store.setPeerId('')
  store.uzakKullanicilariTemizle()
  store.takimMesajlariniTemizle()
  store.bildirimGoster('Çevrimiçi ofisten ayrıldın', 'bilgi')
}

export function takimMesajiGonder(mesaj: string) {
  const store = useOfisStore.getState()
  if (store.multiplayerMod === 'tek') return
  const m = {
    kullaniciAdi: store.githubKullanici || store.kullaniciAdi,
    mesaj,
    tarih: new Date().toISOString(),
  }
  store.takimMesajiEkle(m)
  herkeseGonder({ type: 'sohbet_mesaji', payload: m })
}

export function tahtaGuncelleGonder(dataUrl: string) {
  if (useOfisStore.getState().multiplayerMod === 'tek') return
  herkeseGonder({ type: 'tahta_guncelle', payload: { dataUrl } })
}

export function gorevSenkronla(ekipId: number) {
  const store = useOfisStore.getState()
  if (store.multiplayerMod === 'tek') return
  const gorevler = store.gorevler.filter((g) => g.ekip_id === ekipId)
  herkeseGonder({ type: 'gorev_guncelle', payload: { ekipId, gorevler } })
}

export function toplantiGonder(list: number[]) {
  const store = useOfisStore.getState()
  store.setToplantiEkipleri(list)
  if (store.multiplayerMod === 'tek') return
  herkeseGonder({ type: 'toplanti_guncelle', payload: { list } })
}

export async function ofisVerisiniTumBaglantilaraGonder() {
  const store = useOfisStore.getState()
  if (store.multiplayerMod !== 'evsahibi') return
  const [data, gorevler] = await Promise.all([veriYukle(), gorevleriTumuYukle()])
  herkeseGonder({
    type: 'ekip_guncelle',
    payload: {
      ekipler: data.ekipler,
      ekipGruplari: data.ekipGruplari,
      yoneticiler: data.yoneticiler,
      aiModelleri: data.aiModelleri,
      gorevler,
      toplantiEkipleri: store.toplantiEkipleri,
    },
  })
}
