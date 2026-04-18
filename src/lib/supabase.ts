// 互換性のための再エクスポート + pro_settings操作
import { supabase } from './supabaseClient'

export { supabase }

// 設定の読み書き（pro_settings）
export async function loadProSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from('pro_settings').select('key, value')
  const settings: Record<string, string> = {}
  data?.forEach((row: { key: string; value: string }) => {
    settings[row.key] = row.value
  })
  return settings
}

export async function saveProSetting(key: string, value: string) {
  await supabase.from('pro_settings').upsert({ key, value }, { onConflict: 'key' })
}

// ユーザーのsubdomainを取得、なければ自動発行
export async function getOrCreateSubdomain(userId: string, email: string): Promise<string> {
  const { data: existing } = await supabase
    .from('user_subdomains')
    .select('subdomain')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.subdomain) return existing.subdomain

  // 新規発行: emailのローカル部分をサニタイズ + 衝突回避のランダム4桁
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
  const candidate = (local || 'user') + '-' + Math.random().toString(36).slice(2, 6)

  await supabase.from('user_subdomains').insert({
    user_id: userId,
    user_email: email,
    subdomain: candidate,
    is_active: true,
  })

  return candidate
}
