import type { AppSettings, AISettings, ImageGenSettings, RecordSettings, HistoryEntry } from '../types'

const KEYS = {
  settings: 'digicollab-course-settings',
  history: 'digicollab-course-history',
} as const

// デフォルト値
const defaultAI: AISettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o-mini',
  systemPrompt: 'あなたはオンラインコース制作のプロフェッショナルなアシスタントです。ユーザーのコース企画・構成・台本作成を支援してください。日本語で回答してください。',
}

const defaultImageGen: ImageGenSettings = {
  straicoApiKey: '',
}

const defaultRecord: RecordSettings = {
  widgetId: '',
}

// 設定の読み込み
export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(KEYS.settings)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ai: { ...defaultAI, ...parsed.ai },
        imageGen: { ...defaultImageGen, ...parsed.imageGen },
        record: { ...defaultRecord, ...parsed.record },
      }
    }
  } catch { /* ignore */ }
  return { ai: defaultAI, imageGen: defaultImageGen, record: defaultRecord }
}

// 設定の保存
export function saveSettings(settings: AppSettings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings))
}

// 制作履歴
export function loadHistory(): HistoryEntry[] {
  try {
    const stored = localStorage.getItem(KEYS.history)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

export function saveHistory(history: HistoryEntry[]) {
  localStorage.setItem(KEYS.history, JSON.stringify(history))
}

export function addHistory(entry: HistoryEntry) {
  const history = loadHistory()
  const idx = history.findIndex(h => h.pageId === entry.pageId)
  if (idx >= 0) {
    history[idx] = entry
  } else {
    history.unshift(entry)
  }
  saveHistory(history.slice(0, 50))
}
