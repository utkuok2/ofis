import React, { useEffect, useRef, useState } from 'react'
import { useOfisStore } from '../../store/useOfisStore'
import {
  projeleriYukle,
  projeEkle,
  projeSil,
  projeDosyalariYukle,
  projeDosyasiEkle,
  projeDosyasiSil,
} from '../../services/dbService'
import { projeyiGitHubA, projeyiGitHubdanCek } from '../../services/githubRepo'
import { tipTahmin } from '../../services/dosyaUtil'
import type { ProjeDosyasi } from '../../types'

interface Props {
  acik: boolean
  kapat: () => void
}

export function ProjePaneli({ acik, kapat }: Props) {
  const { projeler, setProjeler, githubKullanici, githubRepoErisim, bildirimGoster } = useOfisStore()
  const [seciliProjeId, setSeciliProjeId] = useState<number | null>(null)
  const [dosyalar, setDosyalar] = useState<ProjeDosyasi[]>([])
  const [projeAd, setProjeAd] = useState('')
  const [projeAciklama, setProjeAciklama] = useState('')
  const [repoAdi, setRepoAdi] = useState(localStorage.getItem('ofis_proje_repo') || 'ofis-projeler')
  const [yukleniyor, setYukleniyor] = useState(false)
  const dosyaInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    projeleriYukle().then(setProjeler)
  }, [setProjeler])

  useEffect(() => {
    if (seciliProjeId == null) {
      setDosyalar([])
      return
    }
    projeDosyalariYukle(seciliProjeId).then(setDosyalar)
  }, [seciliProjeId])

  if (!acik) return null

  const projeOlustur = async () => {
    if (!projeAd.trim()) return
    const id = await projeEkle(projeAd.trim(), projeAciklama.trim())
    setProjeler(await projeleriYukle())
    setSeciliProjeId(id)
    setProjeAd('')
    setProjeAciklama('')
    bildirimGoster(`📁 Proje oluşturuldu`, 'basarili')
  }

  const projeKaldir = async (id: number) => {
    await projeSil(id)
    setProjeler(await projeleriYukle())
    if (seciliProjeId === id) setSeciliProjeId(null)
    bildirimGoster('Proje silindi', 'bilgi')
  }

  const dosyaYukle = async (files: FileList | null) => {
    if (!files || !seciliProjeId) return
    setYukleniyor(true)
    for (const file of Array.from(files)) {
      if (file.size > 50_000_000) {
        bildirimGoster(`${file.name} çok büyük (maks 50MB)`, 'hata')
        continue
      }
      const dataUrl = await new Promise<string>((res, rej) => {
        const okuyucu = new FileReader()
        okuyucu.onload = () => res(okuyucu.result as string)
        okuyucu.onerror = rej
        okuyucu.readAsDataURL(file)
      })
      const icerik = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      await projeDosyasiEkle({
        proje_id: seciliProjeId,
        ad: file.name,
        tip: file.type || tipTahmin(file.name),
        boyut: file.size,
        icerik_base64: icerik,
        tarih: new Date().toISOString(),
      })
    }
    setDosyalar(await projeDosyalariYukle(seciliProjeId))
    setYukleniyor(false)
    if (dosyaInputRef.current) dosyaInputRef.current.value = ''
    bildirimGoster('Dosyalar eklendi', 'basarili')
  }

  const dosyaIndir = (d: ProjeDosyasi) => {
    const link = document.createElement('a')
    link.href = `data:${d.tip};base64,${d.icerik_base64}`
    link.download = d.ad
    link.click()
  }

  const dosyaKaldir = async (d: ProjeDosyasi) => {
    if (!d.id || seciliProjeId == null) return
    await projeDosyasiSil(d.id)
    setDosyalar(await projeDosyalariYukle(seciliProjeId))
  }

  const githubYukle = async () => {
    if (!seciliProjeId) return
    setYukleniyor(true)
    try {
      localStorage.setItem('ofis_proje_repo', repoAdi.trim())
      const proje = projeler.find((p) => p.id === seciliProjeId)
      const sonuc = await projeyiGitHubA(proje?.ad || 'proje', dosyalar)
      bildirimGoster(`☁️ ${sonuc.yuklenen}/${sonuc.toplam} dosya GitHub'a yüklendi`, 'basarili')
    } catch (err: any) {
      bildirimGoster(err?.message || 'GitHub yüklemesi başarısız', 'hata')
    }
    setYukleniyor(false)
  }

  const githubCek = async () => {
    if (!seciliProjeId) return
    setYukleniyor(true)
    try {
      localStorage.setItem('ofis_proje_repo', repoAdi.trim())
      const proje = projeler.find((p) => p.id === seciliProjeId)
      const uzak = await projeyiGitHubdanCek(proje?.ad || 'proje')
      let eklenen = 0
      for (const u of uzak) {
        const varMi = dosyalar.some((d) => d.ad === u.ad)
        if (!varMi) {
          await projeDosyasiEkle({
            proje_id: seciliProjeId,
            ad: u.ad,
            tip: u.tip || tipTahmin(u.ad),
            boyut: u.boyut,
            icerik_base64: u.icerik_base64,
            tarih: new Date().toISOString(),
          })
          eklenen++
        }
      }
      setDosyalar(await projeDosyalariYukle(seciliProjeId))
      bildirimGoster(`☁️ GitHub'dan ${eklenen} dosya çekildi`, 'basarili')
    } catch (err: any) {
      bildirimGoster(err?.message || 'GitHub çekme başarısız', 'hata')
    }
    setYukleniyor(false)
  }

  const seciliProje = projeler.find((p) => p.id === seciliProjeId)

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onKeyDown={(e) => { if (e.key === 'Escape') kapat() }}>
      <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="text-lg font-bold">📁 Proje Odası</div>
          <button
            onClick={kapat}
            className="w-8 h-8 rounded hover:bg-gray-700 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-64 border-r border-gray-700 p-3 flex flex-col gap-2 overflow-y-auto">
            <div className="text-xs font-bold text-gray-400">PROJELER</div>
            {projeler.map((p) => (
              <div
                key={p.id}
                className={`px-2 py-1.5 rounded text-sm cursor-pointer flex items-center justify-between gap-1 ${seciliProjeId === p.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                onClick={() => setSeciliProjeId(p.id!)}
              >
                <span className="truncate">📁 {p.ad}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); if (p.id) projeKaldir(p.id) }}
                  className="text-red-400 hover:text-red-300 text-xs cursor-pointer"
                  title="Projeyi sil"
                >
                  🗑
                </button>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-gray-700 flex flex-col gap-1.5">
              <input
                className="px-2 py-1 bg-gray-700 rounded text-sm"
                placeholder="Proje adı"
                value={projeAd}
                onChange={(e) => setProjeAd(e.target.value)}
              />
              <input
                className="px-2 py-1 bg-gray-700 rounded text-sm"
                placeholder="Açıklama (opsiyonel)"
                value={projeAciklama}
                onChange={(e) => setProjeAciklama(e.target.value)}
              />
              <button
                onClick={projeOlustur}
                disabled={!projeAd.trim()}
                className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-bold disabled:opacity-50 cursor-pointer"
              >
                ➕ Proje Oluştur
              </button>
            </div>
          </div>
          <div className="flex-1 p-3 flex flex-col gap-2 min-w-0">
            {!seciliProje ? (
              <div className="text-center text-gray-500 text-sm mt-10">Soldan bir proje seç</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">📁 {seciliProje.ad}</div>
                    {seciliProje.aciklama && <div className="text-xs text-gray-400">{seciliProje.aciklama}</div>}
                  </div>
                  <input
                    type="file"
                    ref={dosyaInputRef}
                    multiple
                    className="hidden"
                    onChange={(e) => dosyaYukle(e.target.files)}
                  />
                  <button
                    onClick={() => dosyaInputRef.current?.click()}
                    disabled={yukleniyor}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-bold disabled:opacity-50 cursor-pointer"
                  >
                    ⬆ Dosya Ekle
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 bg-gray-900/50 rounded p-2 min-h-0">
                  {dosyalar.length === 0 && <div className="text-center text-gray-600 text-sm mt-6">Henüz dosya yok</div>}
                  {dosyalar.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1.5 text-sm">
                      <span className="truncate flex-1">
                        {d.tip.startsWith('image/') ? '🖼' : d.tip.startsWith('video/') ? '🎬' : d.tip.startsWith('audio/') ? '🎵' : '📄'} {d.ad}
                      </span>
                      <span className="text-xs text-gray-500">{(d.boyut / 1024).toFixed(1)}KB</span>
                      <button onClick={() => dosyaIndir(d)} className="text-blue-400 hover:text-blue-300 cursor-pointer" title="İndir">⬇</button>
                      <button onClick={() => dosyaKaldir(d)} className="text-red-400 hover:text-red-300 cursor-pointer" title="Sil">🗑</button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-700 pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-400">☁️ GitHub:</span>
                  <input
                    className="flex-1 min-w-32 px-2 py-1 bg-gray-700 rounded text-xs"
                    value={repoAdi}
                    onChange={(e) => setRepoAdi(e.target.value)}
                    placeholder="repo-adı"
                  />
                  {!githubKullanici ? (
                    <span className="text-xs text-yellow-400">GitHub bağlantısı yok</span>
                  ) : !githubRepoErisim ? (
                    <span className="text-xs text-yellow-400">Tokenında repo kapsamı yok</span>
                  ) : null}
                  <button
                    onClick={githubYukle}
                    disabled={yukleniyor || !githubRepoErisim}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    ⬆ Yükle
                  </button>
                  <button
                    onClick={githubCek}
                    disabled={yukleniyor || !githubRepoErisim}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    ⬇ Çek
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
