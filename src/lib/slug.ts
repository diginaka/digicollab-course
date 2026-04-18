// 日本語タイトル → URLセーフなslugへの変換
// 英数字と - のみ、最大50文字、空なら'course'
export function generateSlug(title: string): string {
  if (!title) return 'course'
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // 英数字・空白・ハイフン以外を削除（日本語も削除される）
    .replace(/[\s_]+/g, '-')   // 空白とアンダースコアをハイフンに
    .replace(/-+/g, '-')       // 連続ハイフンを1つに
    .replace(/^-+|-+$/g, '')   // 前後のハイフンを削除
    .slice(0, 50)
  return slug || 'course'
}
