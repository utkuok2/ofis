const API_URL = 'https://api.github.com'

export interface GithubBilgi {
  kullaniciAdi: string
  avatar: string
  token: string
  repoErisim: boolean
}

export async function githubTokenDogrula(token: string): Promise<GithubBilgi> {
  const resp = await fetch(API_URL + '/user', {
    headers: { Authorization: `Bearer ${token.trim()}` },
  })
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('Geçersiz GitHub tokenı')
    throw new Error(`GitHub doğrulaması başarısız (${resp.status})`)
  }
  const user = await resp.json()
  if (!user.login) throw new Error('GitHub kullanıcısı bulunamadı')
  const scopes = (resp.headers.get('x-oauth-scopes') || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
  const repoErisim = scopes.includes('repo')
  return {
    kullaniciAdi: user.login,
    avatar: user.avatar_url || '',
    token: token.trim(),
    repoErisim,
  }
}
