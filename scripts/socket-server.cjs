const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const PORT = process.env.SOCKET_PORT ? Number(process.env.SOCKET_PORT) : 9150;
const AUTH_TOKEN = process.env.SOCKET_AUTH_TOKEN || "";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: "*" },
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

// POST /emit-log - convenient test endpoint to broadcast log events
app.post("/emit-log", (req, res) => {
	const payload = req.body || {};
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
