self.addEventListener("install", event => {
	self.skipWaiting();
});

self.addEventListener("activate", event => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
	const url = new URL(event.request.url);

	// Jangan intercept file statis, hot update (HMR), atau request cross-origin
	const isStatic = url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|json|map|tsx|ts|woff2?)$/);
	const isHmr = url.pathname.startsWith("/__") || url.pathname.startsWith("/@") || url.pathname.includes("sockjs");
	const isCrossOrigin = url.hostname !== self.location.hostname;

	// Hanya intercept API endpoint (misal: /api/*)
	const isApi = url.pathname.startsWith("/api/");

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

	if (!client) {
		return fetch(event.request);
	}

	let requestBody = "";
	try {
		requestBody = await event.request.text();
	} catch (e) {
		requestBody = "";
	}

	// Extract headers to plain object
	const requestHeaders = {};
	for (const [key, value] of event.request.headers.entries()) {
		requestHeaders[key] = value;
	}

	return new Promise(resolve => {
		const channel = new MessageChannel();

		// Dengarkan balasan dari React App
		channel.port1.onmessage = msg => {
			try {
				const { response } = msg.data || {};

				if (!response) {
					// jika client tidak membalas dengan response yang diharapkan, fallback ke network
					resolve(fetch(event.request));
					return;
				}

				// Build Headers robustly: accept array of {key,value} or plain object
				const headers = new Headers();
				if (Array.isArray(response.headers)) {
					response.headers.forEach(h => {
						if (h && h.key) headers.append(String(h.key), String(h.value ?? ""));
					});
				} else if (response.headers && typeof response.headers === "object") {
					Object.entries(response.headers).forEach(([k, v]) => headers.append(k, String(v ?? "")));
				}

				// Ensure body is a string or null
				const body =
					response.body === null || response.body === undefined
						? null
						: typeof response.body === "string"
						? response.body
						: JSON.stringify(response.body);

				const sendResponse = () => {
					try {
						resolve(
							new Response(body, {
								status: response.status ?? 200,
								headers: headers,
							})
						);
					} catch (err) {
						// If Response construction fails for any reason, fallback to network
						console.error("SW: Failed to construct Response from client data", err);
						resolve(fetch(event.request));
					}
				};

				if (response.delay && typeof response.delay === "number") {
					setTimeout(sendResponse, response.delay);
				} else {
					sendResponse();
				}
			} catch (outerErr) {
				console.error("SW: Error handling message from client", outerErr);
				resolve(fetch(event.request));
			}
		};

		// Kirim request ke React App untuk diproses ("Server-side logic" di Client)
		const requestId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

		client.postMessage(
			{
				type: "INTERCEPT_REQUEST",
				payload: {
					id: requestId,
					url: event.request.url,
					method: event.request.method,
					headers: requestHeaders, // Pass headers to app
					body: requestBody,
				},
			},
			[channel.port2]
		);
	});
}
