import React, { useState, useEffect } from 'react'
import { useOfisStore } from '../../store/useOfisStore'
import {
  yoneticiEkle, yoneticiSil,
  ekipGrubuEkle, ekipGrubuSil,
  ekipEkle, ekipSil, ekipGuncelle,
  veriYukle,
} from '../../services/dbService'
import { ofisVerisiniTumBaglantilaraGonder } from '../../services/multiplayerService'

type AltSekme = 'ekipler' | 'gruplar' | 'yoneticiler'

export function YonetimPaneli() {
  const { yoneticiler, ekipGruplari, ekipler, aiModelleri, setYoneticiler, setEkipGruplari, setEkipler, bildirimGoster } = useOfisStore()
  const [altSekme, setAltSekme] = useState<AltSekme>('ekipler')
  const [islemYapiliyor, setIslemYapiliyor] = useState(false)

  const [yeniAd, setYeniAd] = useState('')
  const [yeniSoyad, setYeniSoyad] = useState('')
  const [yeniUnvan, setYeniUnvan] = useState('')
  const [yeniGrupAd, setYeniGrupAd] = useState('')
  const [yeniGrupRenk, setYeniGrupRenk] = useState('#4A90D9')
  const [yeniEkipAd, setYeniEkipAd] = useState('')
  const [yeniEkipGrup, setYeniEkipGrup] = useState<number>(0)
  const [yeniEkipYonetici, setYeniEkipYonetici] = useState<number>(0)
  const [yeniEkipAI, setYeniEkipAI] = useState<number>(0)

  const [duzenlenenEkip, setDuzenlenenEkip] = useState<number | null>(null)
  const [duzenleAd, setDuzenleAd] = useState('')
  const [duzenleYonetici, setDuzenleYonetici] = useState<number>(0)
  const [duzenleAI, setDuzenleAI] = useState<number>(0)
  const [duzenleX, setDuzenleX] = useState(0)
  const [duzenleY, setDuzenleY] = useState(0)

  const yenile = async () => {
    const data = await veriYukle()
    setYoneticiler(data.yoneticiler)
    setEkipGruplari(data.ekipGruplari)
    setEkipler(data.ekipler)
    ofisVerisiniTumBaglantilaraGonder()
  }

  const handleYoneticiEkle = async () => {
    if (!yeniAd || !yeniSoyad) return
    setIslemYapiliyor(true)
    try {
      await yoneticiEkle(yeniAd, yeniSoyad, yeniUnvan)
      setYeniAd(''); setYeniSoyad(''); setYeniUnvan('')
      await yenile()
      bildirimGoster('Yönetici eklendi', 'basarili')
    } catch { bildirimGoster('Yönetici eklenemedi', 'hata') }
    setIslemYapiliyor(false)
  }

  const handleGrupEkle = async () => {
    if (!yeniGrupAd) return
    setIslemYapiliyor(true)
    try {
      await ekipGrubuEkle(yeniGrupAd, yeniGrupRenk)
      setYeniGrupAd(''); setYeniGrupRenk('#4A90D9')
      await yenile()
      bildirimGoster('Grup eklendi', 'basarili')
    } catch { bildirimGoster('Grup eklenemedi', 'hata') }
    setIslemYapiliyor(false)
  }

  const handleEkipEkle = async () => {
    if (!yeniEkipAd || yeniEkipGrup === 0) return
    setIslemYapiliyor(true)
    try {
      await ekipEkle(yeniEkipAd, yeniEkipGrup, yeniEkipYonetici || null, yeniEkipAI || null)
      setYeniEkipAd(''); setYeniEkipGrup(0); setYeniEkipYonetici(0); setYeniEkipAI(0)
      await yenile()
      bildirimGoster('Ekip oluşturuldu', 'basarili')
    } catch { bildirimGoster('Ekip oluşturulamadı', 'hata') }
    setIslemYapiliyor(false)
  }

  const handleEkipDuzenle = async (id: number) => {
    setIslemYapiliyor(true)
    try {
      await ekipGuncelle(id, duzenleAd, duzenleYonetici || null, duzenleAI || null, duzenleX, duzenleY)
      setDuzenlenenEkip(null)
      await yenile()
      bildirimGoster('Ekip güncellendi', 'basarili')
    } catch { bildirimGoster('Ekip güncellenemedi', 'hata') }
    setIslemYapiliyor(false)
  }

  const handleEkipSil = async (id: number) => {
    setIslemYapiliyor(true)
    try {
      await ekipSil(id)
      await yenile()
      bildirimGoster('Ekip silindi', 'basarili')
    } catch { bildirimGoster('Ekip silinemedi', 'hata') }
    setIslemYapiliyor(false)
  }

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-gray-800 border-l border-gray-700 overflow-y-auto shadow-lg">
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">Yönetim Paneli</h2>

        <div className="flex gap-1 mb-4">
          {(['ekipler', 'gruplar', 'yoneticiler'] as AltSekme[]).map((s) => (
            <button
              key={s}
              onClick={() => setAltSekme(s)}
              className={`px-3 py-1 rounded text-sm ${
                altSekme === s ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {s === 'ekipler' ? 'Ekipler' : s === 'gruplar' ? 'Gruplar' : 'Yöneticiler'}
            </button>
          ))}
        </div>

        {altSekme === 'yoneticiler' && (
          <div>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 px-2 py-1 bg-gray-700 rounded text-sm"
                placeholder="Ad"
                value={yeniAd}
                onChange={(e) => setYeniAd(e.target.value)}
              />
              <input
                className="flex-1 px-2 py-1 bg-gray-700 rounded text-sm"
                placeholder="Soyad"
                value={yeniSoyad}
                onChange={(e) => setYeniSoyad(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 px-2 py-1 bg-gray-700 rounded text-sm"
                placeholder="Ünvan"
                value={yeniUnvan}
                onChange={(e) => setYeniUnvan(e.target.value)}
              />
              <button disabled={islemYapiliyor} onClick={handleYoneticiEkle} className="px-3 py-1 bg-green-600 rounded text-sm whitespace-nowrap disabled:opacity-50">
                Ekle
              </button>
            </div>
            <div className="space-y-1">
              {yoneticiler.map((y) => (
                <div key={y.id} className="flex items-center justify-between px-2 py-1 bg-gray-700 rounded text-sm">
                  <span>{y.ad} {y.soyad} <span className="text-gray-400">({y.unvan})</span></span>
                  <button disabled={islemYapiliyor} onClick={async () => { try { await yoneticiSil(y.id); await yenile(); bildirimGoster('Yönetici silindi', 'basarili') } catch { bildirimGoster('Silinemedi', 'hata') } }} className="text-red-400 hover:text-red-300 disabled:opacity-50">Sil</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {altSekme === 'gruplar' && (
          <div>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 px-2 py-1 bg-gray-700 rounded text-sm"
                placeholder="Grup adı"
                value={yeniGrupAd}
                onChange={(e) => setYeniGrupAd(e.target.value)}
              />
              <input
                type="color"
                className="w-8 h-8 rounded cursor-pointer"
                value={yeniGrupRenk}
                onChange={(e) => setYeniGrupRenk(e.target.value)}
              />
              <button disabled={islemYapiliyor} onClick={handleGrupEkle} className="px-3 py-1 bg-green-600 rounded text-sm disabled:opacity-50">Ekle</button>
            </div>
            <div className="space-y-1">
              {ekipGruplari.map((g) => (
                <div key={g.id} className="flex items-center justify-between px-2 py-1 bg-gray-700 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: g.renk }} />
                    <span>{g.ad}</span>
                  </div>
                  <button disabled={islemYapiliyor} onClick={async () => { try { await ekipGrubuSil(g.id); await yenile(); bildirimGoster('Grup silindi', 'basarili') } catch { bildirimGoster('Silinemedi', 'hata') } }} className="text-red-400 hover:text-red-300 disabled:opacity-50">Sil</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {altSekme === 'ekipler' && (
          <div>
            <div className="space-y-2 mb-3 p-2 bg-gray-700/50 rounded">
              <input
                className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
                placeholder="Ekip adı"
                value={yeniEkipAd}
                onChange={(e) => setYeniEkipAd(e.target.value)}
              />
              <select
                className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
                value={yeniEkipGrup}
                onChange={(e) => setYeniEkipGrup(Number(e.target.value))}
              >
                <option value={0}>Grup seç</option>
                {ekipGruplari.map((g) => (
                  <option key={g.id} value={g.id}>{g.ad}</option>
                ))}
              </select>
              <select
                className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
                value={yeniEkipYonetici}
                onChange={(e) => setYeniEkipYonetici(Number(e.target.value))}
              >
                <option value={0}>Yönetici seç (opsiyonel)</option>
                {yoneticiler.map((y) => (
                  <option key={y.id} value={y.id}>{y.ad} {y.soyad}</option>
                ))}
              </select>
              <select
                className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
                value={yeniEkipAI}
                onChange={(e) => setYeniEkipAI(Number(e.target.value))}
              >
                <option value={0}>AI model seç (opsiyonel)</option>
                {aiModelleri.map((ai) => (
                  <option key={ai.id} value={ai.id}>🤖 {ai.ad}</option>
                ))}
              </select>
              <button disabled={islemYapiliyor} onClick={handleEkipEkle} className="w-full px-3 py-1 bg-green-600 rounded text-sm disabled:opacity-50">Ekip Oluştur</button>
            </div>

            <div className="space-y-2">
              {ekipler.map((ekip) => (
                <div key={ekip.id} className="p-2 bg-gray-700 rounded">
                  {duzenlenenEkip === ekip.id ? (
                    <div className="space-y-1">
                      <input
                        className="w-full px-2 py-1 bg-gray-600 rounded text-sm"
                        value={duzenleAd}
                        onChange={(e) => setDuzenleAd(e.target.value)}
                      />
                      <select
                        className="w-full px-2 py-1 bg-gray-600 rounded text-sm"
                        value={duzenleYonetici}
                        onChange={(e) => setDuzenleYonetici(Number(e.target.value))}
                      >
                        <option value={0}>Yönetici yok</option>
                        {yoneticiler.map((y) => (
                          <option key={y.id} value={y.id}>{y.ad} {y.soyad}</option>
                        ))}
                      </select>
                      <select
                        className="w-full px-2 py-1 bg-gray-600 rounded text-sm"
                        value={duzenleAI}
                        onChange={(e) => setDuzenleAI(Number(e.target.value))}
                      >
                        <option value={0}>AI yok</option>
                        {aiModelleri.map((ai) => (
                          <option key={ai.id} value={ai.id}>{ai.ad}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <input className="w-16 px-1 py-1 bg-gray-600 rounded text-xs text-center" value={duzenleX} onChange={(e) => setDuzenleX(Number(e.target.value))} title="X konumu" placeholder="X" />
                        <input className="w-16 px-1 py-1 bg-gray-600 rounded text-xs text-center" value={duzenleY} onChange={(e) => setDuzenleY(Number(e.target.value))} title="Y konumu" placeholder="Y" />
                      </div>
                      <div className="flex gap-1">
                        <button disabled={islemYapiliyor} onClick={() => handleEkipDuzenle(ekip.id)} className="px-2 py-1 bg-blue-600 rounded text-xs disabled:opacity-50">Kaydet</button>
                        <button onClick={() => setDuzenlenenEkip(null)} className="px-2 py-1 bg-gray-600 rounded text-xs">İptal</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{ekip.ad}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setDuzenlenenEkip(ekip.id)
                              setDuzenleAd(ekip.ad)
                              setDuzenleYonetici(ekip.yonetici_id || 0)
                              setDuzenleAI(ekip.ai_model_id || 0)
                              setDuzenleX(ekip.oda_konum_x)
                              setDuzenleY(ekip.oda_konum_y)
                            }}
                            className="text-blue-400 text-xs hover:text-blue-300"
                          >
                            Düzenle
                          </button>
                          <button disabled={islemYapiliyor} onClick={() => handleEkipSil(ekip.id)} className="text-red-400 text-xs hover:text-red-300 disabled:opacity-50">Sil</button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        <div>Grup: {ekip.ekip_grubu_adi}</div>
                        <div>Yönetici: {ekip.yonetici_adi || 'Atanmamış'}</div>
                        <div>AI: {ekip.ai_model_adi || 'Atanmamış'}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
