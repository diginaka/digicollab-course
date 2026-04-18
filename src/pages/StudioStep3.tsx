import { useState, useCallback } from 'react'
import { ArrowLeft, Rocket, Copy, ExternalLink, Check, Video, Lock, Loader2, Image, Pencil, FilePlus } from 'lucide-react'
import { copyToClipboard } from '../lib/utils'
import { addHistory, loadSettings } from '../lib/storage'
import { supabase, getOrCreateSubdomain, loadProSettings } from '../lib/supabase'
import { generateSlug } from '../lib/slug'
import type { Chapter } from '../types'

interface Props {
  chapters: Chapter[]
  editingPageId: string | null
  initialTitle: string
  initialDescription: string
  initialPassword: string
  initialThemeColor: string
  initialThumbnailUrl: string
  setEditingPageId: (id: string | null) => void
  onBack: () => void
  onEditAgain: () => void
  onNewCourse: () => void
}

// Straico APIでサムネイル自動生成（オプション）
async function generateThumbnail(title: string, themeColor: string, straicoApiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.straico.com/v1/image/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${straicoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/dall-e-3',
        description: `オンラインコースのサムネイル画像。コース名「${title}」。プロフェッショナルでモダンなデザイン、テーマカラーは${themeColor}。テキストは含めない、シンプルなアイコニックデザイン。`,
        size: '1024x1024',
        quantity: 1,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.images?.[0] || null
  } catch {
    return null
  }
}

