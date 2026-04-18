// UUID生成
export function generateId(): string {
  return crypto.randomUUID()
}

// クリップボードコピー
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
