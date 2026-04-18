import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Bot, Image, Video, Loader2, Check } from 'lucide-react'
import { loadSettings, saveSettings } from '../lib/storage'
import { loadProSettings, saveProSetting } from '../lib/supabase'
import { getDefaultModel } from '../lib/ai'
import type { AppSettings } from '../types'

export default function Admin() {
  const navigate = useNavigate()

  const [settings, setSettings] = useState<AppSettings>(loadSettings())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // pro_settingsから読み込み
  useEffect(() => {
    loadProSettings().then(ps => {
      setSettings(prev => ({
        ...prev,
        ai: {
          ...prev.ai,
          provider: (ps.ai_provider as 'openai' | 'gemini' | 'anthropic') || prev.ai.provider,
          apiKey: ps.openai_api_key || ps.gemini_api_key || ps.anthropic_api_key || '',
          baseUrl: ps.openai_base_url || prev.ai.baseUrl,
          model: ps.ai_model || prev.ai.model,
          systemPrompt: ps.ai_system_prompt || prev.ai.systemPrompt,
        },
        imageGen: {
          straicoApiKey: ps.straico_api_key || prev.imageGen.straicoApiKey,
        },
        record: {
          widgetId: ps.record_widget_id || prev.record.widgetId,
        },
      }))
    })
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      // localStorageにも保存（オフライン時の初期値として）
      saveSettings(settings)

      // pro_settingsに保存（クラウド共有）
      const ps: Record<string, string> = {
        ai_provider: settings.ai.provider,
        ai_model: settings.ai.model,
        ai_system_prompt: settings.ai.systemPrompt,
        openai_base_url: settings.ai.baseUrl,
        straico_api_key: settings.imageGen.straicoApiKey,
        record_widget_id: settings.record.widgetId,
      }
      const keyMap: Record<string, string> = { openai: 'openai_api_key', gemini: 'gemini_api_key', anthropic: 'anthropic_api_key' }
      ps[keyMap[settings.ai.provider] || 'openai_api_key'] = settings.ai.apiKey

      for (const [key, value] of Object.entries(ps)) {
        await saveProSetting(key, value)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert(`保存に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setSaving(false)
    }
  }, [settings])

  const updateAI = (key: string, value: string) => {
    const update: Record<string, string> = { [key]: value }
    if (key === 'provider') update.model = getDefaultModel(value)
    setSettings(prev => ({ ...prev, ai: { ...prev.ai, ...update } }))
  }
  const updateImageGen = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, imageGen: { ...prev.imageGen, [key]: value } }))
  }
  const updateRecord = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, record: { ...prev.record, [key]: value } }))
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* ヘッダー */}
      <div className="border-b border-gray-700 bg-gray-800/50 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/studio')} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> スタジオ
          </button>
          <h1 className="font-bold">設定</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
          {/* AI設定 */}
          <Section icon={Bot} title="AI設定">
            <div>
              <label className="block text-sm text-gray-400 mb-1">AIプロバイダー</label>
              <select
                value={settings.ai.provider}
                onChange={e => updateAI('provider', e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </div>
            <Field label="APIキー" value={settings.ai.apiKey} onChange={v => updateAI('apiKey', v)} type="password" />
            {settings.ai.provider === 'openai' && (
              <Field label="ベースURL" value={settings.ai.baseUrl} onChange={v => updateAI('baseUrl', v)} placeholder="https://api.openai.com" />
            )}
            <Field label="モデル名" value={settings.ai.model} onChange={v => updateAI('model', v)} />
            <div>
              <label className="block text-sm text-gray-400 mb-1">システムプロンプト</label>
              <textarea
                value={settings.ai.systemPrompt}
                onChange={e => updateAI('systemPrompt', e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white resize-none"
              />
            </div>
          </Section>

          {/* 画像生成設定 */}
          <Section icon={Image} title="画像生成設定">
            <Field label="Straico APIキー" value={settings.imageGen.straicoApiKey} onChange={v => updateImageGen('straicoApiKey', v)} type="password" />
            <p className="text-xs text-gray-500">Straicoダッシュボード → API Keys から取得してください。サムネイル未入力時に自動生成されます。</p>
          </Section>

          {/* 録画設定 */}
          <Section icon={Video} title="録画設定">
            <Field label="録画ウィジェットID" value={settings.record.widgetId} onChange={v => updateRecord('widgetId', v)} />
            <p className="text-xs text-gray-500">ダッシュボード → Other → Widget ID をコピーしてください</p>
          </Section>
        </div>
      </div>

      {/* 保存ボタン（固定） */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
        <div className="max-w-3xl mx-auto flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {saved ? '保存しました' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h2 className="flex items-center gap-2 text-lg font-bold mb-5">
        <Icon className="w-5 h-5 text-emerald-400" /> {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
      />
    </div>
  )
}
