import type { AISettings, ChatMessage } from '../types'

// AIチャット送信（マルチプロバイダー対応）
export async function sendAIMessage(
  messages: ChatMessage[],
  settings: AISettings
): Promise<string> {
  const { provider, apiKey, baseUrl, model, systemPrompt } = settings

  if (!apiKey) throw new Error('APIキーが設定されていません。管理画面で設定してください。')

  switch (provider) {
    case 'openai':
      return sendOpenAI(messages, apiKey, baseUrl || 'https://api.openai.com', model || 'gpt-4o-mini', systemPrompt)
    case 'gemini':
      return sendGemini(messages, apiKey, model || 'gemini-2.0-flash', systemPrompt)
    case 'anthropic':
      return sendAnthropic(messages, apiKey, model || 'claude-sonnet-4-20250514', systemPrompt)
    default:
      throw new Error(`未対応のプロバイダー: ${provider}`)
  }
}

// OpenAI互換API
async function sendOpenAI(
  messages: ChatMessage[], apiKey: string, baseUrl: string, model: string, systemPrompt: string
): Promise<string> {
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: apiMessages, temperature: 0.7 }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI APIエラー: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || '回答を取得できませんでした。'
}

// Google Gemini
async function sendGemini(
  messages: ChatMessage[], apiKey: string, model: string, systemPrompt: string
): Promise<string> {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini APIエラー: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '回答を取得できませんでした。'
}

// Anthropic Claude
async function sendAnthropic(
  messages: ChatMessage[], apiKey: string, model: string, systemPrompt: string
): Promise<string> {
  const apiMessages = messages.map(m => ({ role: m.role, content: m.content }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages: apiMessages }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic APIエラー: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text || '回答を取得できませんでした。'
}

// デフォルトモデル名取得
export function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'openai': return 'gpt-4o-mini'
    case 'gemini': return 'gemini-2.0-flash'
    case 'anthropic': return 'claude-sonnet-4-20250514'
    default: return 'gpt-4o-mini'
  }
}
