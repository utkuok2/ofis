export interface Yonetici {
  id: number
  ad: string
  soyad: string
  unvan: string
  avatar: string
  ofis_konum_x: number
  ofis_konum_y: number
}

export interface EkipGrubu {
  id: number
  ad: string
  renk: string
  kat_no: number
}

export interface Ekip {
  id: number
  ad: string
  ekip_grubu_id: number
  yonetici_id: number | null
  ai_model_id: number | null
  oda_konum_x: number
  oda_konum_y: number
  oda_genislik: number
  oda_yukseklik: number
  ekip_grubu_adi?: string
  yonetici_adi?: string
  ai_model_adi?: string
  ai_model_id_str?: string
}

export interface AIModel {
  id: number
  ad: string
  model_id: string
  api_url: string
  ucretsiz: boolean
  aktif: number
}

export interface Kullanici {
  id: number
  ad: string
  avatar: string
  konum_x: number
  konum_y: number
}

export interface SohbetMesaji {
  id?: number
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tarih: string
}

export interface Gorev {
  id?: number
  ekip_id: number
  icerik: string
  durum: 'bekliyor' | 'tamamlandi'
  tarih: string
}

export interface Proje {
  id?: number
  ad: string
  aciklama: string
  olusturma: string
}

export interface ProjeDosyasi {
  id?: number
  proje_id: number
  ad: string
  tip: string
  boyut: number
  icerik_base64: string
  tarih: string
}

export type AktifPanel = 'harita' | 'yonetim' | 'sohbet' | 'ayarlar'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface Ayar {
  key: string
  value: string
}

export interface UzakKullanici {
  peerId: string
  kullaniciAdi: string
  avatar: string
  githubKullanici: string
  konum_x: number
  konum_y: number
  mevcutKat: number
}

export type MultiplayerMod = 'tek' | 'evsahibi' | 'katilimci'

export interface TakimMesaji {
  kullaniciAdi: string
  mesaj: string
  tarih: string
}

export type PeerMesajTipi =
  | 'kullanici_bilgi'
  | 'konum_guncelle'
  | 'ofis_verisi'
  | 'sohbet_mesaji'
  | 'ekip_guncelle'
  | 'tahta_guncelle'
  | 'gorev_guncelle'
  | 'toplanti_guncelle'

export interface PeerMesaj {
  type: PeerMesajTipi
  payload: any
}
