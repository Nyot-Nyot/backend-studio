// CommonJS companion for scripts that use require()
const sleep = ms => new Promise(res => setTimeout(res, ms));

const withTimeout = async (promise, ms) => {
	let timer = null;
	const timeout = new Promise((_, rej) => {
		timer = setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms);
	});
	try {
		return await Promise.race([promise, timeout]);
	} finally {
		if (timer) clearTimeout(timer);
	}
};

const retry = async (fn, opts = {}) => {
	const retries = typeof opts.retries === "number" ? opts.retries : 3;
	const base = typeof opts.baseDelayMs === "number" ? opts.baseDelayMs : 200;
	const factor = typeof opts.factor === "number" ? opts.factor : 2;
	const maxDelay = typeof opts.maxDelayMs === "number" ? opts.maxDelayMs : 2000;
	const timeoutMs = opts.timeoutMs;

	const DEBUG = process.env.DEBUG_RETRY === "1" || process.env.DEBUG_OPENROUTER === "1";

	let attempt = 0;
	let lastErr = null;
	while (attempt <= retries) {
		try {
			if (DEBUG) console.log(`[retry] attempt ${attempt + 1}/${retries + 1} timeoutMs=${timeoutMs ?? "none"}`);
			if (timeoutMs) return await withTimeout(fn(), timeoutMs);
			return await fn();
		} catch (e) {
			lastErr = e;
			// Do not retry errors marked as noRetry (e.g., rate limits)
			if (e && e.noRetry) {
				if (DEBUG) console.warn(`[retry] not retrying due to noRetry flag: ${String(e)}`);
				throw e;
			}
			if (DEBUG)
				console.warn(
					`[retry] attempt ${attempt + 1} failed: ${String(e)}${
						attempt === retries ? " (no more retries)" : ", will retry"
					}`
				);
			if (attempt === retries) break;
			const delay = Math.min(maxDelay, base * Math.pow(factor, attempt));
			const jitter = Math.floor(Math.random() * Math.min(100, delay));
			await sleep(delay + jitter);
			attempt++;
			continue;
		}
	}
	throw lastErr;
};

module.exports = { sleep, withTimeout, retry };
