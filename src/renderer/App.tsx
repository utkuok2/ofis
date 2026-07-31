import React, { useEffect, useRef } from 'react'
import { useOfisStore } from './store/useOfisStore'
import { OfficeMap } from './components/OfficeMap/OfficeMap'
import type { OfficeMap3DRef } from './components/OfficeMap/OfficeMap'
import { YonetimPaneli } from './components/Management/YonetimPaneli'
import { SohbetPanel } from './components/Chat/SohbetPanel'
import { Header } from './components/Layout/Header'
import { BildirimToast } from './components/Layout/BildirimToast'
import { GirisEkrani } from './components/Layout/GirisEkrani'
import { onlineOfiseKatil } from './services/multiplayerService'
import { initDatabase } from './services/database'
import { veriYukle, apiKeyYukle, githubBilgiYukle, gorevleriTumuYukle, projeleriYukle } from './services/dbService'

export default function App() {
  const { kullanici, kullaniciAdi, aktifPanel, bekleyenKatil, setBekleyenKatil } = useOfisStore()
  const officeMapRef = useRef<OfficeMap3DRef | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const katil = params.get('katil')
    if (katil) {
      setBekleyenKatil(katil)
      const url = new URL(window.location.href)
      url.searchParams.delete('katil')
      window.history.replaceState({}, '', url)
    }
  }, [setBekleyenKatil])

  useEffect(() => {
    if (!kullaniciAdi || kullanici) return
    const store = useOfisStore.getState()
    const db = initDatabase(kullaniciAdi)
    db.initialize()
      .then(() => veriYukle())
      .then(async (data) => {
        store.setKullanici(data.kullanici || { id: 1, ad: 'Ben', avatar: '', konum_x: 400, konum_y: 400 })
        store.setYoneticiler(data.yoneticiler)
        store.setEkipGruplari(data.ekipGruplari)
        store.setEkipler(data.ekipler)
        store.setAiModelleri(data.aiModelleri)
        store.setApiKey(await apiKeyYukle())
        const gb = await githubBilgiYukle()
        if (gb) {
          store.setGithubBilgi(gb.kullaniciAdi, gb.avatar, gb.token)
          store.setGithubRepoErisim(!!gb.repoErisim)
        }
        store.setGorevler(await gorevleriTumuYukle())
        store.setProjeler(await projeleriYukle())
      })
      .catch(() => {})
  }, [kullaniciAdi, kullanici])

  useEffect(() => {
    if (kullaniciAdi && bekleyenKatil) {
      const hedef = bekleyenKatil
      setBekleyenKatil('')
      onlineOfiseKatil(hedef).catch(() => {
        useOfisStore.getState().bildirimGoster('Ofise katılınamadı: davet kodu bulunamadı', 'hata')
      })
    }
  }, [kullaniciAdi, bekleyenKatil, setBekleyenKatil])

  if (!kullaniciAdi) return <GirisEkrani />

  if (!kullanici) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-xl">Ofis yükleniyor...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <Header />
      <div className="flex-1 relative">
        <OfficeMap ref={officeMapRef} />
        {aktifPanel === 'yonetim' && <YonetimPaneli />}
        {aktifPanel === 'sohbet' && <SohbetPanel officeMapRef={officeMapRef} />}
      </div>
      <BildirimToast />
    </div>
  )
}
