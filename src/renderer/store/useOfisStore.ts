import { create } from 'zustand'
import type { Yonetici, EkipGrubu, Ekip, AIModel, Kullanici, AktifPanel, UzakKullanici, MultiplayerMod, TakimMesaji } from '../types'
import { kullaniciKonumGuncelle } from '../services/dbService'
import { peerKapat } from '../services/peerService'

export interface Bildirim {
  mesaj: string
  tur: 'basarili' | 'hata' | 'bilgi'
  id: number
}

interface OfisState {
  kullanici: Kullanici | null
  yoneticiler: Yonetici[]
  ekipGruplari: EkipGrubu[]
  ekipler: Ekip[]
  aiModelleri: AIModel[]
  aktifPanel: AktifPanel
  seciliEkipId: number | null
  yukleniyor: boolean
  bildirimler: Bildirim[]
  currentFloor: number
  sitPrompt: string
  isSitting: boolean
  aiPrompt: string
  apiKey: string
  kullaniciAdi: string
  githubKullanici: string
  githubAvatar: string
  githubToken: string
  multiplayerMod: MultiplayerMod
  peerId: string
  uzakKullanicilar: UzakKullanici[]
  takimMesajlari: TakimMesaji[]
  bekleyenKatil: string

  setKullanici: (k: Kullanici) => void
  setYoneticiler: (list: Yonetici[]) => void
  setEkipGruplari: (list: EkipGrubu[]) => void
  setEkipler: (list: Ekip[]) => void
  setAiModelleri: (list: AIModel[]) => void
  setAktifPanel: (p: AktifPanel) => void
  setSeciliEkipId: (id: number | null) => void
  setYukleniyor: (b: boolean) => void
  setCurrentFloor: (f: number) => void
  setSitPrompt: (p: string) => void
  setIsSitting: (b: boolean) => void
  setAiPrompt: (p: string) => void
  setApiKey: (key: string) => void
  setKullaniciAdi: (ad: string) => void
  setGithubBilgi: (kullanici: string, avatar: string, token: string) => void
  setMultiplayerMod: (m: MultiplayerMod) => void
  setPeerId: (id: string) => void
  uzakKullaniciEkle: (k: UzakKullanici) => void
  uzakKullaniciKaldir: (peerId: string) => void
  uzakKullaniciKonumGuncelle: (peerId: string, x: number, y: number, kat: number) => void
  uzakKullanicilariTemizle: () => void
  takimMesajiEkle: (m: TakimMesaji) => void
  takimMesajlariniTemizle: () => void
  setBekleyenKatil: (id: string) => void
  cikisYap: () => void
  kullaniciHareket: (dx: number, dy: number) => void
  bildirimGoster: (mesaj: string, tur: Bildirim['tur']) => void
  bildirimKaldir: (id: number) => void
}

let bildirimId = 0

export const useOfisStore = create<OfisState>((set, get) => ({
  kullanici: null,
  yoneticiler: [],
  ekipGruplari: [],
  ekipler: [],
  aiModelleri: [],
  aktifPanel: 'harita',
  seciliEkipId: null,
  yukleniyor: false,
  bildirimler: [],
  currentFloor: 1,
  sitPrompt: '',
  isSitting: false,
  aiPrompt: '',
  apiKey: '',
  kullaniciAdi: localStorage.getItem('ofis_kullanici') || '',
  githubKullanici: '',
  githubAvatar: '',
  githubToken: '',
  multiplayerMod: 'tek',
  peerId: '',
  uzakKullanicilar: [],
  takimMesajlari: [],
  bekleyenKatil: '',

  setKullanici: (k) => set({ kullanici: k }),
  setYoneticiler: (list) => set({ yoneticiler: list }),
  setEkipGruplari: (list) => set({ ekipGruplari: list }),
  setEkipler: (list) => set({ ekipler: list }),
  setAiModelleri: (list) => set({ aiModelleri: list }),
  setAktifPanel: (p) => set({ aktifPanel: p }),
  setSeciliEkipId: (id) => set({ seciliEkipId: id }),
  setYukleniyor: (b) => set({ yukleniyor: b }),
  setCurrentFloor: (f) => set({ currentFloor: f }),
  setSitPrompt: (p) => set({ sitPrompt: p }),
  setIsSitting: (b) => set({ isSitting: b }),
  setAiPrompt: (p) => set({ aiPrompt: p }),
  setApiKey: (key) => set({ apiKey: key }),
  setKullaniciAdi: (ad) => {
    localStorage.setItem('ofis_kullanici', ad)
    set({ kullaniciAdi: ad })
  },
  setGithubBilgi: (kullanici, avatar, token) => {
    set({ githubKullanici: kullanici, githubAvatar: avatar, githubToken: token })
  },
  setMultiplayerMod: (m) => set({ multiplayerMod: m }),
  setPeerId: (id) => set({ peerId: id }),
  uzakKullaniciEkle: (k) => {
    set((s) => {
      if (s.uzakKullanicilar.some((u) => u.peerId === k.peerId)) return s
      return { uzakKullanicilar: [...s.uzakKullanicilar, k] }
    })
  },
  uzakKullaniciKaldir: (peerId) => {
    set((s) => ({ uzakKullanicilar: s.uzakKullanicilar.filter((u) => u.peerId !== peerId) }))
  },
  uzakKullaniciKonumGuncelle: (peerId, x, y, kat) => {
    set((s) => ({
      uzakKullanicilar: s.uzakKullanicilar.map((u) =>
        u.peerId === peerId ? { ...u, konum_x: x, konum_y: y, mevcutKat: kat } : u
      ),
    }))
  },
  uzakKullanicilariTemizle: () => set({ uzakKullanicilar: [] }),
  takimMesajiEkle: (m) => set((s) => ({ takimMesajlari: [...s.takimMesajlari, m] })),
  takimMesajlariniTemizle: () => set({ takimMesajlari: [] }),
  setBekleyenKatil: (id) => set({ bekleyenKatil: id }),
  cikisYap: () => {
    peerKapat()
    localStorage.removeItem('ofis_kullanici')
    set({ kullaniciAdi: '', kullanici: null, yoneticiler: [], ekipGruplari: [], ekipler: [], aiModelleri: [], apiKey: '', seciliEkipId: null, githubKullanici: '', githubAvatar: '', githubToken: '', multiplayerMod: 'tek', peerId: '', uzakKullanicilar: [], takimMesajlari: [], bekleyenKatil: '' })
    window.location.reload()
  },

  kullaniciHareket: (dx, dy) => {
    const k = get().kullanici
    if (!k) return
    const newX = Math.max(0, Math.min(1200, k.konum_x + dx))
    const newY = Math.max(0, Math.min(700, k.konum_y + dy))
    set({ kullanici: { ...k, konum_x: newX, konum_y: newY } })
    kullaniciKonumGuncelle(k.id, newX, newY)
  },

  bildirimGoster: (mesaj, tur) => {
    const id = ++bildirimId
    set((s) => ({ bildirimler: [...s.bildirimler, { mesaj, tur, id }] }))
    setTimeout(() => {
      get().bildirimKaldir(id)
    }, 3000)
  },

  bildirimKaldir: (id) => {
    set((s) => ({ bildirimler: s.bildirimler.filter((b) => b.id !== id) }))
  },
}))
