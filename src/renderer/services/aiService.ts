import type { ChatMessage, Gorev, Proje, ProjeDosyasi } from '../types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export function gorevContextOlustur(gorevler: Gorev[]): string {
  if (gorevler.length === 0) return 'Takımın için henüz atanmış bir görev yok.'
  const satirlar = gorevler.map((g) => {
    const tarih = new Date(g.tarih).toLocaleDateString('tr-TR')
    return `- [${g.durum === 'tamamlandi' ? '✅ tamamlandı' : '⏳ bekliyor'}] ${g.icerik} (atanma: ${tarih})`
  })
  return 'Takımının güncel görev listesi:\n' + satirlar.join('\n')
}

export function projeContextOlustur(projeler: Proje[], dosyalar: { projeId: number; ad: string; tip: string; icerik: string }[]): string {
  if (projeler.length === 0) return 'Şu anda devam eden bir projeniz yok.'
  const projeSatirlari = projeler.map((p) => {
    const pDosyalar = dosyalar.filter((d) => d.projeId === p.id)
    const dosyaSatirlari = pDosyalar.length > 0
      ? '\n    Dosyalar:\n    ' + pDosyalar.map((d) => `- ${d.ad}${d.icerik ? ':\n      ' + d.icerik.slice(0, 600) : ''}`).join('\n    ')
      : ''
    return `- Proje: ${p.ad} — ${p.aciklama || 'açıklama yok'}${dosyaSatirlari}`
  })
  return 'Şirketinizin projeleri (raporlarında bunlara dayanabilirsin):\n' + projeSatirlari.join('\n')
}

export function gorevEtiketleriniCikar(metin: string): { yeniGorevler: string[]; tamamlananlar: string[]; toplanti: boolean; toplantiBitti: boolean } {
  const yeniGorevler = [...metin.matchAll(/\[GÖREV:\s*([^\]]+)\]/gi)].map((m) => m[1].trim()).filter(Boolean)
  const tamamlananlar = [...metin.matchAll(/\[TAMAMLANDI:\s*([^\]]+)\]/gi)].map((m) => m[1].trim()).filter(Boolean)
  const toplanti = /\[TOPLANTI\]/i.test(metin)
  const toplantiBitti = /\[TOPLANTI\s+BİTTİ\]|\[TOPLANTI\s+BITTI\]/i.test(metin)
  return { yeniGorevler, tamamlananlar, toplanti, toplantiBitti }
}

export function projeEtiketleriniCikar(metin: string): {
  projeler: string[]
  dosyalar: { projeAdi: string; ad: string; icerik: string }[]
} {
  const projeler = [...metin.matchAll(/\[PROJE_OLUŞTUR:\s*([^\]]+)\]/gi)]
    .map((m) => m[1].trim())
    .filter(Boolean)
  const dosyalar: { projeAdi: string; ad: string; icerik: string }[] = []
  const blokRegex = /\[DOSYA_EKLE:\s*([^|\]]+)\s*\|\s*([^\]]+)\]([\s\S]*?)\[\/DOSYA_EKLE\]/gi
  for (const m of metin.matchAll(blokRegex)) {
    const projeAdi = m[1].trim()
    const ad = m[2].trim()
    const icerik = (m[3] || '').trim()
    if (!projeAdi || !ad) continue
    dosyalar.push({ projeAdi, ad, icerik })
  }
  return { projeler, dosyalar }
}

