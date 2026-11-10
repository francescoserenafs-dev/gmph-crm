import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL("../components/shared/modal.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const context = { exports: {}, require: name => name === "react" ? { useEffect() {}, useId: () => "test-title", useRef: () => ({ current: null }) } : require(name) };
runInNewContext(source, context);

for (const scenario of [
  { name: "Escape closes", key: "Escape", busy: false, defaultPrevented: false, closes: 1 },
  { name: "saving cannot be dismissed", key: "Escape", busy: true, defaultPrevented: false, closes: 0 },
  { name: "tooltip Escape takes precedence", key: "Escape", busy: false, defaultPrevented: true, closes: 0 },
  { name: "other keys do not close", key: "Tab", busy: false, defaultPrevented: false, closes: 0 },
]) {
  test(`shared cost dialog: ${scenario.name}`, () => {
    let closed = 0;
    const dialog = context.exports.Modal({ title: "Nuovo costo", children: null, busy: scenario.busy, onClose: () => closed++ });
    assert.equal(dialog.type, "dialog");
    assert.equal(dialog.props["aria-labelledby"], "test-title");
    dialog.props.onKeyDown({ key: scenario.key, defaultPrevented: scenario.defaultPrevented, preventDefault() {} });
    assert.equal(closed, scenario.closes);
  });
}