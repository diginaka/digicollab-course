import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import Studio from './pages/Studio'
import Admin from './pages/Admin'
import { supabase } from './lib/supabaseClient'
import { initSSO } from './lib/initSSO'
import { ExternalLink } from 'lucide-react'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true

    // 1. SSO受け取り → 既存セッションチェック
    ;(async () => {
      await initSSO()
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      setChecking(false)
    })()

    // 2. セッション変化を監視
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s)
    })

    // 3. 60秒おきにポーリング（タブが長時間開きっぱなしでも維持）
    const interval = window.setInterval(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
    }, 60000)

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
      window.clearInterval(interval)
    }
  }, [])

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 未ログイン: フロービルダー本体への案内のみ
  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50/50 to-white px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
            デジコラボ コース
          </h1>
          <p className="text-gray-600 leading-relaxed mb-8">
            このアプリはフロービルダーの一部です。<br />
            フロービルダー本体からアクセスしてください。
          </p>
          <a
            href="https://digicollabo.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            フロービルダーを開く <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/studio" replace />} />
      <Route path="/studio" element={<Studio />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/studio" replace />} />
    </Routes>
  )
}
