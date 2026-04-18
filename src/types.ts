// チャプターデータ
export interface Chapter {
  id: string
  title: string
  videoType: 'vimeo' | 'gdrive' | 'other'
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

// 制作履歴
export interface HistoryEntry {
  pageId: string
  title: string
  viewerUrl: string
  updatedAt: string
}
