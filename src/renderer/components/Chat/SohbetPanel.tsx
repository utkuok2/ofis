import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useOfisStore } from '../../store/useOfisStore'
import { aiSohbet, sistemPromptOlustur } from '../../services/aiService'
import { sohbetGecmisiYukle, sohbetMesajiKaydet, sohbetGecmisiTemizle, sessionIdOlustur, apiKeyKaydet } from '../../services/dbService'
import { takimMesajiGonder } from '../../services/multiplayerService'
import type { ChatMessage } from '../../types'

type Sekme = 'ai' | 'takim'

export function SohbetPanel() {
  const { ekipler, aiModelleri, seciliEkipId, setSeciliEkipId, apiKey, setApiKey, multiplayerMod, takimMesajlari, kullaniciAdi, githubAvatar } = useOfisStore()
  const [sekme, setSekme] = useState<Sekme>('ai')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [keyInput, setKeyInput] = useState(apiKey)
  const [takimInput, setTakimInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const takimEndRef = useRef<HTMLDivElement>(null)

  const seciliEkip = ekipler.find((e) => e.id === seciliEkipId)
  const seciliAI = seciliEkip
    ? aiModelleri.find((a) => a.id === seciliEkip.ai_model_id)
    : null

  const sessionId = seciliEkip && seciliAI
    ? sessionIdOlustur(seciliEkip.id, seciliAI.id)
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    takimEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [takimMesajlari])

  const handleGonder = useCallback(async () => {
    if (!input.trim() || !seciliEkip || !seciliAI || !sessionId) return

    const userMsg: ChatMessage = { role: 'user', content: input }
    setInput('')
    setYukleniyor(true)

    sohbetMesajiKaydet({
      sessionId,
      role: 'user',
      content: input,
      tarih: new Date().toISOString(),
    })

    const systemPrompt = sistemPromptOlustur(
      seciliEkip.ad,
      seciliEkip.yonetici_adi || 'Yönetici'
    )

    const allMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
      userMsg,
    ]

    setMessages((prev) => [...prev, userMsg])

    const yanit = await aiSohbet(seciliAI.model_id, allMessages, apiKey)
    setMessages((prev) => [...prev, { role: 'assistant', content: yanit }])
    setYukleniyor(false)

    sohbetMesajiKaydet({
      sessionId,
      role: 'assistant',
      content: yanit,
      tarih: new Date().toISOString(),
    })
  }, [input, seciliEkip, seciliAI, sessionId, messages, apiKey])

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
                <span>🤖 {seciliAI.ad} ile sohbet ediyorsun</span>
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
                  onClick={handleGonder}
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
