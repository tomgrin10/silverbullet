# RTL Markdown editing

This branch extends SilverBullet 2.10.0 with automatic paragraph direction for
Hebrew, Arabic, and English, while keeping code and YAML left-to-right.
CodeMirror receives matching direction and isolation metadata for cursor
movement and selection. Lists use logical indentation, rendered table cells
choose their own direction, and prose uses self-hosted Heebo fonts.

The source changes live in `client/codemirror/bidi.ts`,
`client/text_direction.ts`, and `client/styles/rtl.scss`. The surrounding
integration is intentionally small. Notes stay ordinary Markdown; the editor
does not insert direction-control characters or rewrite note metadata.

Build with `npm ci` and `npm run build`, then run `npm run check`. Targeted tests:

```bash
npx vitest run client/codemirror/bidi.test.ts client/codemirror/list_indent.test.ts client/codemirror/markdown_enter.test.ts client/markdown_renderer/markdown_render.test.ts
```

The [deployment package](../deploy/rtl/README.md) builds this same frontend
patch against the pinned upstream release and places it in front of the
unmodified 2.10.0 backend. It includes a generic Compose example and a
browser regression suite with synthetic fixtures. It contains no personal
vault content, credentials, or screenshots from a real vault.
