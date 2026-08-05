# Nikko Sudirman, portfolio

Static single-page portfolio. No build step, no framework, no `npm install`.
Open `index.html` in a browser, or drop the folder on any static host.

This is `v2_2026-08-05`. The previous version is preserved in the parent folder
and is not affected by anything here.

## Run locally

```bash
python -m http.server 5173
```

Then open <http://localhost:5173>. A plain `file://` open mostly works, but a
local server matches deployed behaviour.

## Structure

```
index.html                  all markup and copy
assets/css/style.css        design system and every component
assets/js/main.js           motion, hero canvas, scroll-spy, accordion, lightbox
assets/img/thumbs/          card images, loaded with the page
assets/img/projects/        full-size images, loaded only when a lightbox opens
assets/img/chips/           the small square images inside the headline
assets/img/og-cover.webp    1200x630 social preview
assets/docs/                resume PDF
docs/security-headers.md    CSP and header guidance per host
scripts/check_site.py       repository consistency checker
_source/                    full-resolution originals, NOT part of the site
.claude/launch.json         dev-server config for Claude Code's preview
```

**`_source/` must not be deployed.** It holds the 39 MB of full-resolution
originals the web assets were derived from (`NS Headshot.jpg`, `BIM System.jpg`,
`1 Denison_Cover Page.pdf`, `Portrait.jpg`). The site itself is 4 MB. Nothing
references these files. Exclude the folder from your deploy, or delete it once
you have the originals stored elsewhere.

## Design system

Palette is "Blueprint": warm paper, graphite ink, one cobalt signal colour.
Everything is driven by custom properties at the top of `style.css`.

| Token | Value | Used for |
|---|---|---|
| `--paper` | `#f4f2ed` | page background |
| `--ink` | `#16181c` | body text, buttons |
| `--ink-50` | `#5f6672` | muted body copy |
| `--accent` | `#1d4ed8` | links, rules, active states, canvas |
| `--accent-lift` | `#7ea2f5` | the same signal, lightened for the dark band |
| `--ink-bg` | `#14161a` | the dark Toolkit band |
| `--focus` / `--focus-dark` | `#1d4ed8` / `#a8c0fa` | focus rings, light and dark |

Change `--accent` in one place to rebrand the site.

### Type

**One text family.** Headings use the body face rather than a contrasting
display serif: **Inter** for everything, plus **IBM Plex Mono** for labels,
metadata and the drafting-sheet details.

Inter sets appreciably wider and lighter than a display serif at the same point
size, so headings carry weight and negative tracking to compensate. Both are
tokens, so the whole heading scale moves together:

| Token | Value | Applies to |
|---|---|---|
| `--w-display` | `600` | hero headline, section `h2`, contact title |
| `--w-head` | `600` | job titles, case titles, education, lightbox title |
| `--track-display` | `-0.035em` | display sizes |
| `--track-head` | `-0.025em` | heading sizes |

`--t-display` is deliberately a notch smaller than it was under the serif, so
the headline clears the hero canvas on the right. If you change the display
weight or family, re-check that the longest headline line still clears it.

Accent words inside headings (`<em>`) are the same face in italic, in
`--accent`. The active section-rail item is italic for the same reason.

## Third-party dependencies

Loaded from jsDelivr at pinned versions, roughly 60 KB gzipped in total:

- **GSAP 3.13 and ScrollTrigger**: headline reveal, section entrances, timeline
  draw, image parallax, accordion height animation
- **Lenis 1.3**: smooth momentum scrolling

All four scripts use `defer`, so parsing is never blocked. Classic deferred
scripts execute in document order, so ScrollTrigger still sees `gsap` and
`main.js` still sees both.

### Optional hardening: self-hosting

Self-hosting removes the third-party origins entirely and lets the CSP tighten to
`script-src 'self'`. It is not done here because no vendor files are currently
committed, and inventing them (or their integrity hashes) would be worse than
the dependency. If you want to do it:

1. Download `gsap.min.js`, `ScrollTrigger.min.js` and `lenis.min.js` at the
   versions pinned in `index.html`.
2. Put them in `assets/vendor/`.
3. Change the four `<script>` tags to local paths, keeping the same order.
4. Tighten `script-src` per `docs/security-headers.md`.

The same applies to the fonts: self-host the WOFF2 files and both Google origins
disappear from the policy.

## Accessibility behaviour

What is implemented:

- Skip link to `#main`, which carries `tabindex="-1"` so focus actually lands
- Focus rings via `:focus-visible`, with a lighter ring on the dark Toolkit band
  and inside the lightbox
- Experience accordion: the `<h3>` wraps the `<button>`, so the heading stays a
  heading and the button contains only phrasing content. Each trigger has an
  `id`, `aria-expanded` and `aria-controls`; each panel is a
  `role="region"` labelled by its trigger
- Collapsed panels are `inert` (with an `aria-hidden` fallback where `inert` is
  unsupported), so they are neither focusable nor exposed to assistive tech
