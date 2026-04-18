// チャプターデータ
export interface Chapter {
  id: string
  title: string
  videoType: 'youtube' | 'vimeo' | 'gdrive' | 'other'
  videoUrl: string
  textContent: string
  attachments: string[]
  duration: string
  sortOrder: number
}

// pagesテーブル用コースパッケージ（フロービルダー統合）
export interface CoursePackage {
  id: string
  pageId: string
  title: string
  description: string
  password: string
  themeColor: string
  thumbnailUrl: string
  chapters: Chapter[]
  subdomain: string
  slug: string
  updatedAt: string
}

// AI設定
export interface AISettings {
  provider: 'openai' | 'gemini' | 'anthropic'
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
}

// 画像生成設定
export interface ImageGenSettings {
  straicoApiKey: string
}

// 録画設定
export interface RecordSettings {
  widgetId: string
}

// 全設定
export interface AppSettings {
  ai: AISettings
  imageGen: ImageGenSettings
  record: RecordSettings
}

// チャットメッセージ
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// AI一括生成 - 入力パラメータ
export interface BulkGenerateInput {
  theme: string            // コーステーマ/対象者
  lessonCount: number      // レッスン数（5-20）
  tone: 'friendly' | 'professional' | 'approachable' | 'authoritative'
}

// AI一括生成 - 生成されたレッスン
export interface GeneratedLesson {
  title: string
  description: string      // 本文（text_content用）
  learningGoal: string     // 学習目標（descriptionに合成される）
  section?: string         // セクション名（11レッスン以上のとき）
}

// AI一括生成 - 生成結果全体
export interface GeneratedCourse {
  courseTitle: string
  courseDescription: string
  thumbnailCopy: string    // SEO description兼用
  totalDuration: string    // 例: "約1時間40分"
  lessons: GeneratedLesson[]
  completionMessage: string
  completionCtaLabel: string
}

// 手動編集保護: ユーザーが上書きしたフィールドの追跡
// キー例: "title", "description", "chapters.0.title", "chapters.2.text_content"
export type UserOverrides = Record<string, boolean>

// 制作履歴
export interface HistoryEntry {
  pageId: string
  title: string
  viewerUrl: string
  updatedAt: string
}
