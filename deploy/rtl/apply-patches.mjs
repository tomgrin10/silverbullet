import fs from "node:fs";

function patch(file, before, after) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) throw new Error(`Upstream changed: ${file}`);
  fs.writeFileSync(file, source.replace(before, after));
}
patch("client/codemirror/editor_state.ts", 'import customMarkdownStyle', 'import { bidirectionalMarkdown } from "./bidi.ts";\nimport customMarkdownStyle');
patch("client/codemirror/editor_state.ts", '      EditorView.lineWrapping,', '      EditorView.lineWrapping,\n      bidirectionalMarkdown(),');
patch("client/codemirror/editor_state.ts", 'const distanceX = touch.clientX - view.coordsAtPos(pos)!.left;', 'const distanceX = Math.abs(touch.clientX - view.coordsAtPos(pos)!.left);');
patch("client/codemirror/editor_state.ts", 'const distanceX = event.x - view.coordsAtPos(pos)!.left;', 'const distanceX = Math.abs(event.x - view.coordsAtPos(pos)!.left);');
patch("client/codemirror/list_indent.ts", 'padding-left:${width}ch', 'padding-inline-start:${width}ch');
patch("client/codemirror/widget_util.ts", 'import type { Client } from "../client.ts";', 'import { applyRenderedDirections } from "../text_direction.ts";\nimport type { Client } from "../client.ts";');
patch("client/codemirror/widget_util.ts", '  if (!div.dataset.handlersAttached) {', '  applyRenderedDirections(div);\n  if (!div.dataset.handlersAttached) {');
const cssFile = "client/styles/editor.scss";
let css = fs.readFileSync(cssFile, "utf8");
for (const [before, after] of [
  ['padding-left: 3ch;', 'padding-inline-start: 3ch;'],
  ['padding-left: 1.7em;', 'padding-inline-start: 1.7em;'],
  ['margin-left: -1em;', 'margin-inline-start: -1em;'],
]) {
  if (!css.includes(before)) throw new Error(`Upstream style changed: ${before}`);
  css = css.replaceAll(before, after);
}
fs.writeFileSync(cssFile, css);
patch("client/styles/main.scss", '@use "editor";', '@use "editor";\n@use "rtl";');
