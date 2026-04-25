import type { Chapter } from '../types'
import type { VideoSource } from '../components/video-source/types'

// pages.slots.chapters に保存される snake_case 形状
export interface ChapterSlot {
  id: string
  title: string
  video_url: string
  video_type: Chapter['videoType']
  text_content: string
  attachments: string[]
  display_number: string
  duration: string
  video_source: VideoSource | null
  recording_id: string | null
}

const VALID_VIDEO_TYPES: readonly Chapter['videoType'][] = ['youtube', 'vimeo', 'gdrive', 'other', 'bunny']
const VALID_VIDEO_SOURCES: readonly VideoSource[] = ['recording', 'ai_generated', 'library', 'upload', 'external_url']

function isVideoType(v: unknown): v is Chapter['videoType'] {
  return typeof v === 'string' && (VALID_VIDEO_TYPES as readonly string[]).includes(v)
}

function isVideoSource(v: unknown): v is VideoSource {
  return typeof v === 'string' && (VALID_VIDEO_SOURCES as readonly string[]).includes(v)
}

/**
 * pages.slots.chapters の生データを in-memory Chapter に変換。
 * - 旧データ（video_source 欠落・video_url あり）は 'external_url' にフォールバック。
 * - id は「ch-01」形式／UUID どちらでもそのまま保持。
 */
export function mapDbToChapter(raw: Record<string, unknown>, index: number): Chapter {
  const videoUrl = String(raw.video_url ?? '')
  const videoType = isVideoType(raw.video_type) ? raw.video_type : 'other'
  const videoSource: VideoSource | null = isVideoSource(raw.video_source)
    ? raw.video_source
    : videoUrl ? 'external_url' : null

  return {
    id: String(raw.id ?? `ch-${index}`),
    title: String(raw.title ?? ''),
    videoType,
    videoUrl,
    textContent: String(raw.text_content ?? ''),
    attachments: Array.isArray(raw.attachments) ? raw.attachments.map(String) : [],
    duration: String(raw.duration ?? ''),
    sortOrder: index,
    videoSource,
    recordingId: raw.recording_id ? String(raw.recording_id) : null,
  }
}

/**
 * in-memory Chapter を pages.slots.chapters に書き戻す snake_case 形状に変換。
 * - id は常に `ch-01` 形式で払い直す（ビューアー側が ch-NN を前提）。
 * - attachments は空文字を除外。
 */
export function mapChapterToDb(ch: Chapter, index: number): ChapterSlot {
  return {
    id: `ch-${String(index + 1).padStart(2, '0')}`,
    title: ch.title,
    video_url: ch.videoUrl,
    video_type: ch.videoType,
    text_content: ch.textContent || '',
    attachments: (ch.attachments || []).filter(a => a.trim()),
    display_number: String(index + 1),
    duration: ch.duration || '',
    video_source: ch.videoSource,
    recording_id: ch.recordingId,
  }
}
