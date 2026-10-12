export type TextDirection = "rtl" | "ltr";

export function proseDirection(
  text: string,
  fallback: TextDirection = "ltr",
): TextDirection {
  const prose = text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`[^`]*`/g, "")
    .replace(/https?:\/\/\S+/g, "");
  const letters = [...prose.matchAll(/\p{L}/gu)].map((match) => match[0]);
  if (!letters.length) return fallback;
  const isRTL = (letter: string) =>
    /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u.test(letter);
  return isRTL(letters[0]) ||
    letters.filter(isRTL).length / letters.length >= 0.25
    ? "rtl"
    : "ltr";
}

export function applyRenderedDirections(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("table").forEach((table) => {
    if (!table.hasAttribute("dir"))
      table.dir = proseDirection(
        table.querySelector("thead")?.textContent ?? "",
      );
  });
  root
    .querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,p,span.p,li,blockquote,td,th",
    )
    .forEach((element) => {
      if (!element.hasAttribute("dir") && !element.closest("pre,code"))
        element.dir = proseDirection(element.textContent ?? "");
    });
  root.querySelectorAll<HTMLElement>("pre,code,tt").forEach((element) => {
    if (!element.hasAttribute("dir")) element.dir = "ltr";
  });
  root.querySelectorAll<HTMLElement>("a").forEach((element) => {
    if (!element.hasAttribute("dir")) element.dir = "auto";
  });
}
