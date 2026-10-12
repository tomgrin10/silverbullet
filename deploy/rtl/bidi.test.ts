import { expect, test } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { extendedMarkdownLanguage } from "../markdown_parser/parser.ts";
import { proseDirection } from "../text_direction.ts";
import { markdownLineDirections, bidirectionalMarkdown } from "./bidi.ts";

function state(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      markdown({ base: extendedMarkdownLanguage }),
      bidirectionalMarkdown(),
    ],
  });
}

test("mixed Hebrew prose ignores link destinations and inline code", () => {
  expect(proseDirection("Gemini עוזר לתכנן טיול בעברית עם TLV")).toBe("rtl");
  expect(
    proseDirection(
      "[טיסה](https://example.com/a/very/long/english/destination) `longEnglishCode` הזמנה",
    ),
  ).toBe("rtl");
  expect(proseDirection("English paragraph with a flight to Edinburgh")).toBe(
    "ltr",
  );
  expect(proseDirection("مرحبا بالعالم")).toBe("rtl");
});

test("code and metadata stay LTR inside an RTL note", () => {
  const doc = [
    "---",
    "title: שלום",
    "---",
    "# טיול",
    "",
    "```js",
    'const a = "שלום";',
    "```",
    "",
    "שלום עולם",
  ].join("\n");
  const directions = markdownLineDirections(state(doc));
  expect(directions.slice(0, 3)).toEqual(["ltr", "ltr", "ltr"]);
  expect(directions[3]).toBe("rtl");
  expect(directions.slice(5, 8)).toEqual(["ltr", "ltr", "ltr"]);
  expect(directions[9]).toBe("rtl");
});

test("soft lines and blank continuation lines share paragraph direction", () => {
  expect(
    markdownLineDirections(state("שלום עולם\nFlight TLV to EDI\n\n")),
  ).toEqual(["rtl", "rtl", "rtl", "rtl"]);
  expect(markdownLineDirections(state("English paragraph\n\n"))).toEqual([
    "ltr",
    "ltr",
    "ltr",
  ]);
});

test("table direction follows the header, not each row's first cell", () => {
  expect(
    markdownLineDirections(
      state("| יעד | מחיר |\n| --- | --- |\n| London | £250 |"),
    ),
  ).toEqual(["rtl", "rtl", "rtl"]);
});

test("a frontmatter direction override leaves code LTR", () => {
  const directions = markdownLineDirections(
    state("---\ndirection: rtl\n---\nEnglish text\n\n```\nhello\n```"),
  );
  expect(directions[3]).toBe("rtl");
  expect(directions.slice(5)).toEqual(["ltr", "ltr", "ltr"]);
});

test("changing language recomputes direction without changing source", () => {
  const original = state("Hello world");
  const next = original.update({
    changes: { from: 0, to: original.doc.length, insert: "שלום עולם" },
  }).state;
  expect(markdownLineDirections(next)).toEqual(["rtl"]);
  expect(next.doc.toString()).toBe("שלום עולם");
});
