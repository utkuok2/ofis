import type { ChatMessage } from '../types'

export async function aiSohbet(
  modelId: string,
  messages: ChatMessage[],
  apiUrl?: string,
  apiKey?: string
): Promise<string> {
  const url = apiUrl || 'https://openrouter.ai/api/v1/chat/completions'
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'HTTP-Referer': 'https://ofis.utkuok2.dev' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
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
