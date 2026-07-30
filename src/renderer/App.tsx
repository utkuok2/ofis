import React, { useEffect } from 'react'
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

  useEffect(() => {
    db.initialize().then(() => {
      veriYukle().then((data) => {
        if (data.kullanici) setKullanici(data.kullanici)
        setYoneticiler(data.yoneticiler)
        setEkipGruplari(data.ekipGruplari)
        setEkipler(data.ekipler)
        setAiModelleri(data.aiModelleri)
      })
    })
  }, [])

  if (!kullanici) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-xl">Ofis yükleniyor...</div>
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
