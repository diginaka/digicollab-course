import { useState, useCallback, useEffect } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Pencil, Trash2, ArrowLeft, ArrowRight, Video, FileText, Paperclip, X, Scissors } from 'lucide-react'
import { generateId } from '../lib/utils'
import { getRecordingById } from '../lib/fb-recordings'
import {
  VideoSourceSelector,
  RecordingLibraryPicker,
  type VideoSource,
  type FbRecording,
} from '../components/video-source'
import type { Chapter } from '../types'

interface Props {
  chapters: Chapter[]
  setChapters: (c: Chapter[]) => void
  onNext: () => void
  onBack: () => void
}

const PENDING_CHAPTER_KEY = 'digicollab_pending_chapter'
const PENDING_TTL_MS = 30 * 60 * 1000 // 30分
const RECORDER_ORIGIN = 'https://record.digicollabo.com'

interface PendingChapter {
  chapterId: string | null
  title: string
  textContent: string
  attachments: string[]
  timestamp: number
}

// ソート可能チャプターカード
function SortableChapter({
  chapter, index, onEdit, onDelete, onPickLibrary, onRecord,
}: {
  chapter: Chapter
  index: number
  onEdit: () => void
  onDelete: () => void
  onPickLibrary: () => void
  onRecord: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3 shadow-sm">
      <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 touch-none">
        <GripVertical className="w-5 h-5" />
      </button>
      <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{chapter.title || '無題のチャプター'}</p>
        <div className="flex gap-3 mt-1 text-xs text-gray-500">
          {chapter.videoUrl && <span className="flex items-center gap-1"><Video className="w-3 h-3" /> 動画あり</span>}
          {chapter.textContent && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> 本文あり</span>}
          {chapter.attachments?.length > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> 添付{chapter.attachments.length}件</span>}
        </div>
      </div>
      <button
        onClick={onRecord}
        title="レコーダーを開く"
        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-base leading-none"
      >
        🎥
      </button>
      <button
        disabled
        title="動画編集（近日公開）"
        className="p-2 text-gray-300 cursor-not-allowed rounded-lg"
      >
        <Scissors className="w-4 h-4" />
      </button>
      <button
        onClick={onPickLibrary}
        title="ライブラリから差し替え"
        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-base leading-none"
      >
        📚
      </button>
      <button onClick={onEdit} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="編集">
        <Pencil className="w-4 h-4" />
      </button>
      <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// チャプター編集モーダル
interface ChapterModalProps {
  isOpen: boolean
  initialChapter: Chapter | null
  sortOrder: number
  onClose: () => void
  onSave: (chapter: Chapter) => void
}

function ChapterModal({ isOpen, initialChapter, sortOrder, onClose, onSave }: ChapterModalProps) {
  const [title, setTitle] = useState('')
  const [videoSource, setVideoSource] = useState<VideoSource | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoType, setVideoType] = useState<Chapter['videoType']>('vimeo')
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [libraryRecording, setLibraryRecording] = useState<FbRecording | null>(null)
  const [textContent, setTextContent] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  // モーダル開封 / initialChapter 変化時に state リセット
  useEffect(() => {
    if (!isOpen) return
    setTitle(initialChapter?.title ?? '')
    setVideoSource(initialChapter?.videoSource ?? null)
    setVideoUrl(initialChapter?.videoUrl ?? '')
    // external_url 以外の videoType は UI プルダウンで使わないので vimeo を既定表示に
    const initType = initialChapter?.videoType
    setVideoType(initType && initType !== 'bunny' ? initType : 'vimeo')
    setRecordingId(initialChapter?.recordingId ?? null)
    setTextContent(initialChapter?.textContent ?? '')
    setAttachments(initialChapter?.attachments ?? [])
    setLibraryRecording(null)
    if (initialChapter?.recordingId) {
      getRecordingById(initialChapter.recordingId)
        .then(setLibraryRecording)
        .catch((err) => console.error('Failed to load recording:', err))
    }
  }, [isOpen, initialChapter])

  const handleOpenRecorder = useCallback(() => {
    if (!title.trim()) {
      alert('先にチャプタータイトルを入力してください')
      return
    }
    const pending: PendingChapter = {
      chapterId: initialChapter?.id ?? null,
      title,
      textContent,
      attachments,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(PENDING_CHAPTER_KEY, JSON.stringify(pending))
    const sourceRef = initialChapter?.id ?? `new-${Date.now()}`
    const params = new URLSearchParams({
      app_id: 'course',
      source_ref: sourceRef,
      return_to: window.location.href,
    })
    window.location.href = `${RECORDER_ORIGIN}?${params.toString()}`
  }, [title, textContent, attachments, initialChapter])

  const handleLibrarySelect = useCallback((rec: FbRecording) => {
    if (!rec.public_url) {
      alert('この動画はまだ処理が完了していません')
      return
    }
    setRecordingId(rec.id)
    setVideoUrl(rec.public_url)
    setLibraryRecording(rec)
    setVideoType('bunny')
    setPickerOpen(false)
  }, [])

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      alert('タイトルを入力してください')
      return
    }
    if (!videoSource) {
      alert('動画ソースを選択してください')
      return
    }

    // video_type は ChapterSlot / ビューアー互換のマーカー:
    //  - recording/library/ai_generated/upload: 'bunny'
    //  - external_url: プルダウン値（youtube/vimeo/gdrive/other）
    const finalVideoType: Chapter['videoType'] =
      videoSource === 'external_url' ? videoType : 'bunny'

    const chapter: Chapter = {
      id: initialChapter?.id ?? generateId(),
      title: title.trim(),
      videoType: finalVideoType,
      videoUrl,
      textContent,
      attachments,
      duration: initialChapter?.duration ?? '',
      sortOrder: initialChapter?.sortOrder ?? sortOrder,
      videoSource,
      recordingId,
    }
    onSave(chapter)
  }, [title, videoSource, videoType, videoUrl, textContent, attachments, recordingId, initialChapter, sortOrder, onSave])

  const updateAttachment = (idx: number, value: string) => {
    const next = [...attachments]
    next[idx] = value
    setAttachments(next)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダ */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-gray-900">
            {initialChapter ? 'チャプターを編集' : '新しいチャプター'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="閉じる">
            ×
          </button>
        </div>

        {/* 本体 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              チャプタータイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例: はじめに"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              動画ソース <span className="text-red-500">*</span>
            </label>
            <VideoSourceSelector
              value={videoSource}
              onChange={setVideoSource}
              aiGenerationEnabled={false}
            />
          </div>

          {/* 条件レンダリング */}
          {videoSource === 'recording' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">🎥 録画する を選択中</p>
              <button
                onClick={handleOpenRecorder}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                🎥 レコーダーを開く
              </button>
              <p className="text-xs text-blue-800 mt-2">
                録画完了後、自動でこのチャプターに紐付きます（タイトルと本文は保持されます）
              </p>
              {recordingId && libraryRecording && (
                <div className="mt-3 flex gap-3 items-center bg-white/60 rounded-lg p-2 border border-blue-200">
                  {libraryRecording.thumbnail_url ? (
                    <img src={libraryRecording.thumbnail_url} alt="" className="w-16 h-10 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-10 bg-gray-200 rounded" />
                  )}
                  <p className="text-xs text-gray-700 flex-1 truncate">
                    現在紐付け: {libraryRecording.title || '無題'}
                  </p>
                </div>
              )}
            </div>
          )}

          {videoSource === 'library' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm font-medium text-emerald-900 mb-2">📚 ライブラリから選択中</p>
              {libraryRecording ? (
                <div className="flex gap-3 items-center">
                  {libraryRecording.thumbnail_url ? (
                    <img src={libraryRecording.thumbnail_url} alt="" className="w-20 h-12 object-cover rounded border border-gray-200" />
                  ) : (
                    <div className="w-20 h-12 bg-gray-200 rounded border border-gray-200" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {libraryRecording.title || '無題'}
                    </p>
                    <button
                      onClick={() => setPickerOpen(true)}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-medium underline"
                    >
                      変更
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  動画を選ぶ
                </button>
              )}
            </div>
          )}

          {videoSource === 'external_url' && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">動画タイプ</label>
                <select
                  value={videoType}
                  onChange={e => setVideoType(e.target.value as Chapter['videoType'])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm bg-white"
                >
                  <option value="youtube">YouTube</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="gdrive">Google Drive</option>
                  <option value="other">その他URL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">動画URL</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                />
              </div>
            </div>
          )}

          {videoSource === 'upload' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 leading-relaxed">
              ⬆ アップロード機能は近日公開予定です。<br />
              現状はライブラリまたは外部URLをご利用ください。
            </div>
          )}

          {videoSource === 'ai_generated' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
              ✨ AI動画生成は近日公開予定です。
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">本文（任意）</label>
            <textarea
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              rows={6}
              placeholder="チャプターの説明やテキスト教材..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">添付ファイルURL（任意・複数可）</label>
              <button
                onClick={() => setAttachments([...attachments, ''])}
                type="button"
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                + 追加
              </button>
            </div>
            {attachments.length === 0 && (
              <p className="text-xs text-gray-400 italic">添付ファイルなし</p>
            )}
            {attachments.map((url, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={url}
                  onChange={e => updateAttachment(idx, e.target.value)}
                  placeholder="PDFやZIPなどのダウンロードURL"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                />
                <button
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                  type="button"
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!title.trim() || !videoSource}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            保存
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
        </div>

        {/* ライブラリピッカー（入れ子） */}
        <RecordingLibraryPicker
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleLibrarySelect}
        />
      </div>
    </div>
  )
}

export default function StudioStep2({ chapters, setChapters, onNext, onBack }: Props) {
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null)
  const [editIndex, setEditIndex] = useState(-1)
  const [pickerOpenForIndex, setPickerOpenForIndex] = useState<number | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // レコーダー戻り時の自動紐付け
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const recordedVideoId = params.get('recorded_video_id')
    if (!recordedVideoId) return

    const pendingRaw = sessionStorage.getItem(PENDING_CHAPTER_KEY)
    if (!pendingRaw) {
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    try {
      const pending = JSON.parse(pendingRaw) as PendingChapter
      if (Date.now() - pending.timestamp > PENDING_TTL_MS) {
        sessionStorage.removeItem(PENDING_CHAPTER_KEY)
        window.history.replaceState({}, '', window.location.pathname)
        return
      }

      getRecordingById(recordedVideoId)
        .then((rec) => {
          if (!rec || !rec.public_url) return

          const existingIdx = pending.chapterId
            ? chapters.findIndex(c => c.id === pending.chapterId)
            : -1

          const chapter: Chapter = {
            id: pending.chapterId ?? generateId(),
            title: pending.title,
            videoType: 'bunny',
            videoUrl: rec.public_url,
            textContent: pending.textContent,
            attachments: pending.attachments,
            duration: '',
            sortOrder: existingIdx >= 0 ? existingIdx : chapters.length,
            videoSource: 'recording',
            recordingId: rec.id,
          }

          if (existingIdx >= 0) {
            const next = [...chapters]
            next[existingIdx] = chapter
            setChapters(next)
            setEditingChapter(chapter)
            setEditIndex(existingIdx)
          } else {
            setChapters([...chapters, chapter])
            setEditingChapter(chapter)
            setEditIndex(chapters.length)
          }
        })
        .catch((err) => console.error('Failed to attach recording:', err))
        .finally(() => {
          sessionStorage.removeItem(PENDING_CHAPTER_KEY)
          window.history.replaceState({}, '', window.location.pathname)
        })
    } catch (err) {
      console.error('Invalid pending chapter:', err)
      sessionStorage.removeItem(PENDING_CHAPTER_KEY)
      window.history.replaceState({}, '', window.location.pathname)
    }
    // chapters を依存に入れると同じ記録で複数回発火するため、初回マウント限定でOK
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = chapters.findIndex(c => c.id === active.id)
    const newIndex = chapters.findIndex(c => c.id === over.id)
    const reordered = arrayMove(chapters, oldIndex, newIndex).map((c, i) => ({ ...c, sortOrder: i }))
    setChapters(reordered)
  }, [chapters, setChapters])

  const openNewChapter = useCallback(() => {
    setEditingChapter(null)
    setEditIndex(-1)
    // null を渡すと ChapterModal が新規モードで開くが、useState の再オープン判定のため一度 state を揺らす
    setTimeout(() => setEditingChapter({
      id: generateId(),
      title: '',
      videoType: 'vimeo',
      videoUrl: '',
      textContent: '',
      attachments: [],
      duration: '',
      sortOrder: chapters.length,
      videoSource: null,
      recordingId: null,
    }), 0)
  }, [chapters.length])

  const openEditChapter = useCallback((index: number) => {
    setEditingChapter({ ...chapters[index] })
    setEditIndex(index)
  }, [chapters])

  const closeModal = useCallback(() => {
    setEditingChapter(null)
    setEditIndex(-1)
  }, [])

  const saveChapter = useCallback((chapter: Chapter) => {
    if (editIndex >= 0) {
      const updated = [...chapters]
      updated[editIndex] = chapter
      setChapters(updated)
    } else {
      setChapters([...chapters, chapter])
    }
    closeModal()
  }, [editIndex, chapters, setChapters, closeModal])

  const deleteChapter = useCallback((index: number) => {
    if (!confirm('このチャプターを削除しますか？')) return
    setChapters(chapters.filter((_, i) => i !== index).map((c, i) => ({ ...c, sortOrder: i })))
  }, [chapters, setChapters])

  const startRecordFromRow = useCallback((index: number) => {
    const ch = chapters[index]
    if (!ch.title.trim()) {
      alert('先にチャプター編集からタイトルを入力してください')
      return
    }
    const pending: PendingChapter = {
      chapterId: ch.id,
      title: ch.title,
      textContent: ch.textContent,
      attachments: ch.attachments,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(PENDING_CHAPTER_KEY, JSON.stringify(pending))
    const params = new URLSearchParams({
      app_id: 'course',
      source_ref: ch.id,
      return_to: window.location.href,
    })
    window.location.href = `${RECORDER_ORIGIN}?${params.toString()}`
  }, [chapters])

  const handleRowLibrarySelect = useCallback((rec: FbRecording) => {
    if (pickerOpenForIndex === null) return
    if (!rec.public_url) {
      alert('この動画はまだ処理が完了していません')
      return
    }
    const next = [...chapters]
    next[pickerOpenForIndex] = {
      ...next[pickerOpenForIndex],
      videoSource: 'library',
      videoUrl: rec.public_url,
      videoType: 'bunny',
      recordingId: rec.id,
    }
    setChapters(next)
    setPickerOpenForIndex(null)
  }, [chapters, pickerOpenForIndex, setChapters])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">チャプター構成</h2>
        <button
          onClick={openNewChapter}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> チャプター追加
        </button>
      </div>

      {chapters.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm mb-4">チャプターがまだありません</p>
          <button
            onClick={openNewChapter}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> 最初のチャプターを追加
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={chapters.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {chapters.map((chapter, index) => (
                <SortableChapter
                  key={chapter.id}
                  chapter={chapter}
                  index={index}
                  onEdit={() => openEditChapter(index)}
                  onDelete={() => deleteChapter(index)}
                  onPickLibrary={() => setPickerOpenForIndex(index)}
                  onRecord={() => startRecordFromRow(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 戻る
        </button>
        <button
          onClick={onNext}
          disabled={chapters.length === 0}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
        >
          次へ: 公開 <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <ChapterModal
        isOpen={!!editingChapter}
        initialChapter={editIndex >= 0 ? editingChapter : null}
        sortOrder={chapters.length}
        onClose={closeModal}
        onSave={saveChapter}
      />

      {/* 各行から呼ぶライブラリピッカー（差し替え用） */}
      <RecordingLibraryPicker
        isOpen={pickerOpenForIndex !== null}
        onClose={() => setPickerOpenForIndex(null)}
        onSelect={handleRowLibrarySelect}
      />
    </div>
  )
}
