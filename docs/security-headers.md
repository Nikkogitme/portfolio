# Security headers

This site is static, so headers must come from the host. No deployment platform
is configured in this repository yet, so nothing here is wired up automatically.
Copy the block for whichever host you choose.

## Content Security Policy

The policy below matches the site as it is actually built today: self-hosted CSS
and JS, GSAP and Lenis from jsDelivr, Google Fonts, a `data:` favicon, and an
inline JSON-LD block.

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' https://cdn.jsdelivr.net;
  style-src 'self' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com;
  img-src 'self' data:;
  media-src 'self';
  frame-src 'self';
  connect-src 'self';
  base-uri 'none';
  form-action 'none';
  frame-ancestors 'none';
  object-src 'none'
```

### What was tested

This policy was served from a local test server and the page loaded under it in
headless Chrome (Chrome 141, 2026-08-05). The run recorded **zero
`securitypolicyviolation` events** while exercising:

- initial load, fonts, GSAP, ScrollTrigger and Lenis
- hero canvas animation
- opening the lightbox, stepping images, closing with Escape
- expanding an experience accordion panel
- scrolling to the bottom of the page

Two points worth understanding, both confirmed in that run:

- **`style-src` does not need `'unsafe-inline'`.** GSAP animates through the
  CSSOM (`element.style.property = value`), which CSP does not treat as an
  inline style. The markup contains no `style` attributes, so nothing else
  needs it either. If you add an inline `style="..."` attribute later, this
  policy will block it. `scripts/check_site.py` warns when you do.
- **`media-src 'self'` is required by the sample viewer**, for the DT Insite
  Hub recording. The Phase 30 BIM Brief needs nothing extra: it renders as
  page images under the existing `img-src 'self'`, not through an `<iframe>`.
  An embedded PDF was tried first and abandoned, because Chrome, Edge and
  Firefox all let a visitor set PDFs to download rather than display, and
  those visitors get a download prompt in place of the document.
  `frame-src 'self'` is kept only for the viewer's unused iframe path.

  Embedding the recording from OneDrive was tried and does not work:
  `onedrive.live.com` responds with `frame-ancestors 'self'`, so the browser
  refuses it inside any other site's frame regardless of what `frame-src`
  allows. Only a Share → Embed URL is exempt, and that option is not reliably
  offered for video. Self-hosting sidesteps it.
- **`script-src` does not need `'unsafe-inline'`.** The only inline `<script>`
  is `type="application/ld+json"`, which is a data block rather than executable
  script. Browsers do not execute it, so `script-src` does not apply to it.

Retest after any change to the third-party libraries, the fonts, or the way
styles are applied. Deploy in report-only mode first if you want a safety net:

```
Content-Security-Policy-Report-Only: <same policy>
```

### If you self-host the libraries

Self-hosting GSAP and Lenis (see the README) removes the jsDelivr dependency and
lets the policy tighten to:

```
script-src 'self';
```

Self-hosting the fonts as well removes both Google hosts:

```
style-src 'self';
font-src 'self';
```

## Other headers

```
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

`Cross-Origin-Opener-Policy: same-origin` is deliberately **not** recommended
here. It buys nothing for a static page with no cross-origin popups or shared
memory, and it would need revisiting if an embedded viewer, OAuth popup or
analytics iframe is ever added. Leave it off until there is a reason.

`X-Frame-Options` is superseded by `frame-ancestors 'none'` above. Add it only
if you must support a very old browser.

## Netlify

Create `_headers` in the publish directory:

```
/*
  Content-Security-Policy: default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Cloudflare Pages

Cloudflare Pages reads the same `_headers` file as Netlify, so the block above
works unchanged. Alternatively use a Transform Rule under
**Rules → Transform Rules → Modify Response Header**.

## Vercel

Add to `vercel.json` at the repository root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

Only create this file if you are actually deploying to Vercel. Do not commit
config for three platforms at once.

## GitHub Pages

**GitHub Pages cannot set custom response headers.** There is no configuration
file, no plugin and no workaround. It sends its own fixed set and nothing else.

If headers matter to you, the options are:

1. Deploy to Netlify, Cloudflare Pages or Vercel instead. All three are free for
   a site this size and all three support the blocks above.
2. Keep GitHub Pages and put Cloudflare in front of it as a proxy, then add the
   headers as a Cloudflare Transform Rule.
3. Accept the gap. For a public portfolio with no authentication, no forms and
   no user data, the practical risk is low. The main thing lost is
   `frame-ancestors`, which prevents the page being framed by someone else.

A `<meta http-equiv="Content-Security-Policy">` tag is a partial substitute, but
it cannot express `frame-ancestors`, and it applies too late to protect anything
the parser has already started. It is not currently used on this site.

## Verifying a deployment

```bash
curl -sI https://YOUR-DOMAIN/ | grep -i -E 'content-security|referrer|x-content-type|permissions'
```

Then load the site and check the browser console. A working policy produces no
`Refused to load` or `Refused to apply` messages. <https://securityheaders.com>
gives a quick external grade.
