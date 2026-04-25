import { useEffect, useState } from 'react'
import { listMyRecordings, formatDuration, formatFileSize } from '../../lib/fb-recordings'
import type { FbRecording, RecordingLibraryPickerProps } from './types'

const SOURCE_APP_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all',          label: 'すべて' },
  { value: 'course',       label: 'コース' },
  { value: 'sales',        label: 'セールス' },
  { value: 'webinar',      label: 'ウェビナー' },
  { value: 'ai_generated', label: 'AI生成' },
]

export function RecordingLibraryPicker({ isOpen, onClose, onSelect, filterSourceApp }: RecordingLibraryPickerProps) {
  const [recordings, setRecordings] = useState<FbRecording[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>(filterSourceApp ?? 'all')

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    listMyRecordings({ filterSourceApp: filter })
      .then(setRecordings)
      .catch((err) => {
        console.error('Failed to load recordings:', err)
        setRecordings([])
      })
      .finally(() => setLoading(false))
  }, [isOpen, filter])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダ */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-gray-900">ライブラリから動画を選択</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* フィルタ */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
          <label className="text-xs text-gray-500">ソースアプリ:</label>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            {SOURCE_APP_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 一覧 */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">
              まだ録画がありません。録画するか、外部URLで追加してください
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recordings.map(rec => (
                <div
                  key={rec.id}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col shadow-sm hover:border-emerald-300 transition-colors"
                >
                  {/* サムネイル */}
                  <div className="aspect-video w-full bg-gray-200 relative flex-shrink-0">
                    {rec.thumbnail_url ? (
                      <img
                        src={rec.thumbnail_url}
                        alt={rec.title ?? ''}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        サムネイルなし
                      </div>
                    )}
                  </div>

                  {/* メタ情報 */}
                  <div className="p-3 flex flex-col gap-1.5 flex-1">
                    <p className="font-medium text-gray-900 text-sm line-clamp-2 min-h-[2.5rem]">
                      {rec.title || '無題の録画'}
                    </p>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>⏱ {formatDuration(rec.duration_seconds)}</span>
                      <span>📦 {formatFileSize(rec.file_size_bytes)}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(rec.created_at).toLocaleDateString('ja-JP')}
                    </div>
                    <button
                      onClick={() => onSelect(rec)}
                      className="mt-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                    >
                      選択
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