- Lightbox uses native `<dialog>` with `aria-labelledby` and `aria-describedby`,
  a polite live region for the image count, alt text that changes per image, and
  navigation buttons that hide for single-image galleries
- The active section-rail item is marked by italic, weight and a filled marker,
  not by colour alone
- In-page links move focus to the destination, not just the scroll position
- Section anchors clear the fixed header via `scroll-margin-top`

Measured contrast ratios against the actual painted backgrounds (see "Tests"
below). The lowest measured pair is 5.17:1, above the 4.5:1 AA threshold for
body text. This was measured programmatically, not audited by hand: run axe or
Lighthouse before publishing.

## Reduced motion

`prefers-reduced-motion: reduce` disables animation durations, the hero canvas
(`display: none`), the scroll cue, Lenis smooth scrolling, and all entrance
animation. Content is shown in its final state immediately.

## JavaScript fallback behaviour

The site never hides content and then relies on JavaScript to reveal it.

- **No JavaScript at all**: every experience panel stays open and readable,
  because `.job-detail` is expanded in CSS and only collapsed by script. All
  copy, images and links work. The lightbox and accordion are inert, and cards
  simply do not open.
- **CDN fails or is blocked**: `main.js` feature-detects `gsap`, `ScrollTrigger`
  and `Lenis` independently. If any is missing it adds `html.no-gsap`, which
  forces every `[data-reveal]` element visible. The accordion and lightbox both
  keep working without GSAP.
- **Reveals are only hidden once both `gsap` and `ScrollTrigger` are confirmed
  present.** A half-loaded CDN cannot leave content invisible.

## Performance notes

- Thumbnails load with the page; full-size images load only when a lightbox opens
- Every `<img>` has explicit `width`/`height`, `loading="lazy"` below the fold
  and `decoding="async"`
- Hero canvas caps device pixel ratio at 1.5, throttles resize to one frame,
  and stops its animation loop outright when the hero leaves the viewport, when
  the tab is backgrounded, or when CSS hides the canvas on phones

Deliberately **not** done, with reasons:

- **No `srcset`.** The 900 px thumbnails already cover a 2x display at the card
  sizes used. Pointing `srcset` at the 1600 px lightbox originals would roughly
  triple the payload for no visible gain.
- **No image preload or `fetchpriority="high"`.** Largest Contentful Paint was
  measured at 196 ms on a `<span class="line">` inside the hero headline, which
  is text. There is no LCP image to prioritise.
- **No `content-visibility: auto`.** It changes when off-screen sections are
  laid out, which is exactly what ScrollTrigger measures against. Not worth the
  risk on a page this size.

Re-measure on the production host before acting on any of the above.

## Editing the Toolkit

The Toolkit has no proficiency percentages. Numeric self-ratings implied a
precision that nothing supports, so each entry now carries the context in which
the tool is actually used.

Each group is a `<section class="tool-group">` containing a `<dl>`: `<dt>` is the
tool, `<dd>` is the context. Add a tool by adding a `dt`/`dd` pair. Add a group
by copying a whole `section`; the grid is four columns at `min-width: 1060px`.

Keep the `<dd>` line to a short, factual capability description. Avoid anything
that reads as a rating.

## Editing the case studies

The three cards under "Design Technology in practice" live in
`<div class="cases">` inside the Work section. Each is an `<article class="case">`
with an eyebrow label, an `<h4>`, and a `<dl class="case-dl">` following a
Problem, Control, Decision, Artefact, Outcome shape. Not every card uses every
term: use only the ones that are true for that case.

**Do not add quantified outcomes** (savings, percentages, time reduction, ROI)
unless you can substantiate them. The current copy is limited to facts confirmed
by Nikko.

## Editing a project card

Each card is one `<article class="proj-card">`. The gallery is a JSON array in
`data-gallery`, where `src` is a filename stem in `assets/img/projects/` and
`cap` is the lightbox caption. `src` must match `^[a-z0-9][a-z0-9-]{0,63}$`; the
script rejects anything else, so path traversal cannot be introduced by editing
a data attribute.

Card media height is driven by the image's own proportions, capped by
`max-height` in CSS. There are no per-card aspect-ratio values to maintain and
no inline styles.

To add an image:

```bash
python - <<'PY'
from PIL import Image
im = Image.open(r"path\to\source.jpg").convert("RGB")
full = im.copy(); full.thumbnail((1600,1600), Image.LANCZOS)
full.save(r"assets\img\projects\my-slug.webp", "WEBP", quality=80, method=6)
th = im.copy(); th.thumbnail((900,900), Image.LANCZOS)
th.save(r"assets\img\thumbs\my-slug.webp", "WEBP", quality=76, method=6)
print(th.size)   # use these numbers for width/height on the <img>
PY
```

## Repository checker

```bash
python scripts/check_site.py
```

Standard library only. It checks that referenced local files exist, ids are
unique, internal anchors and ARIA references resolve, `<use>` targets exist,
`data-gallery` JSON is valid and its images are present, images have `alt`,
`width` and `height`, no placeholder URLs remain, no inline styles have crept
back in, accordion triggers are wired correctly, date ranges use en dashes, and
no em dashes (literal or as an HTML entity) remain in visible content.

