import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, FileText, ArrowRight, Loader2, Sparkles, Wand2, RefreshCw, Check } from 'lucide-react'
import { loadSettings } from '../lib/storage'
import { loadProSettings } from '../lib/supabase'
import { sendAIMessage } from '../lib/ai'
import { generateCourseBulk } from '../lib/bulkGenerate'
import type { ChatMessage, GeneratedCourse, BulkGenerateInput } from '../types'

interface Props {
  onNext: () => void
  onBulkApply: (result: GeneratedCourse) => void
  onRegenerateAll: () => void
  userOverridesCount: number
}

type Tab = 'chat' | 'bulk'

const TONE_OPTIONS = [
  { value: 'friendly', label: 'フレンドリー' },
  { value: 'professional', label: 'プロフェッショナル' },
  { value: 'approachable', label: '親しみやすい' },
  { value: 'authoritative', label: '権威的' },
] as const

export default function StudioStep1({ onNext, onBulkApply, onRegenerateAll, userOverridesCount }: Props) {
  const [tab, setTab] = useState<Tab>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // AI一括生成
  const [bulkTheme, setBulkTheme] = useState('')
  const [bulkLessonCount, setBulkLessonCount] = useState(5)
  const [bulkTone, setBulkTone] = useState<BulkGenerateInput['tone']>('friendly')
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkResult, setBulkResult] = useState<GeneratedCourse | null>(null)
  const [bulkError, setBulkError] = useState('')

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // AI送信
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return
    const newMsg: ChatMessage = { role: 'user', content: input.trim() }
    const updated = [...messages, newMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const settings = loadSettings()
      const reply = await sendAIMessage(updated, settings.ai)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `エラー: ${err instanceof Error ? err.message : '不明なエラー'}` }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  // AI一括生成実行
  const handleBulkGenerate = useCallback(async () => {
    if (!bulkTheme.trim() || bulkGenerating) return
    setBulkError('')
    setBulkResult(null)
    setBulkGenerating(true)
    try {
      const settings = loadSettings()
      // pro_settingsからもAI設定をマージ（管理画面未保存でもクラウド値を使う）
      const ps = await loadProSettings()
      const ai = {
        ...settings.ai,
        provider: (ps.ai_provider as typeof settings.ai.provider) || settings.ai.provider,
        apiKey: ps[`${settings.ai.provider}_api_key`] || ps[`${ps.ai_provider}_api_key`] || settings.ai.apiKey,
        model: ps.ai_model || settings.ai.model,
        baseUrl: ps.openai_base_url || settings.ai.baseUrl,
      }
      const result = await generateCourseBulk(
        { theme: bulkTheme, lessonCount: bulkLessonCount, tone: bulkTone },
        ai
      )
      setBulkResult(result)
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setBulkGenerating(false)
    }
  }, [bulkTheme, bulkLessonCount, bulkTone, bulkGenerating])

  // 生成結果を承認 → Studioに反映
  const handleBulkConfirm = useCallback(() => {
    if (!bulkResult) return
    onBulkApply(bulkResult)
    setBulkResult(null)
  }, [bulkResult, onBulkApply])

  // 全部作り直す: user_overridesをクリア + 再実行
  const handleBulkRegenerateAll = useCallback(async () => {
    onRegenerateAll()
    await handleBulkGenerate()
  }, [onRegenerateAll, handleBulkGenerate])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* タブ切替 */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-200 shadow-sm self-start flex-shrink-0">
        <button
          onClick={() => setTab('chat')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'chat' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          AIチャット
        </button>
        <button
          onClick={() => setTab('bulk')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${tab === 'bulk' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Sparkles className="w-4 h-4" /> AI一括生成
        </button>
      </div>

      {/* AIチャット */}
      {tab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">AIアシスタントにコースの企画を相談しましょう</p>
                <p className="text-xs mt-1">例:「プログラミング入門コースの構成を考えて」</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%]">
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-emerald-50 text-emerald-900 rounded-br-md'
                      : 'bg-gray-50 text-gray-800 rounded-bl-md'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 px-4 py-3 rounded-2xl rounded-bl-md">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="mt-3 flex gap-2 flex-shrink-0">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="メッセージを入力..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition" />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* AI一括生成 */}
      {tab === 'bulk' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {!bulkResult ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl mx-auto w-full">
              <div className="flex items-center gap-2 mb-5">
                <Wand2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-gray-900">コース全体を1回のAIコールで一括生成</h3>
              </div>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                コーステーマと対象者を伝えると、AIがコース全体の構成（タイトル/説明/全レッスンの内容）を一気に生成します。
                生成後は内容を確認してから確定してください。
              </p>

              {userOverridesCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
                  手動編集されたフィールド（{userOverridesCount}件）は再生成しても保護されます。
                  <button onClick={onRegenerateAll}
                    className="ml-2 underline font-medium hover:text-amber-900">保護を解除</button>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">コーステーマ / 対象者 <span className="text-red-500">*</span></label>
                  <textarea
                    value={bulkTheme}
                    onChange={e => setBulkTheme(e.target.value)}
                    rows={3}
                    placeholder="例: 副業で月5万円を目指す会社員向けの、Notion活用入門コース"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm resize-none transition"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">レッスン数</label>
                    <input
                      type="number"
                      min={5}
                      max={20}
                      value={bulkLessonCount}
                      onChange={e => setBulkLessonCount(Math.max(5, Math.min(20, Number(e.target.value) || 5)))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition"
                    />
                    <p className="text-xs text-gray-500 mt-1">5〜20レッスン。11以上は自動セクション分け。</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">トーン</label>
                    <select
                      value={bulkTone}
                      onChange={e => setBulkTone(e.target.value as BulkGenerateInput['tone'])}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm bg-white transition"
                    >
                      {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                {bulkError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {bulkError}
                  </div>
                )}

                <button
                  onClick={handleBulkGenerate}
                  disabled={!bulkTheme.trim() || bulkGenerating}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  {bulkGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {bulkGenerating ? 'AIが生成中...' : 'AI一括生成'}
                </button>
              </div>
            </div>
          ) : (
            // プレビュー画面
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl mx-auto w-full">
              <div className="flex items-center gap-2 mb-4">
                <Check className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-gray-900">生成結果のプレビュー</h3>
              </div>
              <p className="text-xs text-gray-500 mb-5">確定すると、Step 2のチャプター構成に反映されます。手動編集済みのフィールドは保護されます。</p>

              <div className="space-y-4 mb-5">
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                  <p className="text-xs text-emerald-700 font-medium mb-1">コースタイトル</p>
                  <p className="text-base font-bold text-gray-900">{bulkResult.courseTitle}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 font-medium mb-1">コース説明</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{bulkResult.courseDescription}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 font-medium mb-1">サムネ用コピー</p>
                    <p className="text-xs text-gray-700">{bulkResult.thumbnailCopy}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 font-medium mb-1">所要時間</p>
                    <p className="text-sm font-medium text-gray-900">{bulkResult.totalDuration}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">全レッスン（{bulkResult.lessons.length}件）</p>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {bulkResult.lessons.map((lesson, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                        {lesson.section && (
                          <p className="text-xs text-emerald-600 font-medium mb-1">{lesson.section}</p>
                        )}
                        <div className="flex gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{lesson.title}</p>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{lesson.description}</p>
                            {lesson.learningGoal && (
                              <p className="text-xs text-emerald-700 mt-1">🎯 {lesson.learningGoal}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleBulkConfirm}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Check className="w-5 h-5" /> この内容で確定
                </button>
                <button
                  onClick={handleBulkRegenerateAll}
                  disabled={bulkGenerating}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> 全部作り直す
                </button>
                <button
                  onClick={() => setBulkResult(null)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  入力に戻る
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 次へ */}
      <div className="mt-4 flex justify-end flex-shrink-0">
        <button onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm">
          次へ: コンテンツ <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
