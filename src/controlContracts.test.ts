import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

function buttons() {
  const found: { location: string; attributes: Map<string, ts.JsxAttribute> }[] = [];
  for (const file of fs.readdirSync(path.resolve("src")).filter(name => name.endsWith(".tsx"))) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.resolve("src", file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ["button", "Button"].includes(node.tagName.getText(source))) {
        found.push({ location: `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`, attributes: new Map(node.attributes.properties.filter(ts.isJsxAttribute).map(attribute => [attribute.name.getText(source), attribute])) });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

it("every owned button has an action or an explicit form submission", () => {
  const controls = buttons();
  expect(controls.length).toBeGreaterThan(50);
  expect(controls.filter(({ attributes }) => {
    const type = attributes.get("type")?.initializer;
    return !attributes.has("onClick") && !(type && ts.isStringLiteral(type) && type.text === "submit");
  }).map(control => control.location)).toEqual([]);
});

it("no owned button is permanently disabled as a placeholder", () => {
  expect(buttons().filter(({ attributes }) => {
    const disabled = attributes.get("disabled");
    if (!disabled) return false;
    if (!disabled.initializer) return true;
    return ts.isJsxExpression(disabled.initializer) && disabled.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword;
  }).map(control => control.location)).toEqual([]);
});

it("button handlers do not contain literal empty callbacks", () => {
  expect(buttons().filter(({ attributes }) => {
    const initializer = attributes.get("onClick")?.initializer;
    if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) return false;
    const handler = initializer.expression;
    if (ts.isIdentifier(handler) && handler.text === "undefined") return true;
    return (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) && ts.isBlock(handler.body) && handler.body.statements.length === 0;
  }).map(control => control.location)).toEqual([]);
});
