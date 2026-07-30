import Dexie, { type EntityTable } from 'dexie'
import type { Yonetici, EkipGrubu, Ekip, AIModel, Kullanici, SohbetMesaji } from '../types'

const AI_MODELS_SEED: { ad: string; model_id: string }[] = [
  { ad: 'DeepSeek V4 Flash Free', model_id: 'deepseek-v4-flash-free' },
  { ad: 'MiMo-V2.5 Free', model_id: 'mimo-v2.5-free' },
  { ad: 'Laguna S 2.1 Free', model_id: 'laguna-s-2.1-free' },
  { ad: 'Ling-3.0-flash Free', model_id: 'ling-3.0-flash-free' },
  { ad: 'North Mini Code Free', model_id: 'north-mini-code-free' },
  { ad: 'Nemotron 3 Ultra Free', model_id: 'nemotron-3-ultra-free' },
  { ad: 'Big Pickle', model_id: 'big-pickle' },
  { ad: 'Kimi K2.5 Free', model_id: 'kimi-k2.5-free' },
  { ad: 'MiniMax M2.5 Free', model_id: 'minimax-m2.5-free' },
  { ad: 'GPT 5 Nano', model_id: 'gpt-5-nano' },
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
  }

  async initialize() {
    await this.open()
    const modelCount = await this.aiModelleri.count()
    if (modelCount === 0) {
      await this.aiModelleri.bulkAdd(
        AI_MODELS_SEED.map((m) => ({
          ...m,
          api_url: 'https://opencode.ai/zen/v1/chat/completions',
          ucretsiz: true,
          aktif: true,
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
