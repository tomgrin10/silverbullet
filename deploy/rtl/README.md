# SilverBullet RTL editor

This builds a patched SilverBullet 2.10.0 frontend, pinned to upstream source
`2b2a7c719bb3546df8c78ddeaf95256535ee2dd3` and its npm lockfile. It runs in
front of the matching, unchanged SilverBullet backend. The frontend container
has no vault mount: file reads, writes, authentication, and synchronization
continue through SilverBullet's own API.

The editor enables CodeMirror's per-line direction handling and computes
direction from Markdown paragraphs. Hebrew and Arabic use RTL; English uses
LTR. Mixed prose beginning with an English name uses RTL when at least a
quarter of its letters are Hebrew or Arabic. Links and inline code do not
skew detection. Soft lines share their paragraph's direction, and blank lines
inherit the previous paragraph. Code fences and YAML remain LTR.

Lists use logical indentation. Inline code, URLs, and link labels are isolated
in both the DOM and CodeMirror's cursor model. Rendered tables take their
column order from the header and determine each cell's direction separately.
Optional `direction: rtl` or `direction: ltr` frontmatter overrides prose
direction while leaving code LTR. No direction-control characters or metadata
are inserted into notes automatically.

Heebo's Hebrew and Latin font subsets are self-hosted; code retains the
upstream monospace font. Their SIL Open Font License is included in
`fonts/OFL.txt`. The upstream application remains MIT licensed.

## Running on the Lenovo

From `/srv/personal-pi/deploy`:

```bash
docker compose build silverbullet-ui
docker compose config --quiet
docker compose up -d --no-deps --wait silverbullet-ui
tailscale serve --bg --https=9445 http://127.0.0.1:3005
```

The existing editor URL and Quartz Edit links continue to work. The frontend
binds only to loopback port 3005; the original backend stays on loopback port
3000 for rollback. Both are private to Tailscale when accessed through Serve.
Existing tabs need a reload after the updated service worker activates.

Rollback changes only the editor route:

```bash
tailscale serve --bg --https=9445 http://127.0.0.1:3000
docker compose stop silverbullet-ui
```

## Verification

The image build type-checks the frontend and runs targeted tests for bidi
classification, metadata/code exclusions, table direction, paragraph
continuations, language changes, list indentation, Markdown Enter behavior,
and the existing Markdown renderer.

`verify.mjs` drives Chromium, Firefox, and WebKit at 320, 390, 768, and 1280px.
It checks directional layout and CodeMirror's cursor model, list wrapping,
table column and cell directions, horizontal containment, local fonts, arrow
keys, selection, deletion, undo, typing, disk saves, and reloads. The 390px
Chromium contexts emulate Android touch; Firefox and WebKit verify layout and
desktop input. These are browser-engine tests, not a
physical Android keyboard test.

Run only against a disposable SilverBullet instance containing
`fixtures/RTL-QA.md`; the script verifies its fixture marker before editing.
Build `Dockerfile.qa`, mount a private screenshot directory writable by UID
1001, and set `EDITOR_URL` to that instance's frontend proxy. Screenshots stay
local and contain only synthetic fixture data.

The Nginx proxy serves the patched `/.client/*` assets and service worker;
dynamic manifest, page HTML, and all API routes go to the backend. Upgrades
must keep the frontend source and backend release aligned. Patch application
fails when expected upstream source changes rather than modifying an
unrecognized version silently.
