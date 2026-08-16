#!/usr/bin/env python3
"""
Repository consistency checker for the portfolio.

This is NOT an HTML validator and NOT an accessibility or performance audit.
It catches the mistakes that are easy to make while editing content by hand:
broken local paths, duplicate ids, dead anchors, malformed gallery JSON,
missing image attributes and stray em dashes.

Still run, separately and in a browser:
  - Nu HTML Checker      https://validator.w3.org/nu/
  - Lighthouse           (Chrome DevTools)
  - axe DevTools         (accessibility)
  - Manual keyboard and screen-reader testing

Usage:
    python scripts/check_site.py            # check, exit 1 on failures
    python scripts/check_site.py --quiet    # only print problems

Standard library only. No dependencies.
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")

# Files that must exist for the site to be publishable.
REQUIRED = [
    "index.html",
    "assets/css/style.css",
    "assets/js/main.js",
    "assets/docs/Nikko-Sudirman-Resume-2026.pdf",
]

# Files whose absence is a warning, not a failure.
EXPECTED = [
    "assets/img/og-cover.webp",
]

# References the page is designed to survive without.
OPTIONAL_REFS: set[str] = set()

# Icon symbols swapped in only via JS (main.js sets the <use> href at
# runtime), so a static scan of the markup never finds a matching <use>.
DYNAMIC_ONLY_SYMBOLS = {"ic-compress"}

# Placeholder domains that must never ship.
PLACEHOLDER_URLS = [
    "your-domain.com",
    "example.com",
    "yourdomain",
    "localhost:5173",
    "TODO_URL",
]

EM_DASH = "—"


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.notes: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def note(self, msg: str) -> None:
        self.notes.append(msg)


def strip_comments(markup: str) -> str:
    """Remove HTML comments so TODO notes and code samples are not scanned."""
    return re.sub(r"<!--.*?-->", "", markup, flags=re.S)


def visible_text(markup: str) -> str:
    """Rough plain-text view of the page: no comments, scripts, styles or tags."""
    text = strip_comments(markup)
    text = re.sub(r"<script\b.*?</script>", "", text, flags=re.S | re.I)
    text = re.sub(r"<style\b.*?</style>", "", text, flags=re.S | re.I)
    text = re.sub(r"<svg\b.*?</svg>", "", text, flags=re.S | re.I)
    return re.sub(r"<[^>]+>", " ", text)


def check_required_files(rep: Report) -> None:
    for rel in REQUIRED:
        if not os.path.isfile(os.path.join(ROOT, rel)):
            rep.error(f"Required file is missing: {rel}")
    for rel in EXPECTED:
        if not os.path.isfile(os.path.join(ROOT, rel)):
            rep.warn(f"Expected file is missing: {rel}")


def check_local_assets(rep: Report, markup: str) -> None:
    """Every local src/href referenced in the page must exist on disk."""
    refs = re.findall(r'(?:src|href)\s*=\s*"([^"]+)"', strip_comments(markup))
    seen = set()
    for ref in refs:
        if ref.startswith(("http://", "https://", "//", "#", "data:", "mailto:", "tel:")):
            continue
        path = ref.split("?", 1)[0].split("#", 1)[0]
        if not path or path in seen:
            continue
        seen.add(path)
        if not os.path.isfile(os.path.join(ROOT, path)):
            if path in OPTIONAL_REFS:
                rep.warn(f"Optional referenced file is absent (fallback applies): {path}")
            else:
                rep.error(f"Referenced local file does not exist: {path}")


def check_duplicate_ids(rep: Report, markup: str) -> None:
    ids = re.findall(r'\sid\s*=\s*"([^"]+)"', strip_comments(markup))
    for value, count in Counter(ids).items():
        if count > 1:
            rep.error(f'Duplicate id="{value}" appears {count} times')


def check_anchor_targets(rep: Report, markup: str) -> None:
    clean = strip_comments(markup)
    ids = set(re.findall(r'\sid\s*=\s*"([^"]+)"', clean))
    for href in set(re.findall(r'href\s*=\s*"#([^"]+)"', clean)):
        if href not in ids:
            rep.error(f'Internal anchor href="#{href}" has no matching id')


def check_aria_references(rep: Report, markup: str) -> None:
    """aria-controls / aria-labelledby / aria-describedby must resolve."""
    clean = strip_comments(markup)
    ids = set(re.findall(r'\sid\s*=\s*"([^"]+)"', clean))
    for attr in ("aria-controls", "aria-labelledby", "aria-describedby"):
        for value in re.findall(attr + r'\s*=\s*"([^"]+)"', clean):
            for token in value.split():
                if token not in ids:
                    rep.error(f'{attr}="{token}" points at an id that does not exist')


def check_svg_use(rep: Report, markup: str) -> None:
    symbols = set(re.findall(r'<symbol\s+id\s*=\s*"([^"]+)"', markup))
    for ref in set(re.findall(r'<use\s+href\s*=\s*"#([^"]+)"', markup)):
        if ref not in symbols:
            rep.error(f'<use href="#{ref}"> has no matching <symbol>')
    used = set(re.findall(r'<use\s+href\s*=\s*"#([^"]+)"', markup))
    for unused in sorted(symbols - used - DYNAMIC_ONLY_SYMBOLS):
        rep.note(f"Icon symbol #{unused} is defined but never used")


def check_galleries(rep: Report, markup: str) -> None:
    """data-gallery must be valid JSON, and every image it names must exist."""
    slug = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
    blocks = re.findall(r'data-gallery\s*=\s*"([^"]*)"', markup)
    if not blocks:
        rep.warn("No data-gallery attributes found")
    for raw in blocks:
        decoded = html.unescape(raw)
        try:
            data = json.loads(decoded)
        except json.JSONDecodeError as err:
            rep.error(f"data-gallery is not valid JSON: {err}")
            continue
        if not isinstance(data, list) or not data:
            rep.error("data-gallery must be a non-empty array")
            continue
        for item in data:
            if not isinstance(item, dict) or "src" not in item:
                rep.error(f"data-gallery entry is missing a src: {item!r}")
                continue
            src = item["src"]
            if not isinstance(src, str) or not slug.match(src):
                rep.error(f"data-gallery src is not a safe slug: {src!r}")
                continue
            full = os.path.join(ROOT, "assets", "img", "projects", src + ".webp")
            if not os.path.isfile(full):
                rep.error(f"Gallery image is missing: assets/img/projects/{src}.webp")
            if not item.get("cap"):
                rep.warn(f"Gallery entry '{src}' has no caption")


def check_images(rep: Report, markup: str) -> None:
    """Every <img> needs alt, width and height."""
    for tag in re.findall(r"<img\b[^>]*>", strip_comments(markup)):
        src = re.search(r'src\s*=\s*"([^"]*)"', tag)
        label = src.group(1) if src else tag[:60]
        if 'alt="' not in tag and "alt='" not in tag:
            rep.error(f"<img> has no alt attribute: {label}")
        if "width=" not in tag or "height=" not in tag:
            # dynamic images (the lightbox and document-viewer stages) are sized by CSS
            if 'id="lbImg"' not in tag and 'id="viewerPageImg"' not in tag:
                rep.error(f"<img> is missing width/height: {label}")


def check_placeholders(rep: Report, markup: str) -> None:
    clean = strip_comments(markup)
    for needle in PLACEHOLDER_URLS:
        if needle in clean:
            rep.error(f"Placeholder URL left in active markup: {needle}")


def check_em_dashes(rep: Report) -> None:
    """No em dashes or &mdash; in user-visible content, anywhere in the repo."""
    targets = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", ".claude"}]
        for name in files:
            if name.endswith((".html", ".md", ".js", ".css")):
                targets.append(os.path.join(base, name))

    for path in sorted(targets):
        rel = os.path.relpath(path, ROOT).replace("\\", "/")
        try:
            text = open(path, encoding="utf-8").read()
        except (OSError, UnicodeDecodeError):
            continue

        if rel.endswith(".html"):
            scan = strip_comments(text)
        elif rel.endswith((".js", ".css")):
            # comments in code are allowed to keep em dashes
            scan = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
            scan = re.sub(r"(?m)^\s*//.*$", "", scan)
        else:
            scan = text

        for num, line in enumerate(scan.splitlines(), 1):
            if EM_DASH in line:
                rep.error(f"{rel}:{num} contains an em dash: {line.strip()[:80]}")
            if "&mdash;" in line:
                rep.error(f"{rel}:{num} contains &mdash;: {line.strip()[:80]}")


def check_date_ranges(rep: Report, markup: str) -> None:
    """Date ranges should use an en dash, not a hyphen."""
    text = visible_text(markup)
    months = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*"
    for bad in re.findall(rf"{months}\s+\d{{4}}\s*-\s*(?:{months}\s+)?\d{{4}}", text):
        rep.warn(f"Date range uses a hyphen, prefer an en dash: {bad.strip()}")
    for bad in re.findall(r"(?<!\d)\d{4}\s*-\s*\d{4}(?!\d)", text):
        rep.warn(f"Year range uses a hyphen, prefer an en dash: {bad.strip()}")


def check_inline_styles(rep: Report, markup: str) -> None:
    """Inline style attributes force 'unsafe-inline' into style-src."""
    found = re.findall(r'<[^>]+\sstyle\s*=\s*"[^"]*"', strip_comments(markup))
    for tag in found:
        rep.warn(f"Inline style attribute (weakens CSP style-src): {tag[:70]}")


def check_accordion(rep: Report, markup: str) -> None:
    """Each accordion trigger needs an id, aria-expanded and a real panel."""
    triggers = re.findall(r"<button[^>]*class=\"job-head\"[^>]*>", markup)
    if not triggers:
        rep.warn("No accordion triggers found")
    for tag in triggers:
        if "aria-expanded" not in tag:
            rep.error(f"Accordion trigger has no aria-expanded: {tag[:70]}")
        if "aria-controls" not in tag:
            rep.error(f"Accordion trigger has no aria-controls: {tag[:70]}")
        if "id=" not in tag:
            rep.error(f"Accordion trigger has no id to label its panel: {tag[:70]}")
        if "type=" not in tag:
            rep.error(f"Accordion trigger has no type attribute: {tag[:70]}")


def main() -> int:
    quiet = "--quiet" in sys.argv
    rep = Report()

    if not os.path.isfile(PAGE):
        print("FAIL  index.html not found at " + PAGE)
        return 1
    markup = open(PAGE, encoding="utf-8").read()

    check_required_files(rep)
    check_local_assets(rep, markup)
    check_duplicate_ids(rep, markup)
    check_anchor_targets(rep, markup)
    check_aria_references(rep, markup)
    check_svg_use(rep, markup)
    check_galleries(rep, markup)
    check_images(rep, markup)
    check_placeholders(rep, markup)
    check_inline_styles(rep, markup)
    check_accordion(rep, markup)
    check_date_ranges(rep, markup)
    check_em_dashes(rep)

    for msg in rep.errors:
        print("FAIL  " + msg)
    for msg in rep.warnings:
        print("WARN  " + msg)
    if not quiet:
        for msg in rep.notes:
            print("NOTE  " + msg)

    print(
        "\n%d error(s), %d warning(s), %d note(s)"
        % (len(rep.errors), len(rep.warnings), len(rep.notes))
    )
    print("Reminder: this checker does not replace HTML validation, Lighthouse,")
    print("axe, browser testing, keyboard testing or visual regression testing.")
    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main())
