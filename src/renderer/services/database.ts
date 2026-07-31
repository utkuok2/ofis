import Dexie, { type EntityTable } from 'dexie'
import type { Yonetici, EkipGrubu, Ekip, AIModel, Kullanici, SohbetMesaji, Ayar } from '../types'

const AI_MODELS_SEED: { ad: string; model_id: string }[] = [
  { ad: 'Mistral 7B (Free)', model_id: 'mistralai/mistral-7b-instruct:free' },
  { ad: 'Llama 3.2 3B (Free)', model_id: 'meta-llama/llama-3.2-3b-instruct:free' },
  { ad: 'Phi-3 Mini (Free)', model_id: 'microsoft/phi-3-mini-128k-instruct:free' },
  { ad: 'Gemma 2 2B (Free)', model_id: 'google/gemma-2-2b-it:free' },
  { ad: 'Dolphin Mixtral (Free)', model_id: 'cognitivecomputations/dolphin-mixtral-8x7b:free' },
  { ad: 'OpenRouter Free (Auto)', model_id: 'openrouter/free' },
]

export let db: OfisDatabase

export function initDatabase(username: string): OfisDatabase {
  if (db) db.close()
  db = new OfisDatabase(username)
  return db
}

class OfisDatabase extends Dexie {
  yoneticiler!: EntityTable<Yonetici, 'id'>
  ekipGruplari!: EntityTable<EkipGrubu, 'id'>
  ekipler!: EntityTable<Ekip, 'id'>
  aiModelleri!: EntityTable<AIModel, 'id'>
  kullanici!: EntityTable<Kullanici, 'id'>
  sohbetMesajlari!: EntityTable<SohbetMesaji, 'id'>
  ayarlar!: EntityTable<Ayar, 'key'>

  constructor(username: string) {
    super('ofis_' + username)
    this.version(1).stores({
      yoneticiler: '++id, ad, soyad',
      ekipGruplari: '++id, ad',
      ekipler: '++id, ad, ekip_grubu_id',
      aiModelleri: '++id, ad, model_id',
      kullanici: '++id',
    })
    this.version(2).stores({
      yoneticiler: '++id, ad, soyad',
      ekipGruplari: '++id, ad',
      ekipler: '++id, ad, ekip_grubu_id',
      aiModelleri: '++id, ad, model_id',
      kullanici: '++id',
      sohbetMesajlari: '++id, sessionId, tarih',
    })
    this.version(3).stores({
      yoneticiler: '++id, ad, soyad',
      ekipGruplari: '++id, ad',
      ekipler: '++id, ad, ekip_grubu_id',
      aiModelleri: '++id, ad, model_id, aktif',
      kullanici: '++id',
      sohbetMesajlari: '++id, sessionId, tarih',
    })
    this.version(4).stores({
      yoneticiler: '++id, ad, soyad',
      ekipGruplari: '++id, ad',
      ekipler: '++id, ad, ekip_grubu_id',
      aiModelleri: '++id, ad, model_id, aktif',
      kullanici: '++id',
      sohbetMesajlari: '++id, sessionId, tarih',
    }).upgrade(async (tx) => {
      await tx.table('aiModelleri').toCollection().modify((m: any) => {
        if (m.aktif === true) m.aktif = 1
        if (m.aktif === false) m.aktif = 0
      })
    })
    this.version(5).stores({
      yoneticiler: '++id, ad, soyad',
      ekipGruplari: '++id, ad',
      ekipler: '++id, ad, ekip_grubu_id',
      aiModelleri: '++id, ad, model_id, aktif',
      kullanici: '++id',
      sohbetMesajlari: '++id, sessionId, tarih',
      ayarlar: 'key',
    })
  }

  async initialize() {
    await this.open()

    if (await this.aiModelleri.count() === 0) {
      await this.aiModelleri.bulkAdd(
        AI_MODELS_SEED.map((m, i) => ({
          id: i + 1,
          ...m,
          api_url: 'https://openrouter.ai/api/v1/chat/completions',
          ucretsiz: true,
          aktif: 1,
        }))
      )
    }

    if (await this.yoneticiler.count() === 0) {
      await this.yoneticiler.bulkAdd([
        { id: 1, ad: 'Ahmet', soyad: 'Yılmaz', unvan: 'Takım Lideri', avatar: '', ofis_konum_x: 200, ofis_konum_y: 200 },
        { id: 2, ad: 'Ayşe', soyad: 'Demir', unvan: 'Proje Yöneticisi', avatar: '', ofis_konum_x: 500, ofis_konum_y: 200 },
      ])
    }

    if (await this.ekipGruplari.count() === 0) {
      await this.ekipGruplari.bulkAdd([
        { id: 1, ad: 'Geliştirme', renk: '#4A90D9', kat_no: 1 },
        { id: 2, ad: 'Tasarım', renk: '#D94A4A', kat_no: 1 },
      ])
    }

    if (await this.ekipler.count() === 0) {
      await this.ekipler.bulkAdd([
        { id: 1, ad: 'Frontend Ekibi', ekip_grubu_id: 1, yonetici_id: 1, ai_model_id: 6, oda_konum_x: 60, oda_konum_y: 100, oda_genislik: 180, oda_yukseklik: 100 },
        { id: 2, ad: 'Backend Ekibi', ekip_grubu_id: 1, yonetici_id: 1, ai_model_id: 6, oda_konum_x: 320, oda_konum_y: 100, oda_genislik: 200, oda_yukseklik: 100 },
        { id: 3, ad: 'UI/UX Ekibi', ekip_grubu_id: 2, yonetici_id: 2, ai_model_id: 6, oda_konum_x: 60, oda_konum_y: 280, oda_genislik: 180, oda_yukseklik: 100 },
        { id: 4, ad: 'DevOps Ekibi', ekip_grubu_id: 1, yonetici_id: 1, ai_model_id: 6, oda_konum_x: 320, oda_konum_y: 280, oda_genislik: 200, oda_yukseklik: 100 },
      ])
    }

    if (await this.kullanici.count() === 0) {
      await this.kullanici.add({
        id: 1,
        ad: 'Ben',
        avatar: '',
        konum_x: 400,
        konum_y: 300,
      })
    }
  }
}
