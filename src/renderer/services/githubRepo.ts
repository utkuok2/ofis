import { useOfisStore } from '../store/useOfisStore'
import type { ProjeDosyasi } from '../types'

const API_URL = 'https://api.github.com'

async function ghFetch(path: string, options: RequestInit = {}) {
  const token = useOfisStore.getState().githubToken
  const res = await fetch(API_URL + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  })
  if (res.status === 401) throw new Error('GitHub tokenı geçersiz')
  if (res.status === 403 || res.status === 404) {
    const msg = res.status === 403
      ? 'GitHub erişimi reddedildi — tokenında repo kapsamı yok'
      : 'GitHub kaynağı bulunamadı'
    throw new Error(msg)
  }
  if (!res.ok) throw new Error(`GitHub hatası (${res.status})`)
  return res.json()
}

export async function repoVarMi(owner: string, repo: string): Promise<boolean> {
  try {
    await ghFetch(`/repos/${owner}/${repo}`)
    return true
  } catch {
    return false
  }
}

export async function repoOlustur(ad: string): Promise<string> {
  const data = await ghFetch('/user/repos', {
    method: 'POST',
    body: JSON.stringify({ name: ad, private: true, auto_init: true }),
  })
  return data.default_branch || 'main'
}

async function dosyayiYukle(
  owner: string,
  repo: string,
  dal: string,
  yol: string,
  icerikBase64: string,
  mesaj: string
) {
  let sha: string | null = null
  try {
    const mevcut = await ghFetch(`/repos/${owner}/${repo}/contents/${yol}?ref=${dal}`)
    sha = mevcut.sha
  } catch {
    sha = null
  }
  await ghFetch(`/repos/${owner}/${repo}/contents/${yol}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: mesaj,
      content: icerikBase64,
      sha: sha || undefined,
      branch: dal,
    }),
  })
}

export async function projeyiGitHubA(
  projeAdi: string,
  dosyalar: ProjeDosyasi[]
): Promise<{ yuklenen: number; toplam: number }> {
  const { githubKullanici } = useOfisStore.getState()
  if (!githubKullanici) throw new Error('GitHub bağlantısı yok')
  let repo = localStorage.getItem('ofis_proje_repo') || 'ofis-projeler'
  let dal = 'main'
  if (!(await repoVarMi(githubKullanici, repo))) {
    dal = await repoOlustur(repo)
  } else {
    const bilgi = await ghFetch(`/repos/${githubKullanici}/${repo}`)
    dal = bilgi.default_branch || 'main'
  }
  let yuklenen = 0
  for (const d of dosyalar) {
    const yol = `projeler/${projeAdi}/${d.ad}`
    await dosyayiYukle(
      githubKullanici,
      repo,
      dal,
      yol,
      d.icerik_base64,
      `${projeAdi} güncellemesi: ${d.ad}`
    )
    yuklenen++
  }
  return { yuklenen, toplam: dosyalar.length }
}

export interface UzakDosya {
  ad: string
  tip: string
  boyut: number
  icerik_base64: string
}

export async function projeyiGitHubdanCek(projeAdi: string): Promise<UzakDosya[]> {
  const { githubKullanici } = useOfisStore.getState()
  if (!githubKullanici) throw new Error('GitHub bağlantısı yok')
  const repo = localStorage.getItem('ofis_proje_repo') || 'ofis-projeler'
  let items: { name: string; download_url: string; size: number }[] = []
  try {
    items = await ghFetch(`/repos/${githubKullanici}/${repo}/contents/projeler/${projeAdi}`)
  } catch {
    return []
  }
  const sonuc: UzakDosya[] = []
  for (const item of items) {
    if (item.size > 2_000_000) continue
    const resp = await fetch(item.download_url)
    const buf = await resp.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let ikili = ''
    for (let i = 0; i < bytes.length; i++) ikili += String.fromCharCode(bytes[i])
    sonuc.push({
      ad: item.name,
      tip: '',
      boyut: item.size,
      icerik_base64: btoa(ikili),
    })
  }
  return sonuc
}
