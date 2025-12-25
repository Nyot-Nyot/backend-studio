import { MockEditor } from "../../components/MockEditor";

function test(name: string, fn: () => void) {
	try {
		fn();
		console.log(`✅ PASS: ${name}`);
	} catch (e) {
		console.log(`❌ FAIL: ${name}`);
		console.log(`   ${(e as Error).message}`);
	}
}

function assert(cond: any, msg: string) {
	if (!cond) throw new Error(msg);
}

console.log("🧪 MockEditor basic tests\n");

test("MockEditor component exists", () => {
	assert(typeof MockEditor === "function", "MockEditor should be a function/component");
});
