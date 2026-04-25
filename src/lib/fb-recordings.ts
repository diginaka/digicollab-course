import { supabase } from './supabase'
import type { FbRecording } from '../components/video-source/types'

/**
 * 自分のfb_recordingsを新しい順で取得
 * status='ready' のもののみ（処理完了済み動画）
 */
export async function listMyRecordings(opts?: {
  filterSourceApp?: string
  limit?: number
}): Promise<FbRecording[]> {
  const limit = opts?.limit ?? 50
  let query = supabase
    .from('fb_recordings')
    .select('id, title, public_url, thumbnail_url, duration_seconds, file_size_bytes, source_app, status, created_at')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (opts?.filterSourceApp && opts.filterSourceApp !== 'all') {
    query = query.eq('source_app', opts.filterSourceApp)
  }

  const { data, error } = await query
  if (error) throw error
  return data as FbRecording[]
}

/**
 * 特定のIDのfb_recordingを取得
 * チャプター編集時にrecording_idから動画情報を引きたい時に使う
 */
export async function getRecordingById(id: string): Promise<FbRecording | null> {
  const { data, error } = await supabase
    .from('fb_recordings')
    .select('id, title, public_url, thumbnail_url, duration_seconds, file_size_bytes, source_app, status, created_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as FbRecording | null
}

/**
 * バイト数を MB / GB 表示に整形
 */
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-'
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

/**
 * 秒数を mm:ss 表示に整形
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
