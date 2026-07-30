import { create } from 'zustand'
import type { Yonetici, EkipGrubu, Ekip, AIModel, Kullanici, AktifPanel } from '../types'
import { kullaniciKonumGuncelle } from '../services/dbService'

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

  setKullanici: (k: Kullanici) => void
  setYoneticiler: (list: Yonetici[]) => void
  setEkipGruplari: (list: EkipGrubu[]) => void
  setEkipler: (list: Ekip[]) => void
  setAiModelleri: (list: AIModel[]) => void
  setAktifPanel: (p: AktifPanel) => void
  setSeciliEkipId: (id: number | null) => void
  setYukleniyor: (b: boolean) => void
  setCurrentFloor: (f: number) => void
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

  setKullanici: (k) => set({ kullanici: k }),
  setYoneticiler: (list) => set({ yoneticiler: list }),
  setEkipGruplari: (list) => set({ ekipGruplari: list }),
  setEkipler: (list) => set({ ekipler: list }),
  setAiModelleri: (list) => set({ aiModelleri: list }),
  setAktifPanel: (p) => set({ aktifPanel: p }),
  setSeciliEkipId: (id) => set({ seciliEkipId: id }),
  setYukleniyor: (b) => set({ yukleniyor: b }),
  setCurrentFloor: (f) => set({ currentFloor: f }),

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
