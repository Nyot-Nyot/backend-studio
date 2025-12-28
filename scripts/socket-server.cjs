const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const PORT = process.env.SOCKET_PORT ? Number(process.env.SOCKET_PORT) : 9150;
const AUTH_TOKEN = process.env.SOCKET_AUTH_TOKEN || "";

const app = express();

// CORS configuration: allow specifying allowed origins via SOCKET_ALLOWED_ORIGINS (comma-separated)
const allowedOrigins = (process.env.SOCKET_ALLOWED_ORIGINS || "")
	.split(",")
	.map(s => s.trim())
	.filter(Boolean);
const isProd = process.env.NODE_ENV === "production";
const QUIET_SOCKET = process.env.SOCKET_SERVER_QUIET === "1" || process.env.SOCKET_SERVER_QUIET === "true";

// CORS strategy:
// - If SOCKET_ALLOWED_ORIGINS set, use explicit allowlist
// - In production with no allowedOrigins, block by default (reject unknown origins)
// - In dev, allow all origins for convenience
if (allowedOrigins.length > 0) {
	if (!QUIET_SOCKET) console.log("[socket-server] CORS allowlist:", allowedOrigins.join(","));
	app.use(
		cors({
			origin: (origin, callback) => {
				// allow requests with no origin (like server-to-server)
				if (!origin) return callback(null, true);
				if (allowedOrigins.includes(origin)) return callback(null, true);
				return callback(new Error("Not allowed by CORS"), false);
			},
		})
	);
} else {
	// In production be strict and block unknown origins; in dev allow all
	if (isProd) {
		if (!QUIET_SOCKET)
			console.warn(
				"[socket-server] No SOCKET_ALLOWED_ORIGINS set and running in production - all cross-origin requests will be blocked"
			);
		app.use(cors({ origin: false }));
	} else {
		if (!QUIET_SOCKET) console.log("[socket-server] Running in development mode - allowing all origins");
		app.use(cors());
	}
}

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: allowedOrigins.length > 0 ? allowedOrigins : isProd ? [] : "*" },
	// allowEIO3: true // if you need old engine.io clients
});

// Socket-level rate limiting map: socketId -> timestamps
const socketRateWindowMs = Number(process.env.SOCKET_RATE_WINDOW_MS || 5000); // default 5s window
const socketRateMax = Number(process.env.SOCKET_RATE_LIMIT || 5); // default 5 msgs per window
const socketRateMap = new Map();

function isSocketRateLimited(socketId) {
	const now = Date.now();
	const arr = socketRateMap.get(socketId) || [];
	const fresh = arr.filter(ts => now - ts < socketRateWindowMs);
	fresh.push(now);
	// store limited number of timestamps to bound memory per socket
	socketRateMap.set(socketId, fresh.slice(-socketRateMax * 2));
	return fresh.length > socketRateMax;
}

// Simple token check: if SOCKET_AUTH_TOKEN env var is set, require it in query or Authorization header
io.use((socket, next) => {
	try {
		if (!AUTH_TOKEN) return next();
		const token =
			socket.handshake.auth?.token || socket.handshake.query?.token || socket.handshake.headers?.authorization;
		const normal = (token || "").replace(/^Bearer\s+/i, "");
		if (normal && normal === AUTH_TOKEN) return next();
		const err = new Error("Unauthorized");
		err.data = { status: 401 };
		return next(err);
	} catch (e) {
		return next(e);
	}
});

io.on("connection", socket => {
	console.log("[socket] client connected", socket.id);
	socket.on("join", room => {
		socket.join(room);
		console.log("[socket] join", socket.id, room);
	});
	socket.on("leave", room => {
		socket.leave(room);
	});

	// Allow clients to publish logs to the server, server will broadcast to other clients
	socket.on("log:publish", payload => {
		try {
			// rate limit by socket
			if (isSocketRateLimited(socket.id)) {
				if (!QUIET_SOCKET) console.warn(`[socket] rate limit exceeded for ${socket.id}`);
				socket.emit("error", { error: "rate_limited" });
				return;
			}

			// Basic payload validation and sanitization
			let sanitized = {};
			try {
				const size = JSON.stringify(payload).length;
				if (size > 20 * 1024) {
					socket.emit("error", { error: "payload_too_large" });
					return;
				}
			} catch (e) {
				socket.emit("error", { error: "invalid_payload" });
				return;
			}

			// Allow only expected fields and types
			const allowed = ["id", "workspaceId", "source", "level", "message", "ts"];
			for (const k of allowed) {
				if (k in (payload || {})) sanitized[k] = payload[k];
			}
			if (sanitized.ts && typeof sanitized.ts !== "number") {
				socket.emit("error", { error: "invalid_ts" });
				return;
			}

			const room = sanitized.workspaceId ? `logs:${sanitized.workspaceId}` : "logs:all";
			if (!QUIET_SOCKET) console.info("[socket] publish", socket.id, "room", room, "id", sanitized.id);
			// Broadcast sanitized payload
			socket.broadcast.to(room).emit("log:new", sanitized);
			socket.broadcast.to("logs:all").emit("log:new", sanitized);
			socket.emit("log:ack", { ok: true });
		} catch (e) {
			console.error("[socket] publish handler error", e);
		}
	});

	socket.on("disconnect", () => {
		console.log("[socket] disconnect", socket.id);
	});
});

// Simple rate-limiter and payload validation for /emit-log
const rateLimitWindowMs = Number(process.env.SOCKET_RATE_WINDOW_MS || 60000);
const rateLimitMax = Number(process.env.SOCKET_RATE_LIMIT || 60); // default 60 req/window
const rateMap = new Map(); // ip -> [timestamps]

function isRateLimited(ip) {
	const now = Date.now();
	const arr = rateMap.get(ip) || [];
	// Remove old timestamps
	const fresh = arr.filter(ts => now - ts < rateLimitWindowMs);
	fresh.push(now);
	rateMap.set(ip, fresh);
	return fresh.length > rateLimitMax;
}

// POST /emit-log - convenient test endpoint to broadcast log events
app.post("/emit-log", (req, res) => {
	const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
	if (isRateLimited(String(ip))) {
		return res.status(429).json({ error: "rate_limited" });
	}

	const payload = req.body || {};
	// Basic payload size check
	try {
		const size = JSON.stringify(payload).length;
		if (size > 20 * 1024) return res.status(413).json({ error: "payload_too_large" });
	} catch (e) {
		return res.status(400).json({ error: "invalid_payload" });
	}

	// Basic validation for fields we expect
	if (payload && payload.statusCode && typeof payload.statusCode !== "number") {
		return res.status(400).json({ error: "invalid_statusCode" });
	}

	// Accept optional workspaceId, otherwise broadcast globally
	const room = payload.workspaceId ? `logs:${payload.workspaceId}` : "logs:all";
	// Emit to specific room and to global
	io.to(room).emit("log:new", payload);
	io.to("logs:all").emit("log:new", payload);
	// also emit to all for convenience
	io.emit("log:new", payload);
	res.status(200).json({ ok: true, emitted: payload });
});

app.get("/health", (req, res) => res.json({ ok: true }));

server.listen(PORT, () => {
	console.log(`[socket-server] listening on :${PORT}`);
});

process.on("SIGINT", () => {
	console.log("[socket-server] shutting down");
	server.close(() => process.exit(0));
});
