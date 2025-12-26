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

if (allowedOrigins.length > 0) {
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
		app.use(cors({ origin: false }));
	} else {
		app.use(cors());
	}
}

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: allowedOrigins.length > 0 ? allowedOrigins : isProd ? [] : "*" },
	// allowEIO3: true // if you need old engine.io clients
});

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
			const room = payload && payload.workspaceId ? `logs:${payload.workspaceId}` : "logs:all";
			console.log(
				"[socket] publish received from",
				socket.id,
				"room:",
				room,
				"payload id:",
				payload && payload.id
			);
			// Broadcast to others in the room (exclude sender)
			socket.broadcast.to(room).emit("log:new", payload);
			socket.broadcast.to("logs:all").emit("log:new", payload);
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
