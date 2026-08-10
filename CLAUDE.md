# CLAUDE.md, Nikko Sudirman portfolio (v2)

Working notes for AI agents: project facts and house rules that aren't
obvious from the code. See `README.md` for structure and how to run.

## 1. This folder is the site, ignore the old one
- The git repo root **is** `v2_2026-08-05/`. `git rev-parse --show-toplevel`
  confirms it. Remote: `github.com/Nikkogitme/portfolio`, deployed from `main`.
- There is a **second, superseded** `index.html` in the PARENT folder
  (`26.08_Portfolio/`). It is NOT the live site. Never edit it.
- Trap: Claude Code's dev server docroot is the PARENT folder, so
  `http://localhost:5173/` serves the OLD page. The live page is at
  `http://localhost:5173/v2_2026-08-05/`. Always verify against that path.
- Trap: relative paths in Write/Edit resolve against the PARENT (the harness
  primary working directory), not this folder. Editing a bare `index.html`
  can hit the wrong file silently. **Use absolute paths, or paths prefixed
  with `v2_2026-08-05/`, for every edit**, and confirm with `git status`.

## 2. Locked decisions
- **No build step, no framework, no npm.** Hand-authored HTML/CSS/JS. Python
  tooling is standard-library only. Do not introduce a bundler or dependencies.
- **Cache-busting is manual.** `index.html` references assets as
  `assets/css/style.css?v=YYYYMMDD` and `assets/js/main.js?v=YYYYMMDD`.
  Whenever you change either file, bump BOTH query strings to today's date in
  the same commit. Static hosting caches aggressively; skipping this makes
  users test stale assets and report phantom bugs (this happened with the
  Toolkit reset, see git history around commit 3826b87).
- **`scripts/check_site.py` handles `?v=` query strings** (it strips them
  before existence checks), so cache-busting does not break the checker.

## 3. Run the checker before every commit
- `python scripts/check_site.py` (exit 1 on failure). It enforces the house
  rules below and catches broken local paths, duplicate ids, dead anchors,
  missing `<img>` alt/width/height, malformed `data-gallery` JSON, and unused
  or missing SVG symbols. It is NOT a substitute for HTML validation,
  Lighthouse, axe, or manual keyboard and screen-reader testing.

## 4. House style (checker-enforced unless noted)
- **NEVER use em dashes, or the `mdash` HTML entity,** in visible content, in
  any `.html/.md/.js/.css` file. The checker FAILS on the em-dash character and
  on the literal `&`+`mdash;` string (code comments are exempt, and note this
  ban even catches the entity written out in prose, as this line proves). Use a
  colon, a comma, or restructure. This is a hard rule; it applies to this file.
- **En dash for numeric and date ranges** (e.g. `2018` to `2021`, written with
  `&ndash;` in HTML). The checker WARNS on a hyphen in a date range.
- Prefer HTML entities already in use: `&rsquo;`, `&ndash;`, `&middot;`,
  `&nbsp;`, `&amp;`.
- Naming: Nikko uses **GitHub** as the version-control home for automation
  scripts (migrated off siloed server folders). "GitHub" is not "GitHub
  Copilot"; if a request is ambiguous between a product and a platform, ask.

## 5. Structural conventions actually in use
- **SVG icons:** define `<symbol id="ic-NAME">` in the inline sprite near the
  top of `index.html`; reference via `<use href="#ic-NAME"/>`. The checker
  flags a `<use>` with no symbol (FAIL) and a symbol with no `<use>` (NOTE),
  so remove orphaned symbols when you remove their last use.
- **"Design Technology in practice" case cards** use a `<dl class="case-dl">`
  with a fixed rhythm of `<dt>` labels: Problem / Control / Artefact, plus one
  of Reach / Decision / Purpose. Keep three to four terms; match sibling cards.
- **Toolkit pills** are real `<li class="tool-pill">` items grouped by category.
  A Matter.js physics layer (drop plus Reset) is progressive enhancement,
  guarded by `reduce` (prefers-reduced-motion) and `typeof window.Matter`.
  Without either, pills stay in normal flex layout. New pills are picked up
  automatically, just add the `<li>`.
- **Copy-to-clipboard buttons** carry their value in `data-email` (markup is
  the single source of truth); JS reads it, uses the async Clipboard API with
  an `execCommand` fallback, and confirms via an icon swap plus label change.
- **CSS tokens:** dark-band uses `--on-dark`, `--on-dark-60`, `--accent-lift`,
  `--rule-dark`, `--ink-bg`. Terracotta pill colours are self-contained tokens
  scoped to `.tool-pills` (`--pill-fill` etc.), deliberately outside the main
  palette. Reuse `.btn` / `.btn--ghost`; add modifiers (e.g. `.btn--pill`)
  rather than new base styles.

## 6. Git workflow (established, not the default)
- Nikko commits straight to `main` and pushes after each change. This is a
  solo portfolio; do NOT create feature branches (this overrides the usual
  branch-first default). Confirm before pushing unless told otherwise.
- Commit-message footer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- The Windows line-ending warning (`LF will be replaced by CRLF`) on commit is
  benign; ignore it.

## 7. Known deploy hygiene
- `_source/` (about 39 MB of full-res originals) must NEVER be deployed; it is
  git-ignored. `.nojekyll` is present so GitHub Pages serves files raw.
