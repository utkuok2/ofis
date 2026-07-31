const MIME_HARITASI: Record<string, string> = {
  txt: 'text/plain', md: 'text/markdown', json: 'application/json',
  js: 'text/javascript', ts: 'text/typescript', html: 'text/html',
  css: 'text/css', xml: 'application/xml', py: 'text/x-python',
  csv: 'text/csv', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', pdf: 'application/pdf',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav',
}

export function tipTahmin(ad: string): string {
  const uz = ad.split('.').pop()?.toLowerCase() || ''
  return MIME_HARITASI[uz] || 'application/octet-stream'
}

export function metinBase64(metin: string): string {
  return btoa(unescape(encodeURIComponent(metin)))
}

export function dosyaAdiTemizle(ad: string): string {
  const temiz = ad.replace(/[\\/:*?"<>|]/g, '_').trim()
  return temiz || 'dosya.txt'
}
