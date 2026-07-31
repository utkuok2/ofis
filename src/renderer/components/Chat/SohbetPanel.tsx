import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useOfisStore } from '../../store/useOfisStore'
import { aiSohbet, sistemPromptOlustur, yoneticiSistemPromptOlustur, gorevEtiketleriniCikar, projeEtiketleriniCikar, etiketlerdenTemizle, projeContextOlustur } from '../../services/aiService'
import { sohbetGecmisiYukle, sohbetMesajiKaydet, sohbetGecmisiTemizle, sessionIdOlustur, apiKeyKaydet, gorevleriYukle, gorevEkle, gorevDurumGuncelle, gorevSil, projeleriYukle, projeEkle, projeDosyalariYukle, projeDosyasiEkle, projeDosyasiSil } from '../../services/dbService'
import { takimMesajiGonder, gorevSenkronla, toplantiGonder } from '../../services/multiplayerService'
import { tipTahmin, metinBase64, dosyaAdiTemizle } from '../../services/dosyaUtil'
import type { ChatMessage, Gorev } from '../../types'
import type { OfficeMap3DRef } from '../OfficeMap/OfficeMap'

type Sekme = 'ai' | 'takim'

export function SohbetPanel({ officeMapRef }: { officeMapRef?: React.RefObject<OfficeMap3DRef | null> }) {
  const { ekipler, aiModelleri, seciliEkipId, setSeciliEkipId, apiKey, setApiKey, multiplayerMod, takimMesajlari, kullaniciAdi, githubAvatar, sohbetModu, setSohbetModu, gorevler, setGorevlerEkip, toplantiEkipleri, setProjeler } = useOfisStore()
  const [sekme, setSekme] = useState<Sekme>('ai')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [keyInput, setKeyInput] = useState(apiKey)
  const [takimInput, setTakimInput] = useState('')
  const [gorevInput, setGorevInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const takimEndRef = useRef<HTMLDivElement>(null)

  const seciliEkip = ekipler.find((e) => e.id === seciliEkipId)
  const seciliAI = seciliEkip
    ? aiModelleri.find((a) => a.id === seciliEkip.ai_model_id)
    : null

  const sessionId = seciliEkip && seciliAI
    ? sessionIdOlustur(seciliEkip.id, seciliAI.id) + (sohbetModu === 'yonetici' ? '-yonetici' : '')
    : null

  const keyKaydet = useCallback(async (key: string) => {
    await apiKeyKaydet(key)
    setApiKey(key)
  }, [setApiKey])

  useEffect(() => {
    if (sessionId) {
      sohbetGecmisiYukle(sessionId).then((gecmis) => {
        setMessages(gecmis.map((m) => ({ role: m.role, content: m.content })))
      })
    } else {
      setMessages([])
    }
  }, [sessionId])

  useEffect(() => {
    if (!seciliEkipId) return
    const store = useOfisStore.getState()
    if (!store.gorevler.some((g) => g.ekip_id === seciliEkipId)) {
      gorevleriYukle(seciliEkipId).then((list) => setGorevlerEkip(seciliEkipId, list))
    }
  }, [seciliEkipId, setGorevlerEkip])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    takimEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [takimMesajlari])

  const ekipGorevler = gorevler.filter((g) => g.ekip_id === seciliEkipId)
  const toplantida = seciliEkipId ? toplantiEkipleri.includes(seciliEkipId) : false

  const gorevEtiketleriniIsle = async (metin: string) => {
    if (!seciliEkip) return
    const { yeniGorevler, tamamlananlar, toplanti, toplantiBitti } = gorevEtiketleriniCikar(metin)
    const eid = seciliEkip.id
    const bildirim = useOfisStore.getState().bildirimGoster
    for (const icerik of yeniGorevler) {
      const id = await gorevEkle(eid, icerik)
      const g: Gorev = { id, ekip_id: eid, icerik, durum: 'bekliyor', tarih: new Date().toISOString() }
      setGorevlerEkip(eid, [...useOfisStore.getState().gorevler.filter((x) => x.ekip_id === eid), g])
      gorevSenkronla(eid)
      bildirim(`📋 Görev atandı: ${icerik}`, 'bilgi')
      if (multiplayerMod !== 'katilimci') {
        const k = useOfisStore.getState().kullanici
        const msj = `"${icerik}" görevini aldım, hemen başlıyorum! 🏃`
        const harita = officeMapRef.current
        if (harita) harita.gorevRaporla(eid, msj, true)
        else if (k) bildirim(`🤖 ${seciliEkip.ad}: ${msj}`, 'bilgi')
      }
    }
    if (tamamlananlar.length > 0) {
      const bekleyenler = useOfisStore.getState().gorevler.filter((x) => x.ekip_id === eid && x.durum === 'bekliyor' && x.id)
      for (const t of tamamlananlar) {
        const eslesen = bekleyenler.find((m) =>
          t.toLowerCase().includes(m.icerik.toLowerCase().slice(0, 30)) ||
          m.icerik.toLowerCase().includes(t.toLowerCase().slice(0, 30))
        )
        if (eslesen?.id) {
          await gorevDurumGuncelle(eslesen.id, 'tamamlandi')
          setGorevlerEkip(eid, useOfisStore.getState().gorevler.map((x) => (x.id === eslesen.id ? { ...x, durum: 'tamamlandi' } : x)))
          bildirim(`✅ Görev tamamlandı: ${eslesen.icerik}`, 'basarili')
        }
      }
      gorevSenkronla(eid)
    }
    if (sohbetModu === 'yonetici') {
      const simdiki = useOfisStore.getState().toplantiEkipleri
      if (toplanti && !simdiki.includes(eid)) {
        toplantiGonder([...simdiki, eid])
        bildirim(`📢 ${seciliEkip.ad} toplantıya çağrıldı!`, 'bilgi')
      }
      if (toplantiBitti && simdiki.includes(eid)) {
        toplantiGonder(simdiki.filter((x) => x !== eid))
        bildirim(`🏁 ${seciliEkip.ad} toplantısı bitti`, 'bilgi')
      }
    }
  }

  const projeEtiketleriniIsle = async (metin: string) => {
    const bildirim = useOfisStore.getState().bildirimGoster
    const { projeler: yeniProjeler, dosyalar } = projeEtiketleriniCikar(metin)
    let degisti = false
    const olusturulan = new Set<string>()
    for (const ad of yeniProjeler) {
      const varMi = (await projeleriYukle()).some((p) => p.ad.toLowerCase() === ad.toLowerCase())
      if (varMi || olusturulan.has(ad.toLowerCase())) continue
      await projeEkle(ad, '')
      olusturulan.add(ad.toLowerCase())
      degisti = true
      bildirim(`📁 Proje oluşturuldu: ${ad}`, 'basarili')
    }
    for (const dosya of dosyalar) {
      try {
        let proje = (await projeleriYukle()).find((p) => p.ad.toLowerCase() === dosya.projeAdi.toLowerCase())
        if (!proje) {
          await projeEkle(dosya.projeAdi, '')
          proje = (await projeleriYukle()).find((p) => p.ad.toLowerCase() === dosya.projeAdi.toLowerCase())
        }
        if (!proje?.id) continue
        const ad = dosyaAdiTemizle(dosya.ad)
        const icerik = dosya.icerik.slice(0, 200000)
        const eskiler = await projeDosyalariYukle(proje.id)
        const eski = eskiler.find((d) => d.ad.toLowerCase() === ad.toLowerCase())
        if (eski?.id) await projeDosyasiSil(eski.id)
        await projeDosyasiEkle({
          proje_id: proje.id,
          ad,
          tip: tipTahmin(ad),
          boyut: new Blob([icerik]).size,
          icerik_base64: metinBase64(icerik),
          tarih: new Date().toISOString(),
        })
        degisti = true
        bildirim(`📄 ${proje.ad} projesine dosya eklendi: ${ad}`, 'basarili')
      } catch {
        bildirim(`Dosya eklenemedi: ${dosya.ad}`, 'hata')
      }
    }
    if (degisti) setProjeler(await projeleriYukle())
  }

  const projeContextYukle = async (): Promise<string> => {
    const projeler = await projeleriYukle()
    const dosyalar: { projeId: number; ad: string; tip: string; icerik: string }[] = []
    for (const p of projeler) {
      const pDosyalar = await projeDosyalariYukle(p.id!)
      for (const d of pDosyalar) {
        const metin = d.tip.startsWith('text/') || /\.(md|txt|js|ts|json|html|css|xml|py|java|csv)$/i.test(d.ad)
        let icerik = ''
        if (metin && d.boyut <= 100000) {
          try { icerik = decodeURIComponent(escape(atob(d.icerik_base64))) } catch { icerik = '' }
        }
        dosyalar.push({ projeId: p.id!, ad: d.ad, tip: d.tip, icerik })
      }
    }
    return projeContextOlustur(projeler, dosyalar)
  }

  const handleGonder = useCallback(async (metin?: string) => {
    const gonderilecek = (metin ?? input).trim()
    if (!gonderilecek || !seciliEkip || !seciliAI || !sessionId) return

    const userMsg: ChatMessage = { role: 'user', content: gonderilecek }
    setInput('')
    setYukleniyor(true)

    sohbetMesajiKaydet({
      sessionId,
      role: 'user',
      content: gonderilecek,
      tarih: new Date().toISOString(),
    })

    const ekipGorevleri = useOfisStore.getState().gorevler.filter((g) => g.ekip_id === seciliEkip.id)
    let projeContext = ''
    if (sohbetModu === 'yonetici') {
      try { projeContext = await projeContextYukle() } catch { projeContext = '' }
    }
    const systemPrompt = sohbetModu === 'yonetici'
      ? yoneticiSistemPromptOlustur(seciliEkip.ad, seciliEkip.yonetici_adi || 'Yönetici', ekipGorevleri, projeContext)
      : sistemPromptOlustur(seciliEkip.ad, seciliEkip.yonetici_adi || 'Yönetici', ekipGorevleri)

    const allMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
      userMsg,
    ]

    setMessages((prev) => [...prev, userMsg])

    const yanit = await aiSohbet(seciliAI.model_id, allMessages, apiKey)
    const temizYanit = etiketlerdenTemizle(yanit)
    setMessages((prev) => [...prev, { role: 'assistant', content: temizYanit }])
    setYukleniyor(false)

    sohbetMesajiKaydet({
      sessionId,
      role: 'assistant',
      content: temizYanit,
      tarih: new Date().toISOString(),
    })

    gorevEtiketleriniIsle(yanit)
    projeEtiketleriniIsle(yanit)
  }, [input, seciliEkip, seciliAI, sessionId, messages, apiKey, sohbetModu])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGonder()
    }
  }

  const handleTakimGonder = () => {
    if (!takimInput.trim()) return
    takimMesajiGonder(takimInput.trim())
    setTakimInput('')
  }

  const gorevEkleManuel = async () => {
    if (!seciliEkipId || !gorevInput.trim()) return
    const icerik = gorevInput.trim()
    const id = await gorevEkle(seciliEkipId, icerik)
    const g: Gorev = { id, ekip_id: seciliEkipId, icerik, durum: 'bekliyor', tarih: new Date().toISOString() }
    setGorevlerEkip(seciliEkipId, [...useOfisStore.getState().gorevler.filter((x) => x.ekip_id === seciliEkipId), g])
    gorevSenkronla(seciliEkipId)
    setGorevInput('')
    useOfisStore.getState().bildirimGoster(`📋 Görev eklendi: ${icerik}`, 'bilgi')
  }

  const gorevDurumDegistir = async (g: Gorev) => {
    if (!g.id) return
    const yeni = g.durum === 'tamamlandi' ? 'bekliyor' : 'tamamlandi'
    await gorevDurumGuncelle(g.id, yeni)
    setGorevlerEkip(g.ekip_id, useOfisStore.getState().gorevler.map((x) => (x.id === g.id ? { ...x, durum: yeni } : x)))
    gorevSenkronla(g.ekip_id)
  }

  const gorevKaldir = async (g: Gorev) => {
    if (!g.id) return
    await gorevSil(g.id)
    setGorevlerEkip(g.ekip_id, useOfisStore.getState().gorevler.filter((x) => x.id !== g.id))
    gorevSenkronla(g.ekip_id)
  }

  const toplantiDegistir = () => {
    if (!seciliEkipId) return
    const simdiki = useOfisStore.getState().toplantiEkipleri
    const bildirim = useOfisStore.getState().bildirimGoster
    if (simdiki.includes(seciliEkipId)) {
      toplantiGonder(simdiki.filter((x) => x !== seciliEkipId))
      bildirim('🏁 Toplantı bitti, ekip ofise döndü', 'bilgi')
    } else {
      toplantiGonder([...simdiki, seciliEkipId])
      bildirim('📢 Ekip toplantıya çağrıldı!', 'bilgi')
    }
  }

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-gray-800 border-l border-gray-700 flex flex-col shadow-lg">
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setSekme('ai')}
          className={`flex-1 px-3 py-2 text-sm font-bold ${sekme === 'ai' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
        >
          🤖 AI Sohbet
        </button>
        {multiplayerMod !== 'tek' && (
          <button
            onClick={() => setSekme('takim')}
            className={`flex-1 px-3 py-2 text-sm font-bold ${sekme === 'takim' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
          >
            👥 Takım Sohbeti
          </button>
        )}
      </div>

      {sekme === 'ai' && (
        <>
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-bold mb-2">AI Sohbet</h2>
            <select
              className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
              value={seciliEkipId || ''}
              onChange={(e) => {
                setSeciliEkipId(e.target.value ? Number(e.target.value) : null)
                setSohbetModu('ekip')
                setMessages([])
              }}
            >
              <option value="">Ekip seç</option>
              {ekipler
                .filter((e) => e.ai_model_id)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.ad} - {e.ai_model_adi}
                  </option>
                ))}
            </select>
            <div className="mt-2 flex gap-1">
              <input
                className="flex-1 px-2 py-1 bg-gray-700 rounded text-xs"
                placeholder="🔑 Zen API Key"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onBlur={() => { if (keyInput !== apiKey) keyKaydet(keyInput) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { keyKaydet(keyInput); (e.target as HTMLInputElement).blur() } }}
              />
              {keyInput !== apiKey && (
                <button
                  onClick={() => keyKaydet(keyInput)}
                  className="px-2 py-1 bg-blue-600 rounded text-xs"
                >
                  Kaydet
                </button>
              )}
            </div>
            {!apiKey && (
              <div className="text-xs text-yellow-400 mt-1">
                API key gerekli — <a href="https://opencode.ai/auth" target="_blank" className="underline" rel="noreferrer">opencode.ai/auth</a> adresinden al
              </div>
            )}
            {seciliEkip && seciliAI && (
              <div className="text-xs text-gray-400 mt-1 flex items-center justify-between">
                <span>
                  {sohbetModu === 'yonetici'
                    ? `👔 ${seciliEkip.yonetici_adi || 'Yönetici'} (${seciliEkip.ad} Yöneticisi) ile görüşüyorsun`
                    : `🤖 ${seciliAI.ad} ile sohbet ediyorsun`}
                </span>
                <button
                  onClick={async () => {
                    if (sessionId && confirm('Sohbet geçmişi silinsin mi?')) {
                      await sohbetGecmisiTemizle(sessionId)
                      setMessages([])
                    }
                  }}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Temizle
                </button>
              </div>
            )}
            {seciliEkip && sohbetModu === 'yonetici' && (
              <button
                onClick={() => handleGonder('Bana ekibinin şu anki durum raporunu ver: ekip arkadaşların şu anda ne yapıyor, hangi görevlerle ilgileniyor, hangi işlerde ilerleme var?')}
                disabled={yukleniyor}
                className="mt-2 w-full px-2 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold text-white disabled:opacity-50"
              >
                📋 Ekip Raporu İste
              </button>
            )}
            {seciliEkip && sohbetModu === 'yonetici' && (
              <button
                onClick={toplantiDegistir}
                className={`mt-2 w-full px-2 py-1.5 rounded text-xs font-bold text-white ${toplantida ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {toplantida ? '🏁 Toplantıyı Bitir' : '📢 Ekibi Toplantıya Çağır'}
              </button>
            )}
            {seciliEkip && sohbetModu === 'yonetici' && (
              <div className="mt-2">
                <div className="text-xs text-gray-300 font-bold mb-1">📋 Görevler</div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {ekipGorevler.length === 0 && (
                    <div className="text-xs text-gray-500">Henüz görev yok — görev at ya da yöneticiye "şu işi ver" de</div>
                  )}
                  {ekipGorevler.map((g) => (
                    <div key={g.id} className="flex items-center gap-2 text-xs bg-gray-700/60 rounded px-2 py-1">
                      <button
                        onClick={() => gorevDurumDegistir(g)}
                        title="Durumu değiştir"
                        className="cursor-pointer text-sm"
                      >
                        {g.durum === 'tamamlandi' ? '✅' : '⏳'}
                      </button>
                      <span className={`flex-1 break-all ${g.durum === 'tamamlandi' ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                        {g.icerik}
                      </span>
                      <button
                        onClick={() => gorevKaldir(g)}
                        title="Görevi sil"
                        className="text-red-400 hover:text-red-300 cursor-pointer"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 mt-1">
                  <input
                    className="flex-1 px-2 py-1 bg-gray-700 rounded text-xs"
                    placeholder="Yeni görev ekle..."
                    value={gorevInput}
                    onChange={(e) => setGorevInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') gorevEkleManuel() }}
                  />
                  <button
                    onClick={gorevEkleManuel}
                    className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold cursor-pointer"
                  >
                    ➕
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!seciliEkip && (
              <div className="text-center text-gray-500 text-sm mt-8">
                Sohbet etmek için bir ekip ve AI modeli seç
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {yukleniyor && (
              <div className="flex justify-start">
                <div className="bg-gray-700 px-3 py-2 rounded-lg text-sm text-gray-400">
                  🤖 Yazıyor...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {seciliEkip && (
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <textarea
                  className="flex-1 px-3 py-2 bg-gray-700 rounded text-sm resize-none"
                  rows={2}
                  placeholder="Mesajını yaz..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={() => handleGonder()}
                  disabled={yukleniyor || !input.trim()}
                  className="px-4 py-2 bg-blue-600 rounded text-sm disabled:opacity-50 self-end"
                >
                  Gönder
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {sekme === 'takim' && (
        <>
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-bold">👥 Takım Sohbeti</h2>
            <div className="text-xs text-gray-400 mt-1">
              {multiplayerMod === 'evsahibi' ? 'Ev sahibi olarak yayın yapıyorsun' : 'Çevrimiçi ofise bağlısın'}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {takimMesajlari.length === 0 && (
              <div className="text-center text-gray-500 text-sm mt-8">
                Henüz mesaj yok. İlk mesajı sen yaz!
              </div>
            )}
            {takimMesajlari.map((m, i) => (
              <div key={i} className="flex flex-col">
                <div className="text-[10px] text-gray-500 mb-0.5">
                  {m.kullaniciAdi} · {new Date(m.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="bg-gray-700 px-3 py-2 rounded-lg text-sm text-gray-200 max-w-[85%]">
                  {m.mesaj}
                </div>
              </div>
            ))}
            <div ref={takimEndRef} />
          </div>
          <div className="p-4 border-t border-gray-700">
            <div className="flex gap-2">
              {githubAvatar && (
                <img src={githubAvatar} alt="" className="w-8 h-8 rounded-full self-end" />
              )}
              <input
                className="flex-1 px-3 py-2 bg-gray-700 rounded text-sm"
                placeholder={`${kullaniciAdi} olarak yaz...`}
                value={takimInput}
                onChange={(e) => setTakimInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTakimGonder() }}
              />
              <button
                onClick={handleTakimGonder}
                disabled={!takimInput.trim()}
                className="px-4 py-2 bg-green-600 rounded text-sm disabled:opacity-50 self-end"
              >
                Gönder
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
