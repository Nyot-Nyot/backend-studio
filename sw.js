self.addEventListener("install", event => {
	self.skipWaiting();
});

self.addEventListener("activate", event => {
	event.waitUntil(self.clients.claim());
});

const API_PREFIX = "/api/"; // Extracted for maintainability

// Timeout for how long SW waits for a client response before falling back to network (milliseconds)
const HANDSHAKE_TIMEOUT_MS = 3000; // configurable default

self.addEventListener("fetch", event => {
	const url = new URL(event.request.url);

	// Jangan intercept file statis, hot update (HMR), atau request cross-origin
	const isStatic = url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|json|map|tsx|ts|woff2?)$/);
	const isHmr = url.pathname.startsWith("/__") || url.pathname.startsWith("/@") || url.pathname.includes("sockjs");
	const isCrossOrigin = url.hostname !== self.location.hostname;

	// Hanya intercept API endpoint (misal: /api/*)
	const isApi = url.pathname.startsWith(API_PREFIX);

	if (isStatic || isHmr || url.pathname.startsWith("/node_modules/") || isCrossOrigin || !isApi) {
		// biarkan langsung lewat ke network
		return;
	}

	event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
	// Dapatkan semua window client yang aktif
	const clients = await self.clients.matchAll({ type: "window" });
	const client = clients.find(c => c.visibilityState === "visible") || clients[0]; // prefer visible tab

	// If no client available, simply fallback to network. Keep behavior stable.
	if (!client) {
		return fetch(event.request);
	}

	// Try to read body safely
	let requestBody = "";
	try {
		const method = (event.request.method || "GET").toUpperCase();
		const mayHaveBody = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
		if (mayHaveBody) {
			const cloned = event.request.clone();
			requestBody = await cloned.text();
		} else {
			requestBody = "";
		}
	} catch (e) {
		requestBody = "";
	}

	// Extract headers to plain object
	const requestHeaders = {};
	for (const [key, value] of event.request.headers.entries()) {
		requestHeaders[key] = value;
	}

	// Helper: build a promise that resolves when client responds via MessageChannel
	const clientResponsePromise = () => {
		return new Promise(resolveClient => {
			const channel = new MessageChannel();
			let settled = false;

			// Timeout will cause rejection so the race can continue with other strategies
			const timeoutId = setTimeout(() => {
				if (settled) return;
				settled = true;
				channel.port1.onmessage = null;
				resolveClient(null); // indicate no client response in time
			}, HANDSHAKE_TIMEOUT_MS);

			channel.port1.onmessage = msg => {
				if (settled) return; // ignore late responses
				clearTimeout(timeoutId);
				settled = true;
				try {
					const { response } = msg.data || {};
					if (!response) {
						resolveClient(null);
						return;
					}

					// Build Headers robustly
					const headers = new Headers();
					if (Array.isArray(response.headers)) {
						response.headers.forEach(h => {
							if (h && h.key) headers.append(String(h.key), String(h.value ?? ""));
						});
					} else if (response.headers && typeof response.headers === "object") {
						Object.entries(response.headers).forEach(([k, v]) => headers.append(k, String(v ?? "")));
					}

					const body =
						response.body === null || response.body === undefined
							? null
							: typeof response.body === "string"
							? response.body
							: JSON.stringify(response.body);

					resolveClient(new Response(body, { status: response.status ?? 200, headers }));
				} catch (err) {
					console.error("SW: Error handling message from client", err);
					resolveClient(null);
				}
			};

			// Send the request over to client for processing, transfer port2
			const requestId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
			try {
				client.postMessage(
					{
						type: "INTERCEPT_REQUEST",
						payload: {
							id: requestId,
							url: event.request.url,
							method: event.request.method,
							headers: requestHeaders,
							body: requestBody,
						},
					},
					[channel.port2]
				);

				// Also listen for controller-level replies as a fallback for test environments
				const onGlobalReply = ev => {
					try {
						const { id, response } = ev.data || {};
						if (id === requestId && response) {
							if (settled) return;
							clearTimeout(timeoutId);
							settled = true;
							try {
								const headers = new Headers();
								if (Array.isArray(response.headers)) {
									response.headers.forEach(h => {
										if (h && h.key) headers.append(String(h.key), String(h.value ?? ""));
									});
								} else if (response.headers && typeof response.headers === "object") {
									Object.entries(response.headers).forEach(([k, v]) =>
										headers.append(k, String(v ?? ""))
									);
								}
								const body =
									response.body === null || response.body === undefined
										? null
										: typeof response.body === "string"
										? response.body
										: JSON.stringify(response.body);
								resolveClient(new Response(body, { status: response.status ?? 200, headers }));
							} catch (e) {
								console.error("SW: Error constructing response from global reply", e);
								resolveClient(null);
							}
						}
					} catch (e) {
						// ignore
					}
				};
				self.addEventListener("message", onGlobalReply, { once: true });
			} catch (err) {
				clearTimeout(timeoutId);
				console.warn("SW: client.postMessage failed", err);
				resolveClient(null);
			}
		});
	};

	// Strategy: check cache first for fast response, then race client vs network. If client responds before network, prefer client. If not, use network response.
	try {
		// Try cache first when available (fast path)
		if (typeof caches !== "undefined" && caches.match) {
			const cached = await caches.match(event.request);
			if (cached) return cached;
		}
	} catch (e) {
		// ignore cache errors and continue
	}

	// Respect an optional test header to artificially delay network fetches for deterministic testing
	const testDelayMs = Number(event.request.headers.get("x-sw-test-delay") || 0);
	// Allow tests to override the network target via header 'x-sw-test-network-url'
	const testNetworkUrl = event.request.headers.get("x-sw-test-network-url");
	if (testNetworkUrl) console.log("SW: using test network url", testNetworkUrl);
	const networkPromise = (async () => {
		try {
			if (testDelayMs > 0) {
				await new Promise(r => setTimeout(r, testDelayMs));
			}
			if (testNetworkUrl) {
				console.log("SW: fetch ->", testNetworkUrl);
				return await fetch(testNetworkUrl);
			}
			console.log("SW: fetch -> event.request");
			return await fetch(event.request);
		} catch (err) {
			console.warn("SW: network fetch failed", err);
			return null;
		}
	})();

	const clientPromise = clientResponsePromise();

	// race: whichever resolves with a usable Response first (client preferred if it resolves before network)
	const res = await Promise.race([
		clientPromise.then(r => ({ source: "client", res: r })),
		networkPromise.then(r => ({ source: "network", res: r })),
	]);

	if (res && res.res) {
		try {
			if (res.source === "network" && res.res) {
				// tag network responses for test visibility
				const clonedHeaders = new Headers(res.res.headers || {});
				clonedHeaders.set("x-sw-source", "network");
				const text = await res.res.clone().text();
				return new Response(text, { status: res.res.status ?? 200, headers: clonedHeaders });
			}
		} catch (e) {
			// if tagging fails, fall back to original response
			console.warn("SW: tagging response failed", e);
		}

		return res.res;
	}

	// Fallback: if neither produced a valid response, try a final network fetch (guarantee)
	return fetch(event.request).catch(err => {
		console.error("SW: final fallback network fetch failed", err);
		throw err;
	});
}

// Expose handler for test environments
if (typeof globalThis !== "undefined") {
	globalThis.__sw_handleRequest = handleRequest;
}
