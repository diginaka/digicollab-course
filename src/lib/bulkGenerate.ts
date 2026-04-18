// AI一括生成ロジック
// 1回のAPIコールでコース全体のメタデータ + 全レッスンのタイトル/説明を生成する
//
// 将来拡張ポイント（現在は未実装）:
// - 20レッスン超の場合は3層構造（全体アーク → セクションアウトライン → 個別レクチャー）に変更
//   現状はフラットな chapters[] のみ。レッスン数20を上限としている。

import { sendAIMessage } from './ai'
import type { AISettings, ChatMessage, BulkGenerateInput, GeneratedCourse } from '../types'

const TONE_LABELS: Record<BulkGenerateInput['tone'], string> = {
  friendly: 'フレンドリー',
  professional: 'プロフェッショナル',
  approachable: '親しみやすい',
  authoritative: '権威的',
}

// 生成用のシステムプロンプト（ハードコード）
const SYSTEM_PROMPT = `あなたはオンラインコース設計のプロフェッショナルです。
ユーザーの入力（コーステーマ / 対象者 / レッスン数 / トーン）に基づいて、1本のコース全体を設計し、必ず有効なJSON形式で返してください。
JSON以外の文字列、説明文、コードブロック記号（\`\`\`）は一切出力しないでください。

出力フォーマット：
{
  "courseTitle": "コース全体のタイトル（40文字以内）",
  "courseDescription": "コース全体の説明文（200文字以内、受講後に得られる変化を含める）",
  "thumbnailCopy": "SEO/OGP用のコピー（100文字以内）",
  "totalDuration": "約◯時間◯分（1レッスン平均20分で計算）",
  "lessons": [
    {
      "title": "レッスンタイトル（30文字以内）",
      "description": "このレッスンの本文・学習内容の説明（150文字以内）",
      "learningGoal": "このレッスン完了時に受講者ができるようになること（50文字以内）",
      "section": "（任意）セクション名。11レッスン以上のとき自動でセクション分け"
    }
  ],
  "completionMessage": "全チャプター完了時のお祝いメッセージ（80文字以内）",
  "completionCtaLabel": "次のアクションへのCTAボタンテキスト（15文字以内）"
}`

// ユーザープロンプト構築
function buildUserPrompt(input: BulkGenerateInput): string {
  const { theme, lessonCount, tone } = input
  const sectionNote = lessonCount >= 11
    ? '11レッスン以上あるため、2〜3個のセクションに自動分割し、各レッスンの section フィールドを埋めてください。'
    : '10レッスン以下のため、section フィールドは省略してもよいです。'

  return `以下の条件でオンラインコースを設計してください：

【コーステーマ / 対象者】
${theme}

【レッスン数】
${lessonCount}レッスン（厳守）

【文体・トーン】
${TONE_LABELS[tone]}

【セクション構成】
${sectionNote}

【所要時間】
1レッスン平均20分換算で totalDuration を計算してください（例: 5レッスン → 約1時間40分）。

JSON形式のみで出力してください。`
}

// JSON抽出（AIが```json...```で囲んだ場合の対策）
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenceMatch) return fenceMatch[1].trim()
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1)
  }
  return text.trim()
}

// レスポンスのバリデーションと正規化
function validateAndNormalize(raw: unknown, expectedLessonCount: number): GeneratedCourse {
  if (!raw || typeof raw !== 'object') throw new Error('AIが不正な形式のレスポンスを返しました')
  const obj = raw as Record<string, unknown>

  const lessons = obj.lessons
  if (!Array.isArray(lessons) || lessons.length === 0) {
    throw new Error('AIがレッスン配列を返しませんでした')
  }

  const normalizedLessons = lessons.slice(0, expectedLessonCount).map((l, i) => {
    const lesson = (l || {}) as Record<string, unknown>
    return {
      title: String(lesson.title || `レッスン${i + 1}`),
      description: String(lesson.description || ''),
      learningGoal: String(lesson.learningGoal || ''),
      section: lesson.section ? String(lesson.section) : undefined,
    }
  })

  return {
    courseTitle: String(obj.courseTitle || '無題のコース'),
    courseDescription: String(obj.courseDescription || ''),
    thumbnailCopy: String(obj.thumbnailCopy || ''),
    totalDuration: String(obj.totalDuration || `約${Math.round(expectedLessonCount * 20 / 60 * 10) / 10}時間`),
    lessons: normalizedLessons,
    completionMessage: String(obj.completionMessage || '全チャプター、お疲れさまでした。'),
    completionCtaLabel: String(obj.completionCtaLabel || '次へ'),
  }
}

// 一括生成のメイン関数
export async function generateCourseBulk(
  input: BulkGenerateInput,
  aiSettings: AISettings
): Promise<GeneratedCourse> {
  if (!input.theme.trim()) throw new Error('コーステーマを入力してください')
  if (input.lessonCount < 5 || input.lessonCount > 20) {
    throw new Error('レッスン数は5〜20の範囲で指定してください')
  }

  // システムプロンプトをハードコード版に差し替えて呼び出す
  const settingsForBulk: AISettings = {
    ...aiSettings,
    systemPrompt: SYSTEM_PROMPT,
  }

  const messages: ChatMessage[] = [
    { role: 'user', content: buildUserPrompt(input) },
  ]

  const reply = await sendAIMessage(messages, settingsForBulk)
  const jsonText = extractJson(reply)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('AIの応答をJSONとして解析できませんでした。もう一度お試しください。')
  }

  return validateAndNormalize(parsed, input.lessonCount)
}

// 生成結果をchapterの text_content に合成する
// description + 学習目標を1つのテキストにまとめる（Step 2の本文欄に入る）
export function mergeDescriptionAndGoal(lesson: { description: string; learningGoal: string }): string {
  if (!lesson.learningGoal) return lesson.description
  if (!lesson.description) return `【学習目標】${lesson.learningGoal}`
  return `${lesson.description}\n\n【学習目標】${lesson.learningGoal}`
}