export function etiketlerdenTemizle(metin: string): string {
  return metin
    .replace(/\[GÖREV:\s*[^\]]+\]/gi, '')
    .replace(/\[TAMAMLANDI:\s*[^\]]+\]/gi, '')
    .replace(/\[TOPLANTI\s+BİTTİ\]|\[TOPLANTI\s+BITTI\]|\[TOPLANTI\]/gi, '')
    .replace(/\[PROJE_OLUŞTUR:\s*[^\]]+\]/gi, '')
    .replace(/\[DOSYA_EKLE:\s*[^\]]+\][\s\S]*?\[\/DOSYA_EKLE\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function aiSohbet(
  modelId: string,
  messages: ChatMessage[],
  apiKey?: string
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'HTTP-Referer': 'https://ofis.utkuok2.dev' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  try {
    const response = await fetch(OPENROUTER_URL, {
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

export function sistemPromptOlustur(ekipAdi: string, yoneticiAdi: string, gorevler: Gorev[] = []): string {
  return `Sen bir ofis çalışanısın. "${ekipAdi}" ekibinin bir üyesisin. Yöneticin: ${yoneticiAdi}. Profesyonel, yardımsever ve arkadaş canlısı bir şekilde yanıt ver.
${gorevContextOlustur(gorevler)}
Yöneticin veya bir çalışma arkadaşın "ne yapıyorsun?" veya "ne yapıyorsunuz?" diye sorduğunda, sana atanan görevler üzerinden neyle ilgilendiğini anlat.
Bir görevi tamamladığında yanıtına "[TAMAMLANDI: görev içeriği]" etiketi ekle.
Senden bir projeye dosya eklemen veya proje içeriği yazman istenirse şu etiketleri kullan: "[PROJE_OLUŞTUR: proje adı]" yeni proje oluşturmak için, "[DOSYA_EKLE: proje adı | dosya adı.uzantı]" satırından sonra dosyanın içeriğini yaz ve kapatmak için "[/DOSYA_EKLE]" etiketi ekle. Dosya adına uygun bir uzantı seç (ör. .md, .txt, .js, .ts, .html, .json). Aynı adlı dosya varsa yeni içerikle tekrar "[DOSYA_EKLE]" yazarak üzerine yazabilirsin. İçerik çok uzunsa önemli kısımları eksiksiz, düzenli bir dosya olacak şekilde yaz.`
}

export function yoneticiSistemPromptOlustur(ekipAdi: string, yoneticiAdi: string, gorevler: Gorev[] = [], projeContext: string = ''): string {
  return `Sen "${ekipAdi}" ekibinin yöneticisisin: ${yoneticiAdi}. Görevin ekibini yönetmek, işleri koordine etmek ve ekibinin durumundan haberdar olmaktır.
${gorevContextOlustur(gorevler)}
${projeContext}
Ekip hakkında bilgi istendiğinde veya rapor istendiğinde, kendi kişisel işlerinden değil EKİBİNİN genel durumundan bahset: ekip arkadaşlarının (ekip üyelerinin) şu anda ne yaptığını, hangi görevlerle ilgilendiklerini, projelerde ne kadar ilerleme olduğunu özetleyen düzenli bir ekip durum raporu ver.
Ekip üyelerine görev atamak için yanıtına "[GÖREV: görev içeriği]" etiketi ekle (her görev için ayrı etiket).
Bir görev tamamlandığında veya ekip üyesi tamamladığını bildirdiğinde "[TAMAMLANDI: görev içeriği]" etiketi ekle.
Ekip toplantısı başlatmak istersen "[TOPLANTI]", toplantıyı bitirmek için "[TOPLANTI BİTTİ]" etiketi ekle.
Senden bir projeye dosya eklemen, proje oluşturman veya proje içeriği yazman istenirse bunu mutlaka yapmalısın, sadece anlatıp geçme: yeni proje için "[PROJE_OLUŞTUR: proje adı]", dosya için "[DOSYA_EKLE: proje adı | dosya adı.uzantı]" satırından sonra dosyanın içeriğini yaz ve kapatmak için "[/DOSYA_EKLE]" etiketi ekle. Dosya adına uygun bir uzantı seç (ör. .md, .txt, .js, .ts, .html, .json, .css). Aynı adlı dosya varsa yeni içerikle tekrar "[DOSYA_EKLE]" yazarak üzerine yazabilirsin. İçerik çok uzunsa eksiksiz ve düzenli bir dosya olacak şekilde yaz. İşlemi yaptıktan sonra kullanıcıya kısa bir özet ver.
Profesyonel, net ve öz yanıtlar ver.`
}
