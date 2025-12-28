import { generateServerCode, renderBodyLiteral } from "../services/exportService";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${(e as Error).message}`);
  }
}

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

console.log("🧪 Starting exportService tests\n");

// 1) renderBodyLiteral with JSON object
(() => {
  const { literal, isJson } = renderBodyLiteral('{"a":1}');
  test('renderBodyLiteral parses JSON objects', () => {
    assert(isJson === true, 'should mark as json');
    assert(literal.includes('"a"'), 'literal should include key');
  });
})();

// 2) renderBodyLiteral with plain text
(() => {
  const { literal, isJson } = renderBodyLiteral('hello');
  test('renderBodyLiteral handles plain text', () => {
    assert(isJson === false, 'should mark as plain text');
    assert(literal === JSON.stringify('hello'), 'literal should be JS string literal');
  });
})();

// 3) generateServerCode uses JSON response for JSON bodies
(() => {
  const code = generateServerCode([
    { id: '1', projectId: 'p', name: 'json', path: '/x', method: 'GET', statusCode: 200, delay: 0, responseBody: '{"ok":true}', isActive: true, version: 'v', createdAt: 0, requestCount: 0, headers: [] }
  ] as any);

  test('generateServerCode uses res.json for JSON bodies', () => {
    assert(code.includes("res.status(status).json(body)"), 'should call res.json');
  });
})();

// 4) generateServerCode uses text send for plain text bodies
(() => {
  const code = generateServerCode([
    { id: '2', projectId: 'p', name: 'text', path: '/y', method: 'POST', statusCode: 201, delay: 0, responseBody: 'plain text', isActive: true, version: 'v', createdAt: 0, requestCount: 0, headers: [] }
  ] as any);

  test('generateServerCode uses res.send for text bodies', () => {
    assert(code.includes("res.status(status).type('text/plain').send(body)"), 'should call res.send with text');
  });
})();

// 5) paths are properly escaped as string literals
(() => {
  const weirdPath = "/weird'\"/path";
  const code = generateServerCode([
    { id: '3', projectId: 'p', name: "weird", path: weirdPath, method: 'GET', statusCode: 200, delay: 0, responseBody: '{}', isActive: true, version: 'v', createdAt: 0, requestCount: 0, headers: [] }
  ] as any);

  test('generateServerCode escapes path literals', () => {
    assert(code.includes(JSON.stringify(weirdPath)), 'path literal should appear as JSON string literal');
  });
})();

console.log('\n🧪 exportService tests finished');
