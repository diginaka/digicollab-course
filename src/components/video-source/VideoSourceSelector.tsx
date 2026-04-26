import type { VideoSource, VideoSourceSelectorProps } from './types'

type CardDef = {
  source: VideoSource
  icon: string
  title: string
  description: string
  fullWidth?: boolean
}

const CARDS: CardDef[] = [
  { source: 'recording',    icon: '🎥', title: '録画する',          description: 'プロンプター内蔵レコーダーで撮影' },
  { source: 'ai_generated', icon: '✨', title: 'AI動画生成',         description: '台本からスライド動画を自動生成' },
  { source: 'library',      icon: '📚', title: 'ライブラリから選択', description: '既存の録画・生成済み動画を再利用' },
  { source: 'upload',       icon: '⬆',  title: 'アップロード',       description: '手元の MP4 を直接アップロード' },
  { source: 'external_url', icon: '🔗', title: '外部URLを貼る',      description: 'Vimeo / YouTube / 直URL（既存互換）', fullWidth: true },
]

export function VideoSourceSelector({ value, onChange, aiGenerationEnabled = false }: VideoSourceSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {CARDS.map(card => {
        const isSelected = value === card.source
        const isDisabled = card.source === 'ai_generated' && !aiGenerationEnabled

        const base = 'rounded-lg p-4 border-2 transition-colors text-left flex items-start gap-3'
        const state = isDisabled
          ? 'border-gray-200 bg-gray-50 opacity-40 cursor-not-allowed'
          : isSelected
          ? 'border-emerald-600 bg-emerald-50 cursor-pointer'
          : 'border-gray-200 bg-white hover:border-emerald-300 cursor-pointer'
        const span = card.fullWidth ? 'sm:col-span-2' : ''

        const description = isDisabled ? `${card.description}（近日公開）` : card.description

        return (
          <button
            key={card.source}
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(card.source)}
            className={`${base} ${state} ${span}`}
          >
            <span aria-hidden className="flex-shrink-0" style={{ fontSize: 20, lineHeight: '1.2' }}>
              {card.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-medium text-gray-900 text-sm">{card.title}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
