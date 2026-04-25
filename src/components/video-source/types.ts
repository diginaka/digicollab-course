/**
 * 動画ソースの種別
 * - recording: record.digicollabo.com で録画した動画
 * - ai_generated: Phase V1/V2 の AI 自動生成動画
 * - library: fb_recordings から選択した既存動画（録画 or AI生成）
 * - upload: Bunny Stream へ手動アップロードした動画
 * - external_url: Vimeo/YouTube/直URL（後方互換）
 */
export type VideoSource = 'recording' | 'ai_generated' | 'library' | 'upload' | 'external_url'

export interface VideoSourceSelectorProps {
  value: VideoSource | null
  onChange: (source: VideoSource) => void
  /** AI生成は Phase V1/V2 完成までは disabled 表示 */
  aiGenerationEnabled?: boolean
}

export interface FbRecording {
  id: string
  title: string | null
  public_url: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
  source_app: string | null
  status: string
  created_at: string
}

export interface RecordingLibraryPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (recording: FbRecording) => void
  /** 'all' なら全部、特定の app_id なら絞り込み */
  filterSourceApp?: string | 'all'
}
