# デジコラボ コース

コース・サービスの企画から作成・配信・出品まで完結するオールインワンツール。

## 特徴

- AI企画アシスタント（OpenAI / Gemini / Claude対応）
- テレプロンプター（速度調整可能）
- ドラッグ&ドロップでチャプター構成
- パスワード保護配信

## セットアップ

```bash
npm install
npm run dev
```

## 環境変数

`.env.example` を `.env` にコピーして設定：

```
VITE_DATA_MODE=standalone    # standalone または supabase
VITE_SUPABASE_URL=           # supabaseモード時のみ
VITE_SUPABASE_ANON_KEY=      # supabaseモード時のみ
```

## ビルド

```bash
npm run build
```

`dist/` フォルダが生成されます。
