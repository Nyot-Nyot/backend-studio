import { convertSchemaToJson, deepClone, SchemaField, validateJsonStructure } from "../components/mockEditorUtils";

function test(name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`failed - ${name}`);
    throw e;
  }
}

// Basic deep clone distinctness
test("deepClone returns a distinct but equal structure", () => {
  const a = { x: 1, nested: { y: [1, 2] } } as any;
  const b = deepClone(a);
  if (b === a) throw new Error("clone should not be same reference");
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("clone content mismatch");
});

// Root array conversion
test("convertSchemaToJson preserves root array order", () => {
  const fields: SchemaField[] = [
    { id: "a", key: "0", value: "", type: "object", children: [{ id: "a1", key: "name", value: "Alice", type: "string" }] },
    { id: "b", key: "1", value: "", type: "object", children: [{ id: "b1", key: "name", value: "Bob", type: "string" }] },
  ];

  const out = convertSchemaToJson(fields, true);
  if (!Array.isArray(out)) throw new Error("expected array");
  if ((out as any[])[0].name !== "Alice" || (out as any[])[1].name !== "Bob") throw new Error("unexpected array contents");
});

// Invalid number throws
test("convertSchemaToJson throws on invalid number", () => {
  const fields: SchemaField[] = [{ id: "n", key: "count", value: "abc", type: "number" }];
  let threw = false;
  try {
    convertSchemaToJson(fields);
  } catch (e) {
    threw = true;
  }
  if (!threw) throw new Error("should throw on invalid number");
});

// Validate JSON structure returns line
test("validateJsonStructure returns an approximate error line", () => {
  const broken = `{"a": 1,\n"b": }`;
  const res = validateJsonStructure(broken);
  if (!res) throw new Error("expected error");
  if (!res.line || res.line < 1) throw new Error("expected line number");
});

// Move field in tree up/down
test("moveFieldInTree moves nested field up and down", () => {
  const fields: any[] = [
    { id: "1", key: "a", type: "string", value: "" },
    { id: "2", key: "b", type: "object", children: [{ id: "2-1", key: "x", type: "string", value: "" }, { id: "2-2", key: "y", type: "string", value: "" }] },
    { id: "3", key: "c", type: "string", value: "" },
  ];

  const { moved, result } = (require("../components/mockEditorUtils") as any).moveFieldInTree(fields, '2-2', 'up');
  if (!moved) throw new Error('expected moved');
  // ensure the nested order swapped
  const nested = (result[1] as any).children;
  if (nested[0].id !== '2-2') throw new Error('nested order not updated');

  const { moved: moved2, result: result2 } = (require("../components/mockEditorUtils") as any).moveFieldInTree(result, '2-2', 'down');
  if (!moved2) throw new Error('expected moved down');
  const nested2 = (result2[1] as any).children;
  if (nested2[1].id !== '2-2') throw new Error('nested order not restored');
});
