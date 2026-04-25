import { supabase } from './supabase'

export interface StorageUsage {
  totalBytes: number
  totalGb: number
  recordingsCount: number
  /** 現在のプランの上限（GB）。null なら無制限 */
  limitGb: number | null
}

/**
 * 自分のfb_recordingsの容量合計を取得
 * Phase 1ではプラン別上限なし、将来的に user_plans テーブルから読む
 */
export async function getMyStorageUsage(): Promise<StorageUsage> {
  const { data, error } = await supabase
    .from('fb_recordings')
    .select('file_size_bytes')
    .eq('status', 'ready')

  if (error) throw error

  const totalBytes = (data || []).reduce(
    (sum: number, r: { file_size_bytes: number | null }) => sum + (r.file_size_bytes || 0),
    0
  )

  return {
    totalBytes,
    totalGb: totalBytes / (1024 ** 3),
    recordingsCount: data?.length ?? 0,
    limitGb: 50, // Phase 1 暫定値、後で user_plans から動的化
  }
}
