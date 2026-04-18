import { useState, useCallback } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Pencil, Trash2, ArrowLeft, ArrowRight, Video, FileText, Paperclip, X } from 'lucide-react'
import { generateId } from '../lib/utils'
import type { Chapter } from '../types'

interface Props {
  chapters: Chapter[]
  setChapters: (c: Chapter[]) => void
  onNext: () => void
  onBack: () => void
}

// ソート可能チャプターカード
function SortableChapter({ chapter, index, onEdit, onDelete }: {
  chapter: Chapter; index: number; onEdit: () => void; onDelete: () => void
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
      <button onClick={onEdit} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
        <Pencil className="w-4 h-4" />
      </button>
      <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function StudioStep2({ chapters, setChapters, onNext, onBack }: Props) {
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null)
  const [editIndex, setEditIndex] = useState(-1)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = chapters.findIndex(c => c.id === active.id)
    const newIndex = chapters.findIndex(c => c.id === over.id)
    const reordered = arrayMove(chapters, oldIndex, newIndex).map((c, i) => ({ ...c, sortOrder: i }))
    setChapters(reordered)
  }, [chapters, setChapters])

  const addChapter = useCallback(() => {
    const newChapter: Chapter = {
      id: generateId(),
      title: '',
      videoType: 'vimeo',
      videoUrl: '',
      textContent: '',
      attachments: [],
      duration: '',
      sortOrder: chapters.length,
    }
    setEditingChapter(newChapter)
    setEditIndex(-1)
  }, [chapters.length])

  const saveChapter = useCallback(() => {
    if (!editingChapter) return
    if (editIndex >= 0) {
      const updated = [...chapters]
      updated[editIndex] = editingChapter
      setChapters(updated)
    } else {
      setChapters([...chapters, editingChapter])
    }
    setEditingChapter(null)
  }, [editingChapter, editIndex, chapters, setChapters])

  const deleteChapter = useCallback((index: number) => {
    setChapters(chapters.filter((_, i) => i !== index).map((c, i) => ({ ...c, sortOrder: i })))
  }, [chapters, setChapters])

  const updateAttachment = (idx: number, value: string) => {
    if (!editingChapter) return
    const next = [...editingChapter.attachments]
    next[idx] = value
    setEditingChapter({ ...editingChapter, attachments: next })
  }

  const addAttachment = () => {
    if (!editingChapter) return
    setEditingChapter({ ...editingChapter, attachments: [...editingChapter.attachments, ''] })
  }

  const removeAttachment = (idx: number) => {
    if (!editingChapter) return
    setEditingChapter({ ...editingChapter, attachments: editingChapter.attachments.filter((_, i) => i !== idx) })
  }

  // 編集フォーム
  if (editingChapter) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            {editIndex >= 0 ? 'チャプター編集' : '新しいチャプター'}
          </h2>
          <button onClick={() => setEditingChapter(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">チャプタータイトル <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={editingChapter.title}
              onChange={e => setEditingChapter({ ...editingChapter, title: e.target.value })}
              placeholder="例: はじめに"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">動画タイプ</label>
              <select
                value={editingChapter.videoType}
                onChange={e => setEditingChapter({ ...editingChapter, videoType: e.target.value as Chapter['videoType'] })}
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
                value={editingChapter.videoUrl}
                onChange={e => setEditingChapter({ ...editingChapter, videoUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">本文（任意）</label>
            <textarea
              value={editingChapter.textContent}
              onChange={e => setEditingChapter({ ...editingChapter, textContent: e.target.value })}
              rows={6}
              placeholder="チャプターの説明やテキスト教材..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm resize-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">添付ファイルURL（任意・複数可）</label>
              <button onClick={addAttachment} type="button" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                + 追加
              </button>
            </div>
            {editingChapter.attachments.length === 0 && (
              <p className="text-xs text-gray-400 italic">添付ファイルなし</p>
            )}
            {editingChapter.attachments.map((url, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={url}
                  onChange={e => updateAttachment(idx, e.target.value)}
                  placeholder="PDFやZIPなどのダウンロードURL"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                />
                <button onClick={() => removeAttachment(idx)} type="button" className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={saveChapter}
              disabled={!editingChapter.title.trim()}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
            >
              保存
            </button>
            <button
              onClick={() => setEditingChapter(null)}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">チャプター構成</h2>
        <button
          onClick={addChapter}
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
            onClick={addChapter}
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
                  onEdit={() => { setEditingChapter({ ...chapter }); setEditIndex(index) }}
                  onDelete={() => deleteChapter(index)}
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
    </div>
  )
}
