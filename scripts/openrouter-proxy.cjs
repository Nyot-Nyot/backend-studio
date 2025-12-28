"use strict";
// Load .env for local development so users can just set variables in the repo .env file
let _dotenvLoaded = false;
try {
	const d = require("dotenv");
	d.config();
	_dotenvLoaded = true;
} catch (e) {
	// dotenv not installed; try a minimal manual parser as a best-effort fallback
	try {
		const fs = require("fs");
		const path = require("path");
		const envPath = path.resolve(process.cwd(), ".env");
		if (fs.existsSync(envPath)) {
			const raw = fs.readFileSync(envPath, "utf8");
			raw.split(/\r?\n/).forEach(line => {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) return;
				const eq = trimmed.indexOf("=");
				if (eq === -1) return;
				const key = trimmed.slice(0, eq).trim();
				let val = trimmed.slice(eq + 1).trim();
				// Remove surrounding quotes
				if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
					val = val.slice(1, -1);
				}
				if (typeof process.env[key] === "undefined") process.env[key] = val;
			});
			_dotenvLoaded = true;
		}
	} catch (e2) {
		// ignore fallback errors
	}
}
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const PORT = process.env.OPENROUTER_HELPER_PORT || 3002;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_KEY;

if (!OPENROUTER_API_KEY) {
	console.warn("Warning: OPENROUTER_API_KEY is not set. Proxy will respond with 401 unless a key is provided.");
} else {
	// log that we have a key but never print it outright
	const k = String(OPENROUTER_API_KEY);
	const redacted = k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : "***";
	console.log(`OpenRouter proxy: using server key ${redacted}`);
}