export default function StudioStep3({
  chapters, editingPageId,
  initialTitle, initialDescription, initialPassword, initialThemeColor, initialThumbnailUrl,
  setEditingPageId, onBack, onEditAgain, onNewCourse,
}: Props) {
  // フォーム
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [password, setPassword] = useState(initialPassword)
  const [themeColor, setThemeColor] = useState(initialThemeColor || '#059669')
  const [thumbnailUrl, setThumbnailUrl] = useState(initialThumbnailUrl)

  // 状態
  const [publishing, setPublishing] = useState(false)
  const [publishingStatus, setPublishingStatus] = useState('')
  const [published, setPublished] = useState(false)
  const [viewerUrl, setViewerUrl] = useState('')
  const [copied, setCopied] = useState('')

  const isEditing = !!editingPageId
  const videoCount = chapters.filter(c => c.videoUrl).length

  const handleCopy = useCallback(async (text: string, key: string) => {
    await copyToClipboard(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }, [])

  // 公開/更新処理
  const handlePublish = useCallback(async () => {
    if (!title.trim() || !description.trim()) return

    setPublishing(true)
    setPublishingStatus(isEditing ? 'コースを更新中...' : 'コースを公開中...')

    try {
      // 0. サムネイル自動生成（URL空 + Straicoキー設定ありのとき）
      let finalThumbnailUrl = thumbnailUrl
      if (!finalThumbnailUrl) {
        const settings = loadSettings()
        let straicoKey = settings.imageGen.straicoApiKey
        if (!straicoKey) {
          const ps = await loadProSettings()
          straicoKey = ps.straico_api_key || ''
        }
        if (straicoKey) {
          setPublishingStatus('サムネイルを自動生成中...')
          const generated = await generateThumbnail(title, themeColor, straicoKey)
          if (generated) finalThumbnailUrl = generated
        }
      }

      // 1. ユーザー取得
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user || !user.email) throw new Error('ユーザー情報を取得できませんでした')

      // 2. subdomain取得（なければ自動発行）
      setPublishingStatus('サブドメインを確認中...')
      const subdomain = await getOrCreateSubdomain(user.id, user.email)

      // 3. slots構築
      const slots = {
        course_title: title,
        course_description: description,
        theme_color: themeColor || '#059669',
        password_protected: !!password,
        password: password || null,
        chapter_count: chapters.length,
        video_count: videoCount,
        total_duration: '',
        chapters: chapters.map((ch, i) => ({
          id: `ch-${String(i + 1).padStart(2, '0')}`,
          title: ch.title,
          video_url: ch.videoUrl,
          video_type: ch.videoType,
          text_content: ch.textContent || '',
          attachments: (ch.attachments || []).filter(a => a.trim()),
          display_number: String(i + 1),
          duration: ch.duration || '',
        })),
        current_chapter_id: 'ch-01',
        seller_name: (user.user_metadata as Record<string, string> | null)?.name || '',
        seller_email: user.email,
        completion_message: '全チャプター、お疲れさまでした。',
        completion_cta_url: '',
        completion_cta_label: '',
      }

      setPublishingStatus(isEditing ? '更新中...' : 'pagesに登録中...')

      let pageId: string
      let slug: string

      if (isEditing && editingPageId) {
        // UPDATE
        const { data: existing } = await supabase
          .from('pages')
          .select('slug, subdomain')
          .eq('id', editingPageId)
          .single()

        const { error: updErr } = await supabase
          .from('pages')
          .update({
            seo_title: title,
            seo_description: description,
            og_image_url: finalThumbnailUrl || null,
            status: 'published',
            slots,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPageId)

        if (updErr) throw updErr

        pageId = editingPageId
        slug = existing?.slug || generateSlug(title)
        const sd = existing?.subdomain || subdomain
        setViewerUrl(`https://page.digicollabo.com/${sd}/${slug}`)
      } else {
        // INSERT
        slug = generateSlug(title) + '-' + Math.random().toString(36).slice(2, 6)

        const { data, error } = await supabase
          .from('pages')
          .insert({
            subdomain,
            slug,
            template_id: 'tpl-course',
            user_email: user.email,
            seo_title: title,
            seo_description: description,
            og_image_url: finalThumbnailUrl || null,
            status: 'published',
            published_at: new Date().toISOString(),
            slots,
          })
          .select()
          .single()

        if (error) throw error

        pageId = data.id
        setViewerUrl(`https://page.digicollabo.com/${subdomain}/${slug}`)
      }

      // 4. 履歴追加
      addHistory({
        pageId,
        title,
        viewerUrl: viewerUrl || `https://page.digicollabo.com/${subdomain}/${slug}`,
        updatedAt: new Date().toISOString(),
      })
      setEditingPageId(pageId)
      setPublished(true)
    } catch (err) {
      alert(`${isEditing ? '更新' : '公開'}に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setPublishing(false)
      setPublishingStatus('')
    }
  }, [title, description, password, themeColor, thumbnailUrl, chapters, videoCount, editingPageId, isEditing, setEditingPageId, viewerUrl])

  // 公開後の画面
  if (published) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'コースが更新されました！' : 'コースが公開されました！'}
          </h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">閲覧URL</p>
            <div className="flex items-start gap-2">
              <p className="text-sm text-gray-900 break-all flex-1 font-mono">{viewerUrl}</p>
              <button onClick={() => handleCopy(viewerUrl, 'url')} className="flex-shrink-0 p-1.5 text-gray-400 hover:text-emerald-600 rounded transition-colors">
                {copied === 'url' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a href={viewerUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
            <ExternalLink className="w-4 h-4" /> 閲覧ページを開く
          </a>
          <button onClick={() => { setPublished(false); onEditAgain() }}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Pencil className="w-4 h-4" /> 編集を続ける
          </button>
          <button onClick={() => { setPublished(false); onNewCourse() }}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <FilePlus className="w-4 h-4" /> 新しいコースを作る
          </button>
        </div>
      </div>
    )
  }

  // 公開前のフォーム
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-6">
        {isEditing ? 'コースを更新' : 'コースを公開'}
      </h2>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">タイトル <span className="text-red-500">*</span></label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="コースのタイトル"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">説明 <span className="text-red-500">*</span></label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="コースの説明文"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm resize-none transition" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">閲覧パスワード（任意）</label>
            <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="空ならパスワードなし"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">テーマカラー</label>
            <div className="flex gap-2">
              <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer" />
              <input type="text" value={themeColor} onChange={e => setThemeColor(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-mono transition" />
            </div>
          </div>
        </div>

        {/* サムネイルURL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Image className="w-4 h-4 inline mr-1 -mt-0.5" />サムネイル画像URL（任意）
          </label>
          <input type="url" value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition" />
          <p className="text-xs text-gray-500 mt-1.5">
            Geminiなどで画像を生成 → Googleドライブにアップロード → 共有リンクを貼り付けてください。
            <span className="text-emerald-600 font-medium"> 未入力の場合、AIが自動でサムネイルを生成します。</span>
          </p>
          {thumbnailUrl && (
            <div className="mt-2 w-24 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              <img src={thumbnailUrl} alt="サムネイルプレビュー" className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
          )}
        </div>

        {/* サマリー */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-3">発行サマリー</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-600">{chapters.length}</p>
              <p className="text-xs text-gray-500">チャプター</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600 flex items-center justify-center gap-1">
                <Video className="w-5 h-5" /> {videoCount}
              </p>
              <p className="text-xs text-gray-500">動画付き</p>
            </div>
            <div>
              <p className="text-2xl font-bold flex items-center justify-center gap-1" style={{ color: password ? themeColor : '#9ca3af' }}>
                <Lock className="w-5 h-5" /> {password ? 'ON' : 'OFF'}
              </p>
              <p className="text-xs text-gray-500">パスワード</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <button onClick={onBack} className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-4 h-4" /> 戻る
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || !title.trim() || !description.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm">
            {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
            {publishing ? publishingStatus : isEditing ? '更新する' : '公開する'}
          </button>
        </div>
      </div>
    </div>
  )
}
