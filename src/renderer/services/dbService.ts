import { db } from './database'
import type { Yonetici, EkipGrubu, Ekip, AIModel, Kullanici } from '../types'

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

export async function ekipEkle(
  ad: string,
  ekipGrubuId: number,
  yoneticiId: number | null,
  aiModelId: number | null
): Promise<number> {
  return db.ekipler.add({
    ad,
    ekip_grubu_id: ekipGrubuId,
    yonetici_id: yoneticiId,
    ai_model_id: aiModelId,
    oda_konum_x: Math.random() * 800,
    oda_konum_y: Math.random() * 500,
    oda_genislik: 200,
    oda_yukseklik: 150,
  } as Ekip)
}

export async function ekipSil(id: number) {
  await db.ekipler.delete(id)
}

export async function ekipGuncelle(
  id: number,
  ad: string,
  yoneticiId: number | null,
  aiModelId: number | null
) {
  await db.ekipler.update(id, { ad, yonetici_id: yoneticiId, ai_model_id: aiModelId })
}

export async function kullaniciKonumGuncelle(id: number, konum_x: number, konum_y: number) {
  await db.kullanici.update(id, { konum_x, konum_y })
}
