---
name: add-exhibit
description: End-to-end workflow for adding a new GLB/GLTF exhibit to the 3D Memory Gallery. Use when the user provides a 3D model file path (e.g. "/Users/.../3Ddata.glb", "/Users/.../scene.gltf") and wants it published to the gallery, or says things like "新しい展示を追加", "このモデルを追加して", "次の展示を登録したい", "このGLTFを追加して". Handles file placement, content collection entry, local verification, commit, and deploy monitoring.
---

# Add a new exhibit

Ship a user-provided 3D model (GLB or GLTF) through the gallery content pipeline until it is live on https://www.satoryu.com/3d-memory-gallery/.

## Inputs needed from the user

Required:

- 3D model path (absolute local path) — either a single `.glb` file or a `.gltf` file (the containing directory's companion `.bin`/texture files will be copied alongside it)
- Title
- Event name
- Description (one or two sentences)

Often inferrable, confirm rather than ask:

- **capturedAt** — if the model's parent directory is a timestamp like `2026-02-27-20-02-56`, extract the date. Confirm with the user before using it.
- **slug / filename** — propose a URL-safe, descriptive slug derived from the title (ASCII, lowercase, hyphen-separated). The same slug is used for the model filename/directory and the markdown filename.

Optional:

- Poster image path (static image shown before the 3D viewer loads)

## Workflow

### 1. Inspect the model

```bash
ls -lh "<path>" && file "<path>"
```

Determine the format and confirm validity:

**If the path is a `.glb` file:**

- `file` output must start with `glTF binary model, version 2`. If not, stop and ask.
- Size under 30MB is comfortable on GitHub Pages. Over 50MB, warn the user and suggest running `gltf-transform` (Draco+Meshopt) before continuing — see CLAUDE.md.

**If the path is a `.gltf` file:**

- `file` output should identify it as JSON or ASCII text.
- Verify the file contains `"asset"` with `"version": "2.0"` by inspecting the JSON.
- Scan the containing directory for companion files (`.bin`, textures):
  ```bash
  ls -lhR "$(dirname "<gltf-path>")"
  ```
- Check total size of the directory. Over 50MB, warn the user.
- Check that all `"uri"` values in the `.gltf` JSON are relative paths. If any start with `/`, `http`, or `..`, warn the user — these will break when deployed. The user should re-export with relative paths rather than editing the GLTF.

**If the path is a directory:**

- Look for `.gltf` or `.glb` files inside. If exactly one model file is found, use it. If multiple are found, ask the user which one to use.

### 2. Gather metadata

Ask for title, event name, description. Extract `capturedAt` from directory timestamp if present and confirm.

Propose a slug from the title. If the title is non-ASCII (e.g. Japanese), translate/transliterate to a short ASCII slug — do not leave non-ASCII in filenames.

### 3. Place the model and write the exhibit markdown

**For GLB (single file):**

```bash
cp "<source-path>" public/models/<slug>.glb
```

Frontmatter `model` value: `models/<slug>.glb`

**For GLTF (multi-file):**

```bash
mkdir -p public/models/<slug>
cp -R "$(dirname "<gltf-path>")"/* public/models/<slug>/
```

Frontmatter `model` value: `models/<slug>/<gltf-filename>.gltf` (use the actual `.gltf` filename from the source directory)

---

Create `src/content/exhibits/<slug>.md`:

```markdown
---
title: <title>
capturedAt: <YYYY-MM-DD>
eventName: <event-name>
description: <description>
model: models/<slug>.glb  # or models/<slug>/<filename>.gltf
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
```

For GLB:
```bash
curl -sI http://localhost:4321/3d-memory-gallery/models/<slug>.glb | head -3
```

For GLTF:
```bash
curl -sI http://localhost:4321/3d-memory-gallery/models/<slug>/<filename>.gltf | head -3
# Also spot-check a companion .bin file if one exists:
curl -sI http://localhost:4321/3d-memory-gallery/models/<slug>/<bin-file>.bin | head -3
```

The model response's `Content-Length` should match the source file size exactly. Also grep the detail page for title/event name/description to confirm the frontmatter rendered.

### 5. Ask the user to visually confirm

WebGL rendering cannot be verified from curl. Explicitly tell the user:

> 「SSR/配信レベルは OK ですが WebGL の見た目は確認できません。ブラウザで http://localhost:4321/3d-memory-gallery/ を開いて、ショーケース内にモデルが収まっているか・向きや位置が正しいかを確認してください。」

Common things that may need follow-up tweaks after the user looks:

- Model is upside down or sideways → apply rotation in `ExhibitModel` (usually a rotation on the `<primitive>`)
- Model position is slightly off the pedestal → adjust `PEDESTAL_TOP_Y` math or the fit constants
- Auto-fit feels too small/large → tune `CASE_FIT_X/Y/Z` in `Gallery.tsx`

Do NOT commit until the user confirms the visual result is acceptable.

### 6. Commit

Use two logically-separated commits if the workflow also touched `Gallery.tsx` or other code. For a pure content addition, one commit is fine. For GLTF exhibits, `git add` the entire `public/models/<slug>/` directory.

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

- **Never commit model files or markdown before visual confirmation.** The user is the only one who can see WebGL output.
- **Never put non-ASCII in filenames.** Slug stays ASCII even if title is Japanese.
- **Never rewrite paths inside `.gltf` files.** The subdirectory copy approach preserves relative references. If relative paths break, fix the copy — don't edit the GLTF JSON.
- **Never hand-write URLs starting with `/exhibits/...` or `/models/...` in code.** The `base` prefix is required for GitHub Pages; always go through `import.meta.env.BASE_URL`. (This skill's workflow doesn't touch URL-assembling code, but if follow-up tweaks do, honor the rule.)
- **Never bypass peer-dep resolution** (`--force`, `--legacy-peer-deps`) when installing. `three` is pinned at `~0.182.0` because `@google/model-viewer` demands it — see CLAUDE.md.
