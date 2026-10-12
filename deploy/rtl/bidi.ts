import {
  type EditorState,
  type Extension,
  type Range,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  Direction,
  EditorView,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { proseDirection, type TextDirection } from "../text_direction.ts";

type Directions = {
  lines: DecorationSet;
  isolates: DecorationSet;
  composing: boolean;
};

export function markdownLineDirections(state: EditorState): TextDirection[] {
  const overrides = new Map<
    number,
    { direction: TextDirection; priority: number }
  >();
  let forced: TextDirection | undefined;
  const tree = syntaxTree(state);
  tree.iterate({
    enter: ({ name, from, to }) => {
      if (name === "FrontMatter") {
        const directive = state
          .sliceDoc(from, to)
          .match(/^direction\s*:\s*(rtl|ltr)\s*$/m);
        if (directive) forced = directive[1] as TextDirection;
      }
    },
  });
  const fallback = forced ?? proseDirection(state.doc.toString(), "rtl");
  tree.iterate({
    enter: ({ name, from, to, node }) => {
      const code = ["FencedCode", "CodeBlock", "FrontMatter"].includes(name);
      const table = name === "Table";
      const paragraph =
        name === "Paragraph" || /^(?:ATX|Setext)Heading/.test(name);
      if (!code && !table && !paragraph) return;
      const header = table ? node.getChild("TableHeader") : null;
      const direction = code
        ? "ltr"
        : (forced ??
          proseDirection(
            state.sliceDoc(header?.from ?? from, header?.to ?? to),
            fallback,
          ));
      const priority = code ? 3 : table ? 2 : 1;
      const last = state.doc.lineAt(Math.max(from, to - 1)).number;
      for (
        let number = state.doc.lineAt(from).number;
        number <= last;
        number++
      ) {
        if ((overrides.get(number)?.priority ?? 0) <= priority)
          overrides.set(number, { direction, priority });
      }
      if (code) return false;
    },
  });
  const directions: TextDirection[] = [];
  let previous = fallback;
  for (let number = 1; number <= state.doc.lines; number++) {
    const line = state.doc.line(number);
    const override = overrides.get(number);
    const direction =
      override?.direction ?? forced ?? proseDirection(line.text, previous);
    directions.push(direction);
    previous = override?.priority === 3 ? fallback : direction;
  }
  return directions;
}

function buildDirections(state: EditorState): Directions {
  const lines: Range<Decoration>[] = [];
  const isolates: Range<Decoration>[] = [];
  const directions = markdownLineDirections(state);
  for (let number = 1; number <= state.doc.lines; number++) {
    lines.push(
      Decoration.line({ attributes: { dir: directions[number - 1] } }).range(
        state.doc.line(number).from,
      ),
    );
  }
  syntaxTree(state).iterate({
    enter: ({ name, from, to }) => {
      if (["FencedCode", "CodeBlock", "FrontMatter"].includes(name))
        return false;
      if (
        ["InlineCode", "NakedURL", "URL", "HTMLTag"].includes(name) &&
        to > from
      ) {
        isolates.push(
          Decoration.mark({
            class: "sb-bidi-isolate",
            attributes: { dir: "ltr" },
            bidiIsolate: Direction.LTR,
          }).range(from, to),
        );
        return false;
      }
      if (name === "Link") {
        const label = state.sliceDoc(from, to).match(/^\[([^\]]+)\]\(/);
        if (label)
          isolates.push(
            Decoration.mark({
              class: "sb-bidi-isolate",
              attributes: { dir: "auto" },
            }).range(from + 1, from + 1 + label[1].length),
          );
      }
    },
  });
  const isolated = Decoration.set(isolates, true);
  return {
    lines: Decoration.set([...lines, ...isolates], true),
    isolates: isolated,
    composing: false,
  };
}

const directions = StateField.define<Directions>({
  create: buildDirections,
  update(value, transaction) {
    if (transaction.isUserEvent("input.type.compose"))
      return {
        lines: value.lines.map(transaction.changes),
        isolates: value.isolates.map(transaction.changes),
        composing: true,
      };
    return transaction.docChanged ||
      value.composing ||
      syntaxTree(transaction.startState) !== syntaxTree(transaction.state)
      ? buildDirections(transaction.state)
      : value;
  },
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.lines),
    EditorView.bidiIsolatedRanges.from(field, (value) => value.isolates),
  ],
});

export function bidirectionalMarkdown(): Extension {
  return [EditorView.perLineTextDirection.of(true), directions];
}