It exits non-zero on any error. It is a consistency checker, **not** a
replacement for the Nu HTML Checker, Lighthouse, axe, browser testing, keyboard
testing or visual regression testing.

## Security headers

See [docs/security-headers.md](docs/security-headers.md) for a Content Security
Policy that was tested against this exact site, plus per-host configuration for
Netlify, Cloudflare Pages and Vercel, and an explanation of why GitHub Pages
cannot do it at all.

## Deploying

Static, so any of these work with no build configuration:

- **Netlify** or **Cloudflare Pages**: drag the folder in, add `_headers`
- **Vercel**: connect the repo, leave the build command empty, add `vercel.json`
- **GitHub Pages**: push and enable Pages on the branch root, but note it cannot
  send security headers

---

# Production checklist

Work through this before the site goes public.

## Content and identity

- [ ] **Production domain** chosen
- [ ] **Canonical URL** added (`<link rel="canonical">`, TODO comment in `<head>`)
- [ ] **`og:url`** added (TODO comment in `<head>`)
- [ ] **`og:image` and `twitter:image` made absolute.** They are currently
      relative paths. Most social scrapers will not resolve those
- [ ] **Social preview verified** in the LinkedIn Post Inspector and X Card
      Validator
- [ ] **LinkedIn URL verified.** `linkedin.com/in/nikkosudirman` is an
      assumption, not a confirmed profile. Fix the `href` and the visible text,
      or remove the link. There is a TODO comment beside it
- [ ] **Resume PDF** filename, contents and date are current
- [ ] **`_source/` excluded from the deploy** (39 MB of unused originals)

## Project material

- [ ] **Image assignments verified.** Several source filenames did not name their
      project. Confidence is recorded in a comment above the project grid:
      - High: `pitt-st-*`, `sussex-*`, `ivanhoe-tower`, `neura-*`
      - Medium: `metro-platform`, `metro-concourse`
      - **Low, please check**: `denison-tower` (from `shot02-hero-night2.jpg`)
      - **Low, please check**: `owl-*` and `canopy-hero` (from `OWL_*` and
        `HEROSHOT copy.jpg`)
- [ ] **Consider promoting the confirmed Denison render.** The third headline
      chip is cut from `1 Denison_Cover Page.pdf`, which names its project in
      the filename. That makes it a confirmed 1 Denison Street image, unlike the
      current card hero. Swapping it in would close out the low-confidence
      assignment above. Not done automatically, because it was not asked for
- [ ] **Publication rights confirmed.** These renders and models were produced
      at Bates Smart, Cox Architecture and on secondment to Allen Jack+Cottier.
      The copyright is very likely the practice's or the client's, not Nikko's.
      Confirm you may publish each one
- [ ] **Attribution correct** on every card: practice, role, dates, project stage
- [ ] **Confidentiality review** completed (see below)

## Technical

- [ ] `python scripts/check_site.py` passes
- [ ] HTML validated at <https://validator.w3.org/nu/>
- [ ] Lighthouse run on the production host (performance, accessibility, SEO)
- [ ] axe DevTools run with no serious or critical issues
- [ ] Keyboard-only pass: tab through the whole page, open and close the
      lightbox, expand and collapse accordion panels, use the skip link
- [ ] Focus restoration checked after closing the lightbox
- [ ] Screen reader spot check (NVDA or VoiceOver) on the accordion and lightbox
- [ ] Reduced-motion mode checked in the OS settings
- [ ] JavaScript disabled: confirm all experience content is readable
- [ ] Mobile layouts checked on a real device, not only an emulator
- [ ] Browser console clean, with no errors
- [ ] Security headers deployed and verified with `curl -I`

---

# Confidentiality checklist

Architectural portfolios leak client information more often than people expect.
Remove or redact before publishing:

- Client-confidential design material and unreleased projects
- Screenshots of internal dashboards, CDEs or coordination platforms
- ACC, BIM 360, Revizto or Aconex user names, avatars and account names
- Issue registers, issue IDs, comment threads and markup history
- Project metadata: hub and project codes, model filenames, package names
- Consultant and contractor names attached to live coordination data
- Site coordinates and survey information
- Proprietary standards, templates and internal workflow documentation
- Anything covered by an NDA or a project deed

## Already actioned in this version

Two images were **removed** from the site during this revision because they
contained exactly the above:

- `pitt-st-acc.webp`: a BIM 360 Design Collaboration timeline showing the
  contractor account name, the project hub name, the full consultant list and
  package sharing dates
- `pitt-st-revizto.webp`: a Revizto issue tracker showing a live issue register
  with named third parties, issue IDs, statuses, chat content and the federated
  model filename

Both files were excluded from this folder rather than merely unlinked. They
still exist in the previous version's `assets/img/` directories. **Delete them
there too if that folder is ever published or pushed to a public repository.**

Two descriptions were also softened: an internal staffing breakdown per studio,
and a reference to an offshore documentation arrangement by country.
