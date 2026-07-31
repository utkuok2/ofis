import React, { useState } from 'react'
import { useOfisStore } from '../../store/useOfisStore'
import { onlineOfisAc, onlineOfiseKatil, onlineOfistenAyril } from '../../services/multiplayerService'
import type { AktifPanel } from '../../types'

const panelItems: { key: AktifPanel; label: string; icon: string }[] = [
  { key: 'harita', label: 'Ofis Haritası', icon: '🏢' },
  { key: 'yonetim', label: 'Yönetim', icon: '⚙️' },
  { key: 'sohbet', label: 'Sohbet', icon: '💬' },
]

export function Header() {
  const { aktifPanel, setAktifPanel, kullaniciAdi, cikisYap, multiplayerMod, peerId, uzakKullanicilar, githubAvatar, bildirimGoster } = useOfisStore()
  const [islemYapiliyor, setIslemYapiliyor] = useState(false)

  const davetLinki = () => {
    const base = window.location.origin + window.location.pathname
    return `${base}?katil=${peerId}`
  }

  const handleOnlineAc = async () => {
    setIslemYapiliyor(true)
    try {
      const id = await onlineOfisAc()
      const link = davetLinki()
      try {
        await navigator.clipboard.writeText(link)
        bildirimGoster('Çevrimiçi ofis açıldı! Davet linki kopyalandı: ' + link, 'basarili')
      } catch {
        bildirimGoster('Çevrimiçi ofis açıldı! Davet kodu: ' + id, 'basarili')
      }
    } catch (err: any) {
      bildirimGoster('Ofis açılamadı: ' + (err?.message || 'bilinmeyen hata'), 'hata')
    }
    setIslemYapiliyor(false)
  }

  const handleKatil = async () => {
    const kod = prompt('Davet kodunu gir (örn: ofis-utkuok2)')
    if (!kod?.trim()) return
    setIslemYapiliyor(true)
    try {
      await onlineOfiseKatil(kod.trim())
      bildirimGoster('Ofise katıldın!', 'basarili')
    } catch (err: any) {
      bildirimGoster('Katılınamadı: ' + (err?.message || 'bilinmeyen hata'), 'hata')
    }
    setIslemYapiliyor(false)
  }

  const handleDavetLinkiKopyala = async () => {
    const link = davetLinki()
    try {
      await navigator.clipboard.writeText(link)
      bildirimGoster('Davet linki kopyalandı: ' + link, 'basarili')
    } catch {
      bildirimGoster('Davet kodu: ' + peerId, 'bilgi')
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 select-none">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold">Ofis</span>
        <button
          onClick={() => {
            if (confirm('Veritabanı sıfırlansın mı? Tüm veriler silinecek ve sayfa yenilenecek.')) {
              const req = indexedDB.deleteDatabase('ofis_' + kullaniciAdi)
              req.onsuccess = () => { localStorage.removeItem('ofis_kullanici'); window.location.reload() }
              req.onerror = () => { localStorage.removeItem('ofis_kullanici'); window.location.reload() }
            }
          }}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
          title="Veritabanını Sıfırla"
        >
          ↺
        </button>
        <span className="text-xs text-gray-400">AI Çalışma Alanı</span>
      </div>
      <div className="flex gap-1 items-center">
        {multiplayerMod === 'tek' && (
          <>
            <button
              onClick={handleOnlineAc}
              disabled={islemYapiliyor}
              className="px-3 py-1.5 rounded text-sm bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
            >
              🌐 Çevrimiçi Ofis Aç
            </button>
            <button
              onClick={handleKatil}
              disabled={islemYapiliyor}
              className="px-3 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              🔗 Katıl
            </button>
          </>
        )}
        {multiplayerMod !== 'tek' && (
          <>
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              {uzakKullanicilar.length + 1} çevrimiçi
            </span>
            <span className="text-xs text-gray-500 font-mono" title="Davet kodu">
              {peerId}
            </span>
            {multiplayerMod === 'evsahibi' && (
              <button
                onClick={handleDavetLinkiKopyala}
                className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
              >
                📋 Linki Kopyala
              </button>
            )}
            <button
              onClick={() => onlineOfistenAyril()}
              className="px-2 py-1 rounded text-xs bg-red-700 hover:bg-red-600 text-white transition-colors"
            >
              ✕ Ayrıl
            </button>
          </>
        )}
        {panelItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setAktifPanel(item.key)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              aktifPanel === item.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-300">
        {githubAvatar && <img src={githubAvatar} alt="" className="w-6 h-6 rounded-full" />}
        <span>👤 {kullaniciAdi}</span>
        <button onClick={cikisYap} className="text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer">
          Çıkış
        </button>
      </div>
    </div>
  )
}
