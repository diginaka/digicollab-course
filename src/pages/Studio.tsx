import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Check, Settings } from 'lucide-react'
import StudioStep1 from './StudioStep1'
import StudioStep2 from './StudioStep2'
import StudioStep3 from './StudioStep3'
import { loadHistory } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { Chapter, HistoryEntry } from '../types'

const stepLabels = ['企画', 'コンテンツ', '公開']

export default function Studio() {
  const navigate = useNavigate()

  // 制作state
  const [step, setStep] = useState(0)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [teleprompterText, setTeleprompterText] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)

  // フォーム初期値（再編集時にpagesから復元）
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [themeColor, setThemeColor] = useState('#059669')
  const [thumbnailUrl, setThumbnailUrl] = useState('')

  // 履歴からロード（pagesからslotsを取得 → state展開）
  const handleLoadHistory = useCallback(async (entry: HistoryEntry) => {
    try {
      const { data, error } = await supabase
        .from('pages')
        .select('id, slots, og_image_url')
        .eq('id', entry.pageId)
        .single()

      if (error || !data) {
        alert('このコースはもう存在しません')
        return
      }

      const slots = data.slots as Record<string, unknown>
      setTitle(String(slots.course_title || ''))
      setDescription(String(slots.course_description || ''))
      setPassword(String(slots.password || ''))
      setThemeColor(String(slots.theme_color || '#059669'))
      setThumbnailUrl(String(data.og_image_url || ''))

      const slotChapters = (slots.chapters as Record<string, unknown>[]) || []
      setChapters(slotChapters.map((ch, i) => ({
        id: String(ch.id || `ch-${i}`),
        title: String(ch.title || ''),
        videoType: (['vimeo', 'gdrive', 'other'].includes(String(ch.video_type)) ? ch.video_type : 'vimeo') as Chapter['videoType'],
        videoUrl: String(ch.video_url || ''),
        textContent: String(ch.text_content || ''),
        attachments: Array.isArray(ch.attachments) ? ch.attachments.map(String) : [],
        duration: String(ch.duration || ''),
        sortOrder: i,
      })))

      setEditingPageId(data.id)
      setStep(1)
      setShowHistory(false)
    } catch (err) {
      alert(`読み込みに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    }
  }, [])

  const handleNewCourse = useCallback(() => {
    setTitle('')
    setDescription('')
    setPassword('')
    setThemeColor('#059669')
    setThumbnailUrl('')
    setChapters([])
    setTeleprompterText('')
    setEditingPageId(null)
    setStep(0)
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm">
            <Settings className="w-4 h-4" /> <span className="hidden sm:inline">設定</span>
          </button>
          <div className="flex items-center gap-2">
            {stepLabels.map((label, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  i === step
                    ? 'bg-emerald-100 text-emerald-700'
                    : i < step
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'text-gray-400'
                }`}
              >
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  i < step ? 'bg-emerald-600 text-white' : i === step ? 'border-2 border-emerald-600 text-emerald-700 bg-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            <Clock className="w-4 h-4" /> <span className="hidden sm:inline">制作履歴</span>
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 overflow-y-auto min-h-0">
        {step === 0 && (
          <StudioStep1
            teleprompterText={teleprompterText}
            setTeleprompterText={setTeleprompterText}
            chapters={chapters}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StudioStep2
            chapters={chapters}
            setChapters={setChapters}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StudioStep3
            chapters={chapters}
            editingPageId={editingPageId}
            initialTitle={title}
            initialDescription={description}
            initialPassword={password}
            initialThemeColor={themeColor}
            initialThumbnailUrl={thumbnailUrl}
            setEditingPageId={setEditingPageId}
            onBack={() => setStep(1)}
            onEditAgain={() => setStep(1)}
            onNewCourse={handleNewCourse}
          />
        )}
      </div>

      {/* 制作履歴モーダル */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">制作履歴</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="overflow-y-auto max-h-[50vh] p-4">
              {loadHistory().length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">制作履歴はありません</p>
              ) : (
                <div className="space-y-2">
                  {loadHistory().map(entry => (
                    <button
                      key={entry.pageId}
                      onClick={() => handleLoadHistory(entry)}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors"
                    >
                      <p className="font-medium text-gray-900 text-sm">{entry.title || '無題のコース'}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(entry.updatedAt).toLocaleDateString('ja-JP')} 更新
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
