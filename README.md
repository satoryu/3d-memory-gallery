# 3D Memory Gallery

イベントや旅先で撮影した立体物をフォトグラメトリで 3D モデル化し、博物館の展示のように並べて公開するための個人サイト。

🔗 **公開中**: https://www.satoryu.com/3d-memory-gallery/

## 構成

- [Astro](https://astro.build/) (静的出力) + React 19
- 一覧ページ: [`@react-three/fiber`](https://r3f.docs.pmnd.rs/) + [`@react-three/drei`](https://github.com/pmndrs/drei) — 共通の 3D 空間にショーケースを並べて表示
- 詳細ページ: [`<model-viewer>`](https://modelviewer.dev/) — 単一モデルを実寸表示、AR 対応
- GitHub Actions で `main` ブランチから GitHub Pages へ自動デプロイ

設計上のトレードオフは [`CLAUDE.md`](./CLAUDE.md) にまとめてあります。

## 展示を追加する

1. GLB ファイルを `public/models/` に置く
2. `src/content/exhibits/<slug>.md` を作成:

   ```markdown
   ---
   title: 展示のタイトル
   capturedAt: 2026-04-19
   eventName: イベント名
   description: 説明文
   model: models/your-file.glb
   ---

   本文 (任意)
   ```

3. `git push` → 約 40 秒で本番に反映される

## ローカル開発

```sh
npm install
npm run dev     # http://localhost:4321/3d-memory-gallery/
npm run build   # 静的ビルド → dist/
npx astro check # 型 + スキーマチェック
```

Node.js 22 以上が必要。

## ディレクトリ概要

```
src/
├── content.config.ts       # 展示データのスキーマ (zod)
├── content/exhibits/       # 展示 1 件 = 1 Markdown
├── pages/
│   ├── index.astro         # 一覧 (R3F)
│   └── exhibits/[slug].astro  # 詳細 (model-viewer)
├── components/
│   ├── Gallery.tsx
│   └── ModelViewer.astro
└── layouts/Base.astro
public/models/              # GLB 本体
```
