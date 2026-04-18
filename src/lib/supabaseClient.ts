import { createClient } from '@supabase/supabase-js'

// フロービルダー統合: storageKey分離でハブ/子アプリのセッション独立
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      storageKey: 'sb-digicollab-course',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
