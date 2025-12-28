import { highlightJson } from '../utils/jsonHighlighter';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.log(`❌ FAIL: ${name}`);
    console.log((e as Error).message);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log('🧪 TestConsole util tests');

test('highlightJson: handles nested strings with colons', () => {
  const json = JSON.stringify({ message: 'hello: world', count: 5, ok: true });
  const html = highlightJson(json);
  assert(html.includes('hello: world'), 'should include inner string with colon');
  assert(html.includes('<span'), 'should wrap tokens');
});

console.log('All testConsole tests completed');
