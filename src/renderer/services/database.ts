import Dexie, { type EntityTable } from 'dexie'
import type { Yonetici, EkipGrubu, Ekip, AIModel, Kullanici, SohbetMesaji } from '../types'

const AI_MODELS_SEED: { ad: string; model_id: string }[] = [
  { ad: 'Mistral 7B (Free)', model_id: 'mistralai/mistral-7b-instruct:free' },
  { ad: 'Llama 3.2 3B (Free)', model_id: 'meta-llama/llama-3.2-3b-instruct:free' },
  { ad: 'Phi-3 Mini (Free)', model_id: 'microsoft/phi-3-mini-128k-instruct:free' },
  { ad: 'Gemma 2 2B (Free)', model_id: 'google/gemma-2-2b-it:free' },
  { ad: 'Dolphin Mixtral (Free)', model_id: 'cognitivecomputations/dolphin-mixtral-8x7b:free' },
]

class OfisDatabase extends Dexie {
  yoneticiler!: EntityTable<Yonetici, 'id'>
  ekipGruplari!: EntityTable<EkipGrubu, 'id'>
  ekipler!: EntityTable<Ekip, 'id'>
  aiModelleri!: EntityTable<AIModel, 'id'>
  kullanici!: EntityTable<Kullanici, 'id'>
  sohbetMesajlari!: EntityTable<SohbetMesaji, 'id'>

  constructor() {
    super('ofis')
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
  }

  async initialize() {
    await this.open()
    const modelCount = await this.aiModelleri.count()
    if (modelCount === 0) {
      await this.aiModelleri.bulkAdd(
        AI_MODELS_SEED.map((m) => ({
          ...m,
          api_url: 'https://openrouter.ai/api/v1/chat/completions',
          ucretsiz: true,
          aktif: 1,
        }))
      )
    }

    const userCount = await this.kullanici.count()
    if (userCount === 0) {
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

export const db = new OfisDatabase()
