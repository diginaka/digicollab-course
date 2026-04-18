import { supabase } from './supabaseClient'

// フロービルダー本体（digicollabo.com）からURLパラメータ経由でSSOを受け取る
export async function initSSO(): Promise<boolean> {
  const url = new URL(window.location.href)
  const accessToken = url.searchParams.get('sso_token')
  const refreshToken = url.searchParams.get('sso_refresh')

  if (!accessToken || !refreshToken) return false

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  // URLからトークンパラメータを除去（履歴を汚さない）
  url.searchParams.delete('sso_token')
  url.searchParams.delete('sso_refresh')
  window.history.replaceState({}, '', url.toString())

  if (error) {
    console.error('[SSO] setSession失敗:', error)
    return false
  }
  return true
}
