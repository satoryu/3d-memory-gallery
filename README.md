# 3D Memory Gallery

イベントや旅先で撮影した立体物をフォトグラメトリで 3D モデル化し、博物館の展示のように並べて公開するための個人サイト。

🔗 **公開中**: https://www.satoryu.com/3d-memory-gallery/

## 構成

- [Astro](https://astro.build/) (静的出力) + React 19
- 一覧ページ: [`@react-three/fiber`](https://r3f.docs.pmnd.rs/) + [`@react-three/drei`](https://github.com/pmndrs/drei) — 共通の 3D 空間にショーケースを並べて表示
- 詳細ページ: [`<model-viewer>`](https://modelviewer.dev/) — 単一モデルを実寸表示、AR 対応
- GitHub Actions で `main` ブランチから GitHub Pages へ自動デプロイ

設計上のトレードオフは [`CLAUDE.md`](./CLAUDE.md) にまとめてあります。

## 展示室の歩き方

「館内を歩く」を押すと、目の高さ（1.6m）の一人称視点で鑑賞できます。
Tab で展示室にフォーカスして Enter を押しても開始できます。

| 操作 | キー |
|---|---|
| 前進・後退 | W / S または ↑ / ↓ |
| 左右に平行移動 | A / D |
| 左右を向く | ← / → または Q / E |
| 見上げる・見下ろす | PageUp / PageDown |
| 近くの正面の作品を開く | Enter（案内が表示されているとき） |
| 入口に戻る | R または「入口に戻る」 |
| 一時停止 | Esc |

- マウス・タッチのドラッグでも視点を変更できます。タッチ端末には移動ボタンを表示します。
- 壁・展示台・解説板・ベンチはすり抜けられません。頭の上下動や自動旋回はありません。
- 別のタブやウィンドウに移ると操作を停止します。通常の Tab キー操作やブラウザーのショートカットはそのまま使えます。
- 「作品目録」からは、3D 空間を移動せずに各作品の詳細ページを開けます。
- 内装の木目・照明・館内サインはローカルで生成し、外部の画像・フォント配信には依存しません。

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
npm test        # 展示室のレイアウト・移動・衝突判定テスト
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
