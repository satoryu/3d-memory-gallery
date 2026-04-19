---
name: add-exhibit
description: End-to-end workflow for adding a new GLB exhibit to the 3D Memory Gallery. Use when the user provides a GLB file path (e.g. "/Users/.../3Ddata.glb") and wants it published to the gallery, or says things like "新しい展示を追加", "このモデルを追加して", "次の展示を登録したい". Handles file placement, content collection entry, local verification, commit, and deploy monitoring.
---

# Add a new exhibit

Ship a user-provided GLB through the gallery content pipeline until it is live on https://www.satoryu.com/3d-memory-gallery/.

## Inputs needed from the user

Required:

- GLB file path (absolute local path)
- Title
- Event name
- Description (one or two sentences)

Often inferrable, confirm rather than ask:

- **capturedAt** — if the GLB's parent directory is a timestamp like `2026-02-27-20-02-56`, extract the date. Confirm with the user before using it.
- **slug / filename** — propose a URL-safe, descriptive slug derived from the title (ASCII, lowercase, hyphen-separated). The same slug is used for both the GLB filename and the markdown filename.

Optional:

- Poster image path (static image shown before the 3D viewer loads)

## Workflow

### 1. Inspect the GLB

```bash
ls -lh "<path>" && file "<path>"
```

Confirm:

- Size is reasonable. Under 30MB is comfortable on GitHub Pages. Over 50MB, warn the user and suggest running `gltf-transform` (Draco+Meshopt) before continuing — see CLAUDE.md.
- `file` output starts with `glTF binary model, version 2`. If not, stop and ask.

### 2. Gather metadata

Ask for title, event name, description. Extract `capturedAt` from directory timestamp if present and confirm.

Propose a slug from the title. If the title is non-ASCII (e.g. Japanese), translate/transliterate to a short ASCII slug — do not leave non-ASCII in filenames.

### 3. Place the GLB and write the exhibit markdown

```bash
cp "<source-path>" public/models/<slug>.glb
```

Create `src/content/exhibits/<slug>.md`:

```markdown
---
title: <title>
capturedAt: <YYYY-MM-DD>
eventName: <event-name>
description: <description>
model: models/<slug>.glb
---
```

The `model` field is the path **relative to `public/`** — do NOT prefix with `/` or `BASE_URL`. Runtime code assembles the full URL via `import.meta.env.BASE_URL`.

The frontmatter schema lives in `src/content.config.ts`. If it has changed since this skill was written, match the current schema.

### 4. Verify locally

Start the dev server if it is not running:

```bash
npm run dev > /tmp/astro-dev.log 2>&1 &
```

Wait ~5s, then verify three things respond 200:

```bash
curl -s -o /dev/null -w "index: %{http_code}\n" http://localhost:4321/3d-memory-gallery/
curl -s -o /dev/null -w "detail: %{http_code}\n" http://localhost:4321/3d-memory-gallery/exhibits/<slug>/
curl -sI http://localhost:4321/3d-memory-gallery/models/<slug>.glb | head -3
```

The GLB response's `Content-Length` should match the source file size exactly. Also grep the detail page for title/event name/description to confirm the frontmatter rendered.

### 5. Ask the user to visually confirm

WebGL rendering cannot be verified from curl. Explicitly tell the user:

> 「SSR/配信レベルは OK ですが WebGL の見た目は確認できません。ブラウザで http://localhost:4321/3d-memory-gallery/ を開いて、ショーケース内にモデルが収まっているか・向きや位置が正しいかを確認してください。」

Common things that may need follow-up tweaks after the user looks:

- Model is upside down or sideways → apply rotation in `ExhibitModel` (usually a rotation on the `<primitive>`)
- Model position is slightly off the pedestal → adjust `PEDESTAL_TOP_Y` math or the fit constants
- Auto-fit feels too small/large → tune `CASE_FIT_X/Y/Z` in `Gallery.tsx`

Do NOT commit until the user confirms the visual result is acceptable.

### 6. Commit

Use two logically-separated commits if the workflow also touched `Gallery.tsx` or other code. For a pure content addition, one commit is fine.

Commit message template:

```
feat: add exhibit — <title>

<1-2 sentences about the subject, the capture context, and why it is
worth putting in the gallery>
```

### 7. Push and monitor deploy

```bash
git push
gh run list --limit 1  # grab the new run ID
gh run watch <run-id> --exit-status
```

Deploy usually finishes in ~40 seconds (build ~25s + deploy ~10s). After success, report the live URL:

> 公開済: https://www.satoryu.com/3d-memory-gallery/exhibits/<slug>/

## Guardrails

- **Never commit the GLB or markdown before visual confirmation.** The user is the only one who can see WebGL output.
- **Never put non-ASCII in filenames.** Slug stays ASCII even if title is Japanese.
- **Never hand-write URLs starting with `/exhibits/...` or `/models/...` in code.** The `base` prefix is required for GitHub Pages; always go through `import.meta.env.BASE_URL`. (This skill's workflow doesn't touch URL-assembling code, but if follow-up tweaks do, honor the rule.)
- **Never bypass peer-dep resolution** (`--force`, `--legacy-peer-deps`) when installing. `three` is pinned at `~0.182.0` because `@google/model-viewer` demands it — see CLAUDE.md.
