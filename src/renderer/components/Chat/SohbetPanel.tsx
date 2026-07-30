import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useOfisStore } from '../../store/useOfisStore'
import { aiSohbet, sistemPromptOlustur } from '../../services/aiService'
import { sohbetGecmisiYukle, sohbetMesajiKaydet, sohbetGecmisiTemizle, sessionIdOlustur } from '../../services/dbService'
import type { ChatMessage } from '../../types'

export function SohbetPanel() {
  const { ekipler, aiModelleri, seciliEkipId, setSeciliEkipId, apiKey, setApiKey } = useOfisStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [keyInput, setKeyInput] = useState(apiKey)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const seciliEkip = ekipler.find((e) => e.id === seciliEkipId)
  const seciliAI = seciliEkip
    ? aiModelleri.find((a) => a.id === seciliEkip.ai_model_id)
    : null

  const sessionId = seciliEkip && seciliAI
    ? sessionIdOlustur(seciliEkip.id, seciliAI.id)
    : null

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

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-gray-800 border-l border-gray-700 flex flex-col shadow-lg">
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
            onBlur={() => { if (keyInput !== apiKey) setApiKey(keyInput) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setApiKey(keyInput); (e.target as HTMLInputElement).blur() } }}
          />
          {keyInput !== apiKey && (
            <button
              onClick={() => setApiKey(keyInput)}
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
    </div>
  )
}
