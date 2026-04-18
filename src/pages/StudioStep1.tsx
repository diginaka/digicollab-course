import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, FileText, Play, Pause, RotateCcw, ChevronUp, ChevronDown, ArrowRight, Loader2, ChevronLeft, ChevronRight, CheckSquare, Square, Smartphone, Monitor } from 'lucide-react'
import { loadSettings } from '../lib/storage'
import { loadProSettings } from '../lib/supabase'
import { sendAIMessage } from '../lib/ai'
import type { ChatMessage, Chapter } from '../types'

interface Props {
  teleprompterText: string
  setTeleprompterText: (t: string) => void
  chapters: Chapter[]
  onNext: () => void
}

export default function StudioStep1({ teleprompterText, setTeleprompterText, chapters, onNext }: Props) {
  const [tab, setTab] = useState<'chat' | 'teleprompter'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // テレプロンプター
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const scrollPosRef = useRef(0)

  // チャプターナビゲーション
  const [chapterIndex, setChapterIndex] = useState(0)
  const [completedChapters, setCompletedChapters] = useState<Set<number>>(new Set())

  // FacePop録画ウィジェット
  const [widgetId, setWidgetId] = useState('')

  // 録画ウィジェットIDを読み込み
  useEffect(() => {
    loadProSettings().then(ps => {
      if (ps.record_widget_id) setWidgetId(ps.record_widget_id)
    })
    const settings = loadSettings()
    if (settings.record.widgetId) setWidgetId(settings.record.widgetId)
  }, [])

  // FacePop SDKロード（ウィジェットID設定済みの場合のみ）
  useEffect(() => {
    if (!widgetId || tab !== 'teleprompter') return
    // FacePop SDKを動的ロード
    const existingScript = document.querySelector('script[src*="facepop"]')
    if (existingScript) return

    const script = document.createElement('script')
    script.src = 'https://cdn.facepop.io/facepop.js'
    script.async = true
    script.onload = () => {
      // FacePop初期化
      const w = window as unknown as Record<string, unknown>
      if (typeof w.FacePop === 'function') {
        w.FacePop = new (w.FacePop as new (opts: Record<string, unknown>) => unknown)({
          widget_id: widgetId,
        })
      }
    }
    document.body.appendChild(script)

    return () => {
      // クリーンアップ時にFacePopを削除
      const fpElements = document.querySelectorAll('[id^="facepop"]')
      fpElements.forEach(el => el.remove())
    }
  }, [widgetId, tab])

  // チャプターテキスト自動ロード
  useEffect(() => {
    if (chapters.length > 0 && chapterIndex < chapters.length) {
      const ch = chapters[chapterIndex]
      if (ch.textContent) {
        setTeleprompterText(ch.textContent)
      }
    }
  }, [chapterIndex, chapters, setTeleprompterText])

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

  // AI回答をテレプロンプターに反映
  const applyToScript = useCallback((content: string, applyMode: 'overwrite' | 'append') => {
    if (applyMode === 'overwrite') {
      setTeleprompterText(content)
    } else {
      setTeleprompterText(teleprompterText ? teleprompterText + '\n\n' + content : content)
    }
    setTab('teleprompter')
  }, [setTeleprompterText, teleprompterText])

  // テレプロンプタースクロール制御
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) {
      cancelAnimationFrame(animRef.current)
      return
    }
    const el = scrollRef.current
    const pixelsPerFrame = (speed * 0.8)

    const tick = () => {
      scrollPosRef.current += pixelsPerFrame
      el.scrollTop = scrollPosRef.current
      if (scrollPosRef.current >= el.scrollHeight - el.clientHeight) {
        setIsPlaying(false)
        return
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [isPlaying, speed])

  const resetScroll = () => {
    scrollPosRef.current = 0
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setIsPlaying(false)
  }

  const nudge = (dir: 'up' | 'down') => {
    if (!scrollRef.current) return
    const delta = dir === 'up' ? -60 : 60
    scrollPosRef.current = Math.max(0, scrollPosRef.current + delta)
    scrollRef.current.scrollTop = scrollPosRef.current
  }

  const toggleChapterComplete = () => {
    setCompletedChapters(prev => {
      const next = new Set(prev)
      if (next.has(chapterIndex)) next.delete(chapterIndex)
      else next.add(chapterIndex)
      return next
    })
  }

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
          onClick={() => setTab('teleprompter')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'teleprompter' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          テレプロンプター
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
                  {msg.role === 'assistant' && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => applyToScript(msg.content, 'overwrite')}
                        className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors shadow-sm">
                        台本に上書き
                      </button>
                      <button onClick={() => applyToScript(msg.content, 'append')}
                        className="text-xs px-3 py-1.5 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors shadow-sm">
                        ▼ 末尾に追加
                      </button>
                    </div>
                  )}
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

      {/* テレプロンプター */}
      {tab === 'teleprompter' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* チャプターナビ（チャプターがある場合） */}
          {chapters.length > 0 && (
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5 mb-3 flex-shrink-0">
              <button onClick={() => setChapterIndex(Math.max(0, chapterIndex - 1))} disabled={chapterIndex === 0}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  チャプター {chapterIndex + 1}/{chapters.length}
                  {chapters[chapterIndex]?.title && <span className="text-gray-500 ml-1.5">— {chapters[chapterIndex].title}</span>}
                </p>
                <p className="text-xs text-emerald-600">完了: {completedChapters.size}/{chapters.length}</p>
              </div>
              <button onClick={() => setChapterIndex(Math.min(chapters.length - 1, chapterIndex + 1))} disabled={chapterIndex >= chapters.length - 1}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {!isPlaying ? (
            <textarea value={teleprompterText} onChange={e => setTeleprompterText(e.target.value)}
              placeholder="台本をここに入力、またはAIチャットから転送..."
              className="flex-1 min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm p-4 text-sm leading-relaxed resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
          ) : (
            <div ref={scrollRef} className="flex-1 min-h-0 bg-gray-900 rounded-xl p-8 overflow-y-auto shadow-sm">
              <div className="text-white text-2xl sm:text-3xl leading-relaxed whitespace-pre-wrap font-medium text-center max-w-2xl mx-auto">
                {teleprompterText || '台本が空です'}
              </div>
            </div>
          )}

          {/* コントロール */}
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap flex-shrink-0">
            {chapters.length > 0 && (
              <button onClick={() => setChapterIndex(Math.max(0, chapterIndex - 1))} disabled={chapterIndex === 0}
                className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4 inline -mt-0.5" /> 前の台本
              </button>
            )}
            <button onClick={() => setTab('chat')} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
              編集
            </button>
            <button onClick={() => nudge('up')} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
              <ChevronUp className="w-5 h-5" />
            </button>
            <button onClick={() => setSpeed(s => s === 3 ? 1 : s + 1)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 font-mono min-w-[48px] transition-colors">
              x{speed}
            </button>
            <button onClick={() => nudge('down')} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
              <ChevronDown className="w-5 h-5" />
            </button>
            <button onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 rounded-lg text-white transition-colors shadow-sm ${isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={resetScroll} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
              <RotateCcw className="w-5 h-5" />
            </button>
            {chapters.length > 0 && (
              <>
                <button onClick={toggleChapterComplete}
                  className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                  {completedChapters.has(chapterIndex) ? <CheckSquare className="w-4 h-4 inline -mt-0.5 text-emerald-600" /> : <Square className="w-4 h-4 inline -mt-0.5" />} 撮影完了
                </button>
                <button onClick={() => setChapterIndex(Math.min(chapters.length - 1, chapterIndex + 1))} disabled={chapterIndex >= chapters.length - 1}
                  className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-30 transition-colors">
                  次の台本 <ChevronRight className="w-4 h-4 inline -mt-0.5" />
                </button>
              </>
            )}
          </div>

          {/* 録画ガイドセクション */}
          <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex-shrink-0">
            {widgetId ? (
              <p className="text-sm text-gray-600 text-center">
                右下のウィジェットから「スマホで撮影」または「PCで録画」を選択してください。
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3 text-center">テレプロンプターを見ながら録画してください。</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                    <Smartphone className="w-4 h-4" /> 画面を見ながら スマホで撮影
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                    <Monitor className="w-4 h-4" /> 画面を並べて PCで撮影
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  録画した動画をGoogle Drive等にアップロードし、次のステップで動画URLを貼り付けてください。
                </p>
              </>
            )}
          </div>
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
