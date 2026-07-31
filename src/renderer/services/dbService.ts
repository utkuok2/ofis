import { db } from './database'
import type { Yonetici, EkipGrubu, Ekip, AIModel, Kullanici, SohbetMesaji, Gorev, Proje, ProjeDosyasi } from '../types'

export async function veriYukle() {
  const [kullanici, yoneticiler, ekipGruplari, ekipler, aiModelleri] = await Promise.all([
    db.kullanici.get(1),
    db.yoneticiler.toArray(),
    db.ekipGruplari.toArray(),
    db.ekipler.toArray(),
    db.aiModelleri.where('aktif').equals(1).toArray(),
  ])

  const ekiplerJoined: Ekip[] = ekipler.map((e) => {
    const grp = ekipGruplari.find((g) => g.id === e.ekip_grubu_id)
    const yon = yoneticiler.find((y) => y.id === e.yonetici_id)
    const ai = aiModelleri.find((a) => a.id === e.ai_model_id)
    return {
      ...e,
      ekip_grubu_adi: grp?.ad,
      yonetici_adi: yon ? `${yon.ad} ${yon.soyad}` : undefined,
      ai_model_adi: ai?.ad,
      ai_model_id_str: ai?.model_id,
    }
  })

  return {
    kullanici: kullanici || null,
    yoneticiler,
    ekipGruplari,
    ekipler: ekiplerJoined,
    aiModelleri,
  }
}

export async function yoneticiEkle(ad: string, soyad: string, unvan: string): Promise<number> {
  return db.yoneticiler.add({
    ad, soyad, unvan,
    avatar: '',
    ofis_konum_x: 0,
    ofis_konum_y: 0,
  } as Yonetici)
}

export async function yoneticiSil(id: number) {
  await db.yoneticiler.delete(id)
}

export async function ekipGrubuEkle(ad: string, renk: string): Promise<number> {
  return db.ekipGruplari.add({
    ad, renk, kat_no: 1,
  } as EkipGrubu)
}

export async function ekipGrubuSil(id: number) {
  await db.ekipGruplari.delete(id)
}

const ODA_W = 200
const ODA_H = 150
const ODA_GAP = 20
const ODA_COLS = 3

export async function ekipEkle(
  ad: string,
  ekipGrubuId: number,
  yoneticiId: number | null,
  aiModelId: number | null
): Promise<number> {
  const mevcutSayi = await db.ekipler.count()
  const col = mevcutSayi % ODA_COLS
  const row = Math.floor(mevcutSayi / ODA_COLS)
  return db.ekipler.add({
    ad,
    ekip_grubu_id: ekipGrubuId,
    yonetici_id: yoneticiId,
    ai_model_id: aiModelId,
    oda_konum_x: 60 + col * (ODA_W + ODA_GAP),
    oda_konum_y: 60 + row * (ODA_H + ODA_GAP),
    oda_genislik: ODA_W,
    oda_yukseklik: ODA_H,
  } as Ekip)
}

export async function ekipSil(id: number) {
  await db.ekipler.delete(id)
}

export async function ekipGuncelle(
  id: number,
  ad: string,
  yoneticiId: number | null,
  aiModelId: number | null,
  oda_konum_x?: number,
  oda_konum_y?: number
) {
  await db.ekipler.update(id, { ad, yonetici_id: yoneticiId, ai_model_id: aiModelId, oda_konum_x, oda_konum_y })
}

export async function kullaniciKonumGuncelle(id: number, konum_x: number, konum_y: number) {
  await db.kullanici.update(id, { konum_x, konum_y })
}

export function sessionIdOlustur(ekipId: number, aiModelId: number): string {
  return `ekip-${ekipId}-ai-${aiModelId}`
}

export async function sohbetGecmisiYukle(sessionId: string): Promise<SohbetMesaji[]> {
  return db.sohbetMesajlari
    .where('sessionId')
    .equals(sessionId)
    .sortBy('tarih')
}

export async function sohbetMesajiKaydet(mesaj: Omit<SohbetMesaji, 'id'>) {
  await db.sohbetMesajlari.add(mesaj)
}

export async function sohbetGecmisiTemizle(sessionId: string) {
  await db.sohbetMesajlari.where('sessionId').equals(sessionId).delete()
}

export async function apiKeyKaydet(key: string) {
  if (!key) return
  await db.ayarlar.put({ key: 'apiKey', value: key })
}

export async function apiKeyYukle(): Promise<string> {
  const row = await db.ayarlar.get('apiKey')
  return row?.value || ''
}

export async function apiKeySil() {
  await db.ayarlar.delete('apiKey')
}

export async function githubBilgiKaydet(bilgi: { kullaniciAdi: string; avatar: string; token: string; repoErisim?: boolean }) {
  await db.ayarlar.put({ key: 'githubBilgi', value: JSON.stringify(bilgi) })
}

export async function githubBilgiYukle(): Promise<{ kullaniciAdi: string; avatar: string; token: string; repoErisim?: boolean } | null> {
  const row = await db.ayarlar.get('githubBilgi')
  if (!row?.value) return null
  try {
    return JSON.parse(row.value)
  } catch {
    return null
  }
}

export async function gorevleriYukle(ekipId: number): Promise<Gorev[]> {
  return db.gorevler.where('ekip_id').equals(ekipId).sortBy('tarih')
}

export async function gorevleriTumuYukle(): Promise<Gorev[]> {
  return db.gorevler.toArray()
}

export async function gorevEkle(ekipId: number, icerik: string): Promise<number> {
  return (await db.gorevler.add({
    ekip_id: ekipId,
    icerik,
    durum: 'bekliyor',
    tarih: new Date().toISOString(),
  }))!
}

export async function gorevDurumGuncelle(id: number, durum: Gorev['durum']) {
  await db.gorevler.update(id, { durum })
}

export async function gorevSil(id: number) {
  await db.gorevler.delete(id)
}

export async function gorevleriDegistir(ekipId: number, gorevler: Gorev[]) {
  await db.transaction('rw', db.gorevler, async () => {
    await db.gorevler.where('ekip_id').equals(ekipId).delete()
    for (const g of gorevler) {
      await db.gorevler.add({ ekip_id: g.ekip_id, icerik: g.icerik, durum: g.durum, tarih: g.tarih })
    }
  })
}

export async function projeleriYukle(): Promise<Proje[]> {
  return (await db.projeler.toArray()).sort((a, b) => a.olusturma.localeCompare(b.olusturma))
}

export async function projeEkle(ad: string, aciklama: string): Promise<number> {
  return (await db.projeler.add({ ad, aciklama, olusturma: new Date().toISOString() }))!
}

export async function projeSil(id: number) {
  await db.transaction('rw', db.projeler, db.projeDosyalari, async () => {
    await db.projeDosyalari.where('proje_id').equals(id).delete()
    await db.projeler.delete(id)
  })
}

export async function projeDosyalariYukle(projeId: number): Promise<ProjeDosyasi[]> {
  return db.projeDosyalari.where('proje_id').equals(projeId).sortBy('ad')
}

export async function projeDosyasiEkle(d: Omit<ProjeDosyasi, 'id'>): Promise<number> {
  return (await db.projeDosyalari.add(d))!
}

export async function projeDosyasiSil(id: number) {
  await db.projeDosyalari.delete(id)
}