function createApp(opts = {}) {
	const hasOverride = Object.prototype.hasOwnProperty.call(opts, "openRouterApiKey");
	const OPENROUTER_API_KEY_OVERRIDE = opts.openRouterApiKey;

	const app = express();
	app.use(cors());
	app.use(bodyParser.json());

	app.get("/health", (req, res) => res.json({ ok: true }));

	// Expose a path under /openrouter for Vite dev proxy health checks (client fetches /openrouter/health)
	app.get("/openrouter/health", (req, res) => {
		const keyPresent = !!(hasOverride ? OPENROUTER_API_KEY_OVERRIDE : process.env.OPENROUTER_API_KEY);
		res.json({ ok: true, keyPresent });
	});

	// Helper to call OpenRouter Chat Completions
	async function callOpenRouter(messages, model = "deepseek/deepseek-r1-0528:free", apiKey) {
		// Expose a testing hook so tests can call the internal function directly
		if (!app._isTest_callOpenRouter) app._isTest_callOpenRouter = msgs => callOpenRouter(msgs, model, apiKey);
		const keyToUse = apiKey || (hasOverride ? OPENROUTER_API_KEY_OVERRIDE : process.env.OPENROUTER_API_KEY);
		const retryUtil = require("../services/retry.cjs");

		const doFetch = async () => {
			const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${keyToUse}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ model, messages }),
			});

			if (!response) throw new Error("no response from fetch");

			// Parse body for non-success statuses so we can include messages
			if (response.status >= 400) {
				let body = null;
				try {
					body = await response.json();
				} catch (e) {
					// ignore parse errors
				}

				if (response.status === 429) {
					const msg = body?.message || body?.error || JSON.stringify(body) || "rate limit";
					const retryAfter =
						response.headers && typeof response.headers.get === "function"
							? response.headers.get("retry-after")
							: null;
					const err = new Error(`rate_limit:${msg}`);
					err.status = 429;
					err.noRetry = true; // don't retry rate-limit errors
					err.retryAfter = retryAfter;
					throw err;
				}

				// For other 4xx client errors, surface the message and don't retry
				if (response.status >= 400 && response.status < 500) {
					const err = new Error(`client_error:${response.status}:${JSON.stringify(body)}`);
					err.status = response.status;
					err.noRetry = true;
					throw err;
				}

				// For 5xx, throw to trigger retry logic
				if (response.status >= 500) throw new Error("server_error:" + response.status);
			}

			const json = await response.json();
			return { status: response.status, body: json };
		};

		// Use retry with reasonable defaults and per-attempt timeout
		const timeoutMsEnv = process.env.OPENROUTER_TIMEOUT_MS
			? parseInt(process.env.OPENROUTER_TIMEOUT_MS, 10)
			: undefined;
		const timeoutMs = typeof timeoutMsEnv === "number" && !Number.isNaN(timeoutMsEnv) ? timeoutMsEnv : 60000; // default 60s per attempt
		if (process.env.DEBUG_OPENROUTER === "1") console.log(`OpenRouter call: timeoutMs=${timeoutMs}`);
		const result = await retryUtil.retry(doFetch, {
			retries: 3,
			baseDelayMs: 200,
			factor: 2,
			maxDelayMs: 1500,
			timeoutMs: timeoutMs,
		});
		return result;
	}

	// Expose internal call helper for tests (call directly to avoid HTTP layer)
	app._isTest_callOpenRouter = (msgs, model, apiKey) => callOpenRouter(msgs, model, apiKey);

	app.post("/openrouter/generate-mock", async (req, res) => {
		const { path, context } = req.body || {};
		// allow dev override: accept X-OpenRouter-Key if DEV_ALLOW_CLIENT_KEY=1
		const keyFromHeader = req.get("x-openrouter-key");
		const key =
			OPENROUTER_API_KEY_OVERRIDE ||
			process.env.OPENROUTER_API_KEY ||
			(process.env.DEV_ALLOW_CLIENT_KEY === "1" && keyFromHeader ? keyFromHeader : null);
		if (!key) return res.status(401).json({ error: "OPENROUTER_API_KEY not configured" });
		if (!path) return res.status(400).json({ error: "Missing path" });

		const userPrompt = [
			"You are a backend developer helper. Generate a realistic JSON response body for the REST API endpoint.",
			`Endpoint Path: "${path}"`,
			`Context/Description: "${context}"`,
			"Requirements:",
			"1) Output ONLY valid JSON.",
			"2) Do not include markdown code fences; return plain JSON only.",
			"3) If the path implies a list (e.g., /users), return an array of 3-5 items.",
			"4) If the path implies a single resource (e.g., /users/1), return a single object.",
			"5) Use realistic data (names, dates, emails).",
		].join(" ");

		try {
			const messages = [{ role: "user", content: userPrompt }];
			const result = await callOpenRouter(messages, undefined, key);
			if (result.status !== 200) return res.status(result.status).json({ error: result.body });

			// Attempt to extract content text (compat with OpenRouter response shape)
			const text =
				result.body?.choices?.[0]?.message?.content ||
				result.body?.choices?.[0]?.content ||
				JSON.stringify(result.body);
			// Strip fences if any
			const cleaned = String(text)
				.replace(/```json/g, "")
				.replace(/```/g, "")
				.trim();

			res.json({ json: cleaned });
		} catch (e) {
			console.error("OpenRouter proxy error (generate-mock):", e);
			res.status(500).json({ error: "proxy_error", details: String(e) });
		}
	});

	app.post("/openrouter/generate-endpoint", async (req, res) => {
		const { prompt } = req.body || {};
		const keyFromHeader = req.get("x-openrouter-key");
		const key =
			OPENROUTER_API_KEY_OVERRIDE ||
			process.env.OPENROUTER_API_KEY ||
			(process.env.DEV_ALLOW_CLIENT_KEY === "1" && keyFromHeader ? keyFromHeader : null);
		if (!key) return res.status(401).json({ error: "OPENROUTER_API_KEY not configured" });
		if (!prompt) return res.status(400).json({ error: "Missing prompt" });

		const systemPrompt = [
			"You are an API Architect. Based on the user's description, generate a complete REST API endpoint configuration.",
			`User Description: "${prompt}"`,
			'Return ONLY a raw JSON object (no markdown) with this structure: { "name": "Short descriptive name", "path": "/api/v1/resource-name", "method": "GET|POST|PUT|DELETE|PATCH", "statusCode": 200, "responseBody": "The JSON string of the response data (stringified)" }',
			"Ensure the path uses best practices (kebab-case). Ensure the responseBody is a valid stringified JSON.",
		].join(" ");

		try {
			const messages = [{ role: "user", content: systemPrompt }];
			const result = await callOpenRouter(messages, undefined, key);
			if (result.status !== 200) return res.status(result.status).json({ error: result.body });

			const text =
				result.body?.choices?.[0]?.message?.content ||
				result.body?.choices?.[0]?.content ||
				JSON.stringify(result.body);
			const cleaned = String(text)
				.replace(/```json/g, "")
				.replace(/```/g, "")
				.trim();

			// Try to parse JSON
			try {
				const parsed = JSON.parse(cleaned);
				return res.json(parsed);
			} catch (e) {
				return res.status(502).json({ error: "invalid_model_output", raw: cleaned });
			}
		} catch (e) {
			console.error("OpenRouter proxy error (generate-endpoint):", e);
			res.status(500).json({ error: "proxy_error", details: String(e) });
		}
	});

	return app;
}

if (require.main === module) {
	const app = createApp();
	app.listen(PORT, () => {
		console.log(`OpenRouter proxy running on port ${PORT}`);
		console.log(`Endpoints: POST http://localhost:${PORT}/openrouter/generate-mock`);
		console.log(`           POST http://localhost:${PORT}/openrouter/generate-endpoint`);
	});
}

// Export factory for testing
module.exports = { createApp };
