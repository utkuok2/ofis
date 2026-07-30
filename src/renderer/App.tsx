import React, { useEffect, useState } from 'react'
import { useOfisStore } from './store/useOfisStore'
import { veriYukle } from './services/dbService'
import { db } from './services/database'
import { OfficeMap } from './components/OfficeMap/OfficeMap'
import { YonetimPaneli } from './components/Management/YonetimPaneli'
import { SohbetPanel } from './components/Chat/SohbetPanel'
import { Header } from './components/Layout/Header'
import { BildirimToast } from './components/Layout/BildirimToast'

export default function App() {
  const { kullanici, aktifPanel, setKullanici, setYoneticiler, setEkipGruplari, setEkipler, setAiModelleri } = useOfisStore()
  const [hata, setHata] = useState('')

  useEffect(() => {
    db.initialize()
      .then(() => veriYukle())
      .then((data) => {
        const user = data.kullanici || { id: 1, ad: 'Ben', avatar: '', konum_x: 400, konum_y: 400 }
        setKullanici(user)
        setYoneticiler(data.yoneticiler)
        setEkipGruplari(data.ekipGruplari)
        setEkipler(data.ekipler)
        setAiModelleri(data.aiModelleri)
      })
      .catch((err) => {
        console.error('Yükleme hatası:', err)
        setHata(err?.message || 'Bilinmeyen hata')
      })
  }, [])

  if (!kullanici) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-xl mb-4">{hata ? 'Yükleme hatası' : 'Ofis yükleniyor...'}</div>
          {hata && (
            <div className="text-sm text-red-400 mb-4 max-w-md px-4">{hata}</div>
          )}
          {hata && (
            <button
              onClick={() => { setHata(''); localStorage.clear(); indexedDB.deleteDatabase('ofis'); window.location.reload() }}
              className="px-4 py-2 bg-blue-600 rounded text-sm"
            >
              Veritabanını Sıfırla ve Yeniden Dene
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <Header />
      <div className="flex-1 relative">
        <OfficeMap />
        {aktifPanel === 'yonetim' && <YonetimPaneli />}
        {aktifPanel === 'sohbet' && <SohbetPanel />}
      </div>
      <BildirimToast />
    </div>
  )
}
