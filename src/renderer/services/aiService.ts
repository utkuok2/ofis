import type { ChatMessage } from '../types'

const API_URL = 'https://opencode.ai/zen/v1/chat/completions'

export async function aiSohbet(
  modelId: string,
  messages: ChatMessage[]
): Promise<string> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API hatası (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || 'Yanıt alınamadı.'
  } catch (err: any) {
    return `Hata: ${err.message}`
  }
}

export function sistemPromptOlustur(ekipAdi: string, yoneticiAdi: string): string {
  return `Sen bir ofis çalışanısın. "${ekipAdi}" ekibinin bir üyesisin. Yöneticin: ${yoneticiAdi}. Profesyonel, yardımsever ve arkadaş canlısı bir şekilde yanıt ver.`
}
