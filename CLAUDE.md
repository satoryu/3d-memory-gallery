# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

A personal, museum-style gallery for 3D models (GLB/GLTF files) captured via smartphone photogrammetry at events the owner attended. Static site published via GitHub Pages.

## Tech stack essentials

- **Astro 6** (static output) + **React 19** integration
- **Gallery page**: `@react-three/fiber` + `@react-three/drei` — a single WebGL canvas rendering many showcases in one shared 3D scene
- **Detail page**: `@google/model-viewer` — one model per page, includes AR support for free
- TypeScript strict; `npx astro check` for type checking

### Why the hybrid (don't "consolidate" this)

`<model-viewer>` creates an **independent WebGL context per instance**. Browsers cap contexts at ~8–16, so tiling it across a gallery of N exhibits breaks at scale. R3F uses one Canvas = one context for the whole gallery. The detail page only ever shows one model, so model-viewer is the simpler choice there and gives AR/Quick Look out of the box.

## Critical version pin: `three@~0.182.0`

`@google/model-viewer@4.2` has a **strict** peer dep `three@^0.182.0`. `@react-three/drei` happily pulls newer three (e.g. 0.184+), which breaks model-viewer's peer resolution and blocks further `npm install`s with ERESOLVE. If you upgrade three, upgrade `@types/three` to match and verify both packages still resolve peers cleanly.

## GitHub Pages path handling

`astro.config.mjs` sets `base: '/3d-memory-gallery'`. **Every URL generated in code must go through `import.meta.env.BASE_URL`** — don't hand-write `/exhibits/...` or `/models/...`, they'll 404 in production. Pattern used throughout:

```ts
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const href = `${base}/exhibits/${slug}/`;
```

The site is reachable at both `https://satoryu.github.io/3d-memory-gallery/` and `https://www.satoryu.com/3d-memory-gallery/` (user-level custom domain redirects the github.io URL to the custom one).

## Adding a new exhibit (expected workflow)

This is the whole content loop — no code changes needed:

1. Place the model under `public/models/`:
   - **GLB** (single file): copy to `public/models/<slug>.glb`
   - **GLTF** (multi-file): copy the entire export directory to `public/models/<slug>/` — the `.gltf`, `.bin`, and texture files must keep their relative paths
2. Create `src/content/exhibits/<slug>.md` with frontmatter matching the schema in `src/content.config.ts` (title, capturedAt, eventName, description, model, optional poster)
3. `git push` → GitHub Actions auto-deploys in ~40s

The detail route `/exhibits/[slug]/` is generated statically via `getStaticPaths` over the `exhibits` collection. The gallery page pulls the same collection and lays out one showcase per entry.

## Hydration directives (important)

- `Gallery.tsx` is loaded with **`client:only="react"`**, not `client:load`. R3F touches `window`/WebGL at module-eval time and cannot be SSR'd.
- `ModelViewer.astro` registers the custom element via a **side-effect `import('@google/model-viewer')` inside a `<script>` tag** — this is what keeps it out of the SSR bundle. `astro.config.mjs` also lists it under `vite.ssr.noExternal` for the same reason. Don't import it from a `.astro` frontmatter block.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at `http://localhost:4321/3d-memory-gallery/` |
| `npm run build` | Static build to `dist/` |
| `npm run preview` | Serve built `dist/` locally to sanity-check the production bundle |
| `npx astro check` | TypeScript + Astro content schema check |

## Deploy

`.github/workflows/deploy.yml` builds with `withastro/action@v3` and publishes via `actions/deploy-pages@v4` on push to `main`. Pages source is set to "GitHub Actions" at the repo level (one-time setting, already done). The `pages` concurrency group ensures in-flight deploys finish rather than being cancelled.

## Model size considerations (future-relevant)

GitHub Pages has a 100MB per-file limit and ~1GB soft repo limit. Raw photogrammetry models can blow past this quickly. When files start pushing limits, run them through `gltf-transform` (Draco + Meshopt) before committing — typically 70–90% reduction with negligible visual loss. For GLTF, the total size includes all referenced `.bin` and texture files, not just the `.gltf` JSON. If the repo itself gets heavy, move models to external storage (Cloudflare R2, etc.) and keep only metadata in the repo.
