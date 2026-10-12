import { chromium, firefox, webkit, devices } from "playwright-core";
import assert from "node:assert/strict";

const base = process.env.EDITOR_URL ?? "http://127.0.0.1:3003";
const engines = process.env.ENGINES?.split(",") ?? ["chromium", "firefox", "webkit"];
for (const engine of engines) {
  const browser = await ({chromium, firefox, webkit}[engine]).launch({headless: true});
  try {
    for (const width of [320, 390, 768, 1280]) {
      const android = width <= 768 && engine === "chromium";
      const context = await browser.newContext({viewport: {width, height:844}, hasTouch: android,
        isMobile: android, ...(android ? {userAgent:devices["Pixel 7"].userAgent} : {})});
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${base}/RTL-QA`, {waitUntil: "networkidle"});
      await page.waitForFunction(() => globalThis.client?.systemReady && client.editorView.state.doc.toString().includes("טיול"));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.querySelector("table[dir=rtl]"));
      const original = await page.evaluate(() => client.editorView.state.doc.toString());
      assert(original.startsWith("---\ntestFixture: silverbullet-rtl-qa\n---\n"), "Use a disposable vault containing the supplied QA fixture");
      const layout = await page.evaluate(() => {
        const view = client.editorView;
        const lines = [...document.querySelectorAll(".cm-line")].map(element => ({
          text: element.textContent, dir: getComputedStyle(element).direction,
          paddingStart: parseFloat(getComputedStyle(element).paddingInlineStart),
          paddingEnd: parseFloat(getComputedStyle(element).paddingInlineEnd),
          modelDirection: view.textDirectionAt(view.posAtDOM(element)),
        }));
        const cells = [...document.querySelectorAll("table td")].map(element => ({text:element.textContent,dir:element.dir}));
        const headers = [...document.querySelectorAll("table thead td")];
        return {width: innerWidth, documentWidth: document.documentElement.scrollWidth, lines, cells,
          firstHeaderLeft: headers[0].getBoundingClientRect().left,
          lastHeaderLeft: headers.at(-1).getBoundingClientRect().left,
          font: getComputedStyle(view.contentDOM).fontFamily,
        };
      });
      async function inspectLine(text, direction) {
        const position = text === "שלום עולם" ? original.lastIndexOf(text) : original.indexOf(text);
        assert(position >= 0);
        await page.evaluate(position => client.editorView.dispatch({selection:{anchor:position},scrollIntoView:true}), position);
        await page.waitForFunction(position => {
          const view = client.editorView;
          return [...document.querySelectorAll(".cm-line")].some(element => view.posAtDOM(element) === view.state.doc.lineAt(position).from);
        }, position);
        const evidence = await page.evaluate(position => {
          const view = client.editorView;
          const element = [...document.querySelectorAll(".cm-line")].find(element => view.posAtDOM(element) === view.state.doc.lineAt(position).from);
          const style = getComputedStyle(element);
          return {dir:style.direction,modelDirection:view.textDirectionAt(position),paddingStart:parseFloat(style.paddingInlineStart),paddingEnd:parseFloat(style.paddingInlineEnd)};
        }, position);
        assert.equal(evidence.dir, direction, `${engine} ${width}: ${text} has wrong direction`);
        assert.equal(evidence.modelDirection, direction === "rtl" ? 1 : 0, `${engine} ${width}: cursor model has wrong direction`);
        return evidence;
      }
      for (const text of ["טיול", "Gemini", "רשימה פנימית", "לקנות כרטיס", "مرحبا", "שלום עולם"]) await inspectLine(text, "rtl");
      await inspectLine("This is an English", "ltr");
      await inspectLine("const message", "ltr");
      const list = await inspectLine("לבדוק הזמנה", "rtl");
      assert(list.paddingStart > 0 && list.paddingEnd === 0);
      const quote = await inspectLine("הערה בעברית", "rtl");
      assert(quote.paddingStart > 0, "Quote text needs space inside its border");
      assert(layout.firstHeaderLeft > layout.lastHeaderLeft, "Table column order is not RTL");
      assert.equal(layout.cells.find(cell => cell.text === "London")?.dir, "ltr");
      assert.equal(layout.cells.find(cell => cell.text === "אדינבורו")?.dir, "rtl");
      assert(layout.documentWidth <= width + 1, `${engine} ${width}: page overflows`);
      assert(layout.font.includes("Heebo"));
      if ([390,1280].includes(width)) {
        await page.evaluate(() => client.editorView.dispatch({selection:{anchor:0},scrollIntoView:true}));
        await page.waitForFunction(() => client.editorView.scrollDOM.scrollTop < 30);
        await page.screenshot({path:`/screenshots/editor-${engine}-${width}.png`});
      }

      if (width === 390) {
        const start = original.lastIndexOf("שלום עולם");
        async function cursor(position) {
          await page.evaluate(position => {
            const view = client.editorView;
            view.dispatch({selection: {anchor:position}, scrollIntoView:true});
            view.focus();
          }, position);
        }
        await cursor(start + 2);
        if (engine === "chromium") {
          await page.waitForFunction(position => {
            const box = client.editorView.coordsAtPos(position);
            return box && box.top > 55 && box.bottom < innerHeight;
          }, start + 2);
          const point = await page.evaluate(() => {
            const view = client.editorView;
            const box = view.coordsAtPos(view.state.selection.main.head);
            return {x:box.left,y:(box.top+box.bottom)/2};
          });
          await page.evaluate(position => client.editorView.dispatch({selection:{anchor:position}}), start + 7);
          await page.touchscreen.tap(point.x, point.y);
          await page.waitForFunction(position => Math.abs(client.editorView.state.selection.main.head - position) <= 1,
            start + 2, {timeout:5000}).catch(async error => {
              console.log(JSON.stringify(await page.evaluate(({point,target}) => ({
                point,target,actual:client.editorView.state.selection.main.head,
                positionAtPoint:client.editorView.posAtCoords(point),
                actualCoords:client.editorView.coordsAtPos(client.editorView.state.selection.main.head),
                scrollTop:client.editorView.scrollDOM.scrollTop,userAgent:navigator.userAgent,
              }), {point,target:start+2})));
              throw error;
            });
          const tapped = await page.evaluate(() => client.editorView.state.selection.main.head);
          assert(Math.abs(tapped - start - 2) <= 1, `${engine}: tapping Hebrew placed the caret elsewhere`);
          await cursor(start + 2);
        }
        const before = await page.evaluate(() => client.editorView.coordsAtPos(client.editorView.state.selection.main.head).left);
        await page.keyboard.press("ArrowLeft");
        await page.waitForFunction(position => client.editorView.state.selection.main.head === position, start + 3);
        const after = await page.evaluate(() => client.editorView.coordsAtPos(client.editorView.state.selection.main.head).left);
        assert(after < before, `${engine}: Left arrow moved the caret right`);
        await page.keyboard.press("ArrowRight");
        await page.waitForFunction(position => client.editorView.state.selection.main.head === position, start + 2);
        await page.keyboard.press("Shift+ArrowLeft");
        assert.equal(await page.evaluate(() => {
          const view = client.editorView;
          return view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
        }), "ו");
        await cursor(start + 2);
        await page.keyboard.press("Backspace");
        await page.waitForFunction(() => client.editorView.state.doc.toString().includes("שום עולם"));
        await page.keyboard.press("Control+z");
        await page.waitForFunction(original => client.editorView.state.doc.toString() === original, original);

        await cursor(original.length);
        const addition = "\nטקסט חדש בעברית עם English ומחיר £250\nhttps://example.com?a=1&b=2\n";
        await page.keyboard.press("Enter");
        await page.keyboard.insertText("טקסט חדש בעברית עם English ומחיר £250");
        await page.keyboard.press("Enter");
        await page.keyboard.insertText("https://example.com?a=1&b=2");
        await page.keyboard.press("Enter");
        // Upstream Android Enter after a URL also inserts a paragraph break.
        const expected = original + addition + (android ? "\n" : "");
        await page.waitForFunction(expected => client.editorView.state.doc.toString() === expected, expected);
        await page.evaluate(() => client.save(true));
        const response = await page.request.get(`${base}/.fs/RTL-QA.md`);
        assert.equal(await response.text(), expected, `${engine}: saved source changed`);
        await page.reload({waitUntil:"networkidle"});
        await page.waitForFunction(expected => globalThis.client?.systemReady && client.editorView.state.doc.toString() === expected, expected);
        await page.evaluate(original => {
          const view = client.editorView;
          view.dispatch({changes:{from:0,to:view.state.doc.length,insert:original}});
          return client.save(true);
        }, original);
        assert.equal(await (await page.request.get(`${base}/.fs/RTL-QA.md`)).text(), original);
      }
      assert.deepEqual(errors, [], `${engine} ${width}: browser errors`);
      console.log(`PASS ${engine} ${width}: bidi layout, cursor direction, wrapping, tables, and font${width === 390 ? ", arrow keys, selection, deletion, undo, typing, save, and reload" : ""}`);
      await context.close();
    }
  } finally { await browser.close(); }
}
