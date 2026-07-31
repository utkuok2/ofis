import React, { useState } from 'react'
import { useOfisStore } from '../../store/useOfisStore'
import { initDatabase } from '../../services/database'
import { veriYukle, apiKeyYukle, apiKeyKaydet, githubBilgiKaydet, githubBilgiYukle } from '../../services/dbService'
import { githubTokenDogrula } from '../../services/githubAuth'

export function GirisEkrani() {
  const [ad, setAd] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [githubModal, setGithubModal] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const { setKullaniciAdi, setKullanici, setYoneticiler, setEkipGruplari, setEkipler, setAiModelleri, setApiKey, setGithubBilgi } = useOfisStore()

  const ofisYukle = async (kullaniciAdi: string) => {
    setKullaniciAdi(kullaniciAdi)
    const db = initDatabase(kullaniciAdi)
    await db.initialize()
    const data = await veriYukle()

    const eskiKey = localStorage.getItem('zen_api_key_' + kullaniciAdi)
    if (eskiKey) {
      await apiKeyKaydet(eskiKey)
      localStorage.removeItem('zen_api_key_' + kullaniciAdi)
    }
    const savedKey = await apiKeyYukle()
    setApiKey(savedKey)

    const gb = await githubBilgiYukle()
    if (gb) {
      setGithubBilgi(gb.kullaniciAdi, gb.avatar, gb.token)
      useOfisStore.getState().setGithubRepoErisim(!!gb.repoErisim)
    }

    setKullanici(data.kullanici || { id: 1, ad: 'Ben', avatar: '', konum_x: 400, konum_y: 400 })
    setYoneticiler(data.yoneticiler)
    setEkipGruplari(data.ekipGruplari)
    setEkipler(data.ekipler)
    setAiModelleri(data.aiModelleri)
  }

  const handleGiris = async () => {
    const trimmed = ad.trim()
    if (!trimmed) return
    setYukleniyor(true)
    setHata('')
    try {
      await ofisYukle(trimmed)
    } catch (err: any) {
      setHata(err?.message || 'Giriş yapılırken hata oluştu')
      setYukleniyor(false)
    }
  }

  const handleGithubGiris = async () => {
    if (!githubToken.trim()) return
    setYukleniyor(true)
    setHata('')
    try {
      const bilgi = await githubTokenDogrula(githubToken)
      setGithubModal(false)
      setGithubToken('')
      setGithubBilgi(bilgi.kullaniciAdi, bilgi.avatar, bilgi.token)
      useOfisStore.getState().setGithubRepoErisim(bilgi.repoErisim)
      await githubBilgiKaydet(bilgi)
      await ofisYukle(bilgi.kullaniciAdi)
    } catch (err: any) {
      setHata(err?.message || 'GitHub bağlantısı başarısız')
      setYukleniyor(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-80">
        <div className="text-3xl text-center mb-2">🏢</div>
        <h1 className="text-xl font-bold text-center mb-6">Ofis'e Hoş Geldin</h1>
        <div className="flex flex-col gap-3">
          <input
            className="px-4 py-2 bg-gray-700 rounded text-sm text-center outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Adını gir"
            value={ad}
            onChange={(e) => setAd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGiris() }}
            disabled={yukleniyor}
            autoFocus
          />
          <button
            onClick={handleGiris}
            disabled={yukleniyor || !ad.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {yukleniyor ? 'Yükleniyor...' : 'Giriş Yap'}
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex-1 border-t border-gray-600" />
            veya
            <div className="flex-1 border-t border-gray-600" />
          </div>
          <button
            onClick={() => setGithubModal(true)}
            disabled={yukleniyor}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-bold disabled:opacity-50 transition-colors"
          >
            🔵 GitHub ile Bağlan
          </button>
          <div className="text-[10px] text-gray-500 text-center leading-relaxed">
            GitHub ile bağlanmak için kişisel erişim tokenı (PAT) gerekir.
            <br />
            Proje yedekleme için <span className="text-gray-300">repo</span> kapsamı da gerekir.
            <br />
            <a
              href="https://github.com/settings/tokens/new?description=Ofis%20AI&scopes=read:user,repo"
              target="_blank"
              rel="noreferrer"
              className="underline text-blue-400 hover:text-blue-300"
            >
              Token oluştur →
            </a>
          </div>
          {hata && <div className="text-sm text-red-400 text-center">{hata}</div>}
        </div>
      </div>

      {githubModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-96 text-center">
            <div className="text-2xl mb-3">🔵 GitHub ile Bağlan</div>
            <p className="text-sm text-gray-300 mb-3">
              GitHub kişisel erişim tokenını yapıştır. Token yalnızca bu tarayıcıda, kendi ofis veritabanında saklanır.
            </p>
            <input
              type="password"
              className="w-full px-3 py-2 bg-gray-700 rounded text-sm text-center mb-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ghp_... veya github_pat_..."
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGithubGiris() }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setGithubModal(false)}
                disabled={yukleniyor}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleGithubGiris}
                disabled={yukleniyor || !githubToken.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {yukleniyor ? 'Bağlanıyor...' : 'Bağlan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
