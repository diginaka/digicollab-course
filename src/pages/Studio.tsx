import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Check, Settings } from 'lucide-react'
import StudioStep1 from './StudioStep1'
import StudioStep2 from './StudioStep2'
import StudioStep3 from './StudioStep3'
import { loadHistory } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { generateId } from '../lib/utils'
import { mergeDescriptionAndGoal } from '../lib/bulkGenerate'
import { mapDbToChapter } from '../lib/chapter-mapper'
import type { Chapter, HistoryEntry, GeneratedCourse, UserOverrides } from '../types'

const stepLabels = ['企画', 'コンテンツ', '公開']

export default function Studio() {
  const navigate = useNavigate()

  // 制作state
  const [step, setStep] = useState(0)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [teleprompterText, setTeleprompterText] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)

  // フォーム初期値（再編集時にpagesから復元、AI一括生成でも上書き）
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [themeColor, setThemeColor] = useState('#059669')
  const [thumbnailUrl, setThumbnailUrl] = useState('')

  // AI一括生成メタデータ
  const [thumbnailCopy, setThumbnailCopy] = useState('')
  const [totalDuration, setTotalDuration] = useState('')
  const [completionMessage, setCompletionMessage] = useState('')
  const [completionCtaLabel, setCompletionCtaLabel] = useState('')

  // 手動編集保護の追跡（キー: "title" | "description" | "chapters.{i}.title" | "chapters.{i}.text_content"）
  const [userOverrides, setUserOverrides] = useState<UserOverrides>({})

  // AI一括生成結果を反映（user_overridesで保護されたフィールドは上書きしない）
  const handleBulkApply = useCallback((result: GeneratedCourse) => {
    if (!userOverrides['title']) setTitle(result.courseTitle)
    if (!userOverrides['description']) setDescription(result.courseDescription)
    setThumbnailCopy(result.thumbnailCopy)
    setTotalDuration(result.totalDuration)
    setCompletionMessage(result.completionMessage)
    setCompletionCtaLabel(result.completionCtaLabel)

    // chaptersに反映（既存チャプターと同じIDの場合はuser_overridesを確認）
    const newChapters: Chapter[] = result.lessons.map((lesson, i) => {
      const existing = chapters[i]
      const keepTitle = existing && userOverrides[`chapters.${i}.title`]
      const keepContent = existing && userOverrides[`chapters.${i}.text_content`]
      return {
        id: existing?.id || generateId(),
        title: keepTitle ? existing.title : lesson.title,
        videoType: existing?.videoType || 'vimeo',
        videoUrl: existing?.videoUrl || '',
        textContent: keepContent ? existing.textContent : mergeDescriptionAndGoal(lesson),
        attachments: existing?.attachments || [],
        duration: existing?.duration || '',
        sortOrder: i,
        videoSource: existing?.videoSource ?? null,
        recordingId: existing?.recordingId ?? null,
      }
    })
    setChapters(newChapters)
    setStep(1)
  }, [userOverrides, chapters])

  // 全部作り直す: user_overridesをクリア → 再生成をトリガー可能な状態に
  const handleRegenerateAll = useCallback(() => {
    setUserOverrides({})
  }, [])

  // setter wrappers: 手動変更を検知してuser_overridesに記録
  const handleTitleChange = useCallback((v: string) => {
    setTitle(v)
    setUserOverrides(prev => ({ ...prev, title: true }))
  }, [])
  const handleDescriptionChange = useCallback((v: string) => {
    setDescription(v)
    setUserOverrides(prev => ({ ...prev, description: true }))
  }, [])
  const handleChaptersChange = useCallback((newChapters: Chapter[]) => {
    // 既存チャプターとの差分を検出してuser_overridesに記録
    setChapters(prevChapters => {
      const overrides: UserOverrides = { ...userOverrides }
      newChapters.forEach((ch, i) => {
        const prev = prevChapters[i]
        if (prev) {
          if (prev.title !== ch.title) overrides[`chapters.${i}.title`] = true
          if (prev.textContent !== ch.textContent) overrides[`chapters.${i}.text_content`] = true
        }
      })
      setUserOverrides(overrides)
      return newChapters
    })
  }, [userOverrides])

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
      setChapters(slotChapters.map((ch, i) => mapDbToChapter(ch, i)))

      // メタデータ復元
      setThumbnailCopy(String(slots.thumbnail_copy || ''))
      setTotalDuration(String(slots.total_duration || ''))
      setCompletionMessage(String(slots.completion_message || ''))
      setCompletionCtaLabel(String(slots.completion_cta_label || ''))

      // 再編集時はすべての既存値を「手動編集済み」扱いに
      const restoredOverrides: UserOverrides = { title: true, description: true }
      slotChapters.forEach((_, i) => {
        restoredOverrides[`chapters.${i}.title`] = true
        restoredOverrides[`chapters.${i}.text_content`] = true
      })
      setUserOverrides(restoredOverrides)

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
    setThumbnailCopy('')
    setTotalDuration('')
    setCompletionMessage('')
    setCompletionCtaLabel('')
    setChapters([])
    setTeleprompterText('')
    setUserOverrides({})
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
            onBulkApply={handleBulkApply}
            onRegenerateAll={handleRegenerateAll}
            userOverridesCount={Object.keys(userOverrides).length}
          />
        )}
        {step === 1 && (
          <StudioStep2
            chapters={chapters}
            setChapters={handleChaptersChange}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StudioStep3
            chapters={chapters}
            editingPageId={editingPageId}
            title={title}
            description={description}
            password={password}
            themeColor={themeColor}
            thumbnailUrl={thumbnailUrl}
            thumbnailCopy={thumbnailCopy}
            totalDuration={totalDuration}
            completionMessage={completionMessage}
            completionCtaLabel={completionCtaLabel}
            onTitleChange={handleTitleChange}
            onDescriptionChange={handleDescriptionChange}
            onPasswordChange={setPassword}
            onThemeColorChange={setThemeColor}
            onThumbnailUrlChange={setThumbnailUrl}
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
