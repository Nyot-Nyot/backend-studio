"use strict";
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cors = require("cors");

const PORT = process.env.EMAIL_HELPER_PORT || process.env.VITE_EMAIL_HELPER_PORT || 3001;
const UPLOAD_DIR = path.resolve(process.cwd(), "tmp", "email-uploads");
const TTL_HOURS = Number(process.env.EMAIL_HELPER_TTL_HOURS || 24);

// CLI / env: quiet mode to suppress potentially sensitive logs
const argv = process.argv.slice(2);
const QUIET = argv.includes("--quiet") || process.env.EMAIL_HELPER_QUIET === "true";
function safeLog() {
	if (!QUIET) console.log.apply(console, arguments);
}
function safeWarn() {
	if (!QUIET) console.warn.apply(console, arguments);
}
function safeError() {
	console.error.apply(console, arguments);
}

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, UPLOAD_DIR),
	filename: (req, file, cb) => {
		const id = crypto.randomBytes(8).toString("hex");
		const ext = path.extname(file.originalname) || ".zip";
		const name = `${id}${ext}`;
		cb(null, name);
	},
});

// Acceptable extensions (for this helper): .zip, .json, .txt, .png, .jpg
const ACCEPT_EXTENSIONS = new Set([".zip", ".json", ".txt", ".png", ".jpg", ".jpeg"]);

// Simple in-memory rate limiter (per-IP). Configurable via env vars
const RATE_LIMIT = Number(process.env.EMAIL_HELPER_RATE_LIMIT || 20); // uploads per window
const RATE_WINDOW_MS = Number(process.env.EMAIL_HELPER_RATE_WINDOW_HOURS || 1) * 60 * 60 * 1000;
const rateMap = new Map();

function rateLimitMiddleware(req, res, next) {
	const ip = req.ip || (req.connection && req.connection.remoteAddress) || "unknown";
	let entry = rateMap.get(ip);
	const now = Date.now();
	if (!entry || now - entry.first > RATE_WINDOW_MS) {
		entry = { count: 0, first: now };
	}
	entry.count += 1;
	rateMap.set(ip, entry);
	if (entry.count > RATE_LIMIT) {
		safeWarn(`Rate limit exceeded for ${ip} (${entry.count} > ${RATE_LIMIT})`);
		return res.status(429).json({ error: "Too many upload requests" });
	}
	next();
}

// cleanup old entries periodically
setInterval(() => {
	const now = Date.now();
	rateMap.forEach((v, k) => {
		if (now - v.first > RATE_WINDOW_MS * 2) rateMap.delete(k);
	});
}, RATE_WINDOW_MS);

const upload = multer({
	storage,
	limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
	fileFilter: (req, file, cb) => {
		const ext = path.extname(file.originalname || "").toLowerCase();
		if (!ACCEPT_EXTENSIONS.has(ext)) {
			// don't throw; signal validation failure and reject the file
			req._fileValidationError = "File type not allowed";
			return cb(null, false);
		}
		cb(null, true);
	},
});

const app = express();
app.use(cors());
app.use(express.json());

// serve files with simple static middleware
app.use("/files", express.static(UPLOAD_DIR, { index: false }));

const USE_0X0 = process.env.EMAIL_HELPER_UPLOAD_TO_0X0 === "true" || process.env.EMAIL_HELPER_PUBLIC_HOST === "0x0.st";

// Multer error wrapper so fileFilter errors are returned as JSON
function uploadHandler(req, res, next) {
	upload.single("file")(req, res, function (err) {
		if (err) {
			if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File too large" });
			if (err.message && err.message.includes("File type not allowed"))
				return res.status(400).json({ error: "File type not allowed" });
			safeError("Upload error (unexpected)", err);
			return res.status(500).json({ error: "Internal upload error" });
		}
		next();
	});
}

app.post("/upload-temp", rateLimitMiddleware, uploadHandler, async (req, res) => {
	// if the file was rejected by validation the helper will set a flag
	if (req._fileValidationError) return res.status(400).json({ error: req._fileValidationError });
	if (!req.file) return res.status(400).json({ error: "No file uploaded" });
	if (req.file && req.file.size > 50 * 1024 * 1024) return res.status(413).json({ error: "File too large" });
	const expiresAt = Date.now() + TTL_HOURS * 60 * 60 * 1000;
	// sanitize original filename to avoid path injection and weird chars
	const sanitizedOriginalName = path
		.basename(req.file.originalname || "")
		.replace(/[^\w.\-]+/g, "_")
		.slice(0, 255);
	// store metadata small JSON beside file
	const meta = { originalName: sanitizedOriginalName, filename: req.file.filename, size: req.file.size, expiresAt };
	fs.writeFileSync(path.join(UPLOAD_DIR, `${req.file.filename}.json`), JSON.stringify(meta));

	if (USE_0X0) {
		try {
			const FormData = require("form-data");
			const form = new FormData();
			const filePath = path.join(UPLOAD_DIR, req.file.filename);
			form.append("file", fs.createReadStream(filePath), { filename: req.file.originalname });
			const fetchRes = await fetch("https://0x0.st", { method: "POST", body: form, headers: form.getHeaders() });
			const text = (await fetchRes.text()).trim();
			if (fetchRes.ok && text && text.startsWith("http")) {
				const url = text;
				meta.remoteUrl = url;
				fs.writeFileSync(path.join(UPLOAD_DIR, `${req.file.filename}.json`), JSON.stringify(meta));
				// remove local file to save disk space
				try {
					fs.unlinkSync(filePath);
				} catch (e) {}
				return res.json({ url, expiresAt });
			} else {
				// avoid logging response body (may contain sensitive URLs). Log status only unless not quiet.
				safeWarn("0x0.st upload failed", fetchRes.status);
			}
		} catch (e) {
			// still log error to stderr
			safeError("Public upload error", e);
		}
	}

	// fallback to local url
	const fileUrl = `${req.protocol}://${req.get("host")}/files/${req.file.filename}`;
	res.json({ url: fileUrl, expiresAt });
});

// Generic error handler for pretty upload errors
app.use(function (err, req, res, next) {
	if (!err) return next();
	if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File too large" });
	if (err.message && err.message.includes("File type not allowed"))
		return res.status(400).json({ error: "File type not allowed" });
	safeError("Upload error", err);
	return res.status(500).json({ error: "Internal upload error" });
});

// Simple cleanup job
setInterval(() => {
	try {
		const files = fs.readdirSync(UPLOAD_DIR);
		const now = Date.now();
		files.forEach(f => {
			if (f.endsWith(".json")) return; // skip metadata files
			const metaPath = path.join(UPLOAD_DIR, `${f}.json`);
			let shouldDelete = false;
			if (fs.existsSync(metaPath)) {
				const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
				if (meta.expiresAt && meta.expiresAt < now) shouldDelete = true;
			} else {
				// if no metadata, delete older than 7 days
				const stats = fs.statSync(path.join(UPLOAD_DIR, f));
				if (now - stats.mtimeMs > 7 * 24 * 60 * 60 * 1000) shouldDelete = true;
			}
			if (shouldDelete) {
				try {
					fs.unlinkSync(path.join(UPLOAD_DIR, f));
				} catch (e) {}
				try {
					fs.unlinkSync(path.join(UPLOAD_DIR, `${f}.json`));
				} catch (e) {}
			}
		});
	} catch (e) {
		console.error("Cleanup error", e);
	}
}, 60 * 60 * 1000); // hourly

app.get("/health", (req, res) => res.json({ ok: true }));

function createApp() {
	// Reuse the already-configured global app instance, which has
	// all middleware, routes (including /upload-temp and /health),
	// and static file handling set up.
	return app;
}

if (require.main === module) {
	const app = createApp();
	app.listen(PORT, () => {
		safeLog(`Email helper server running on port ${PORT}`);
		safeLog(`Upload endpoint: POST http://localhost:${PORT}/upload-temp (form field name 'file')`);
		safeLog(`Public uploads to 0x0.st enabled: ${USE_0X0 ? "yes" : "no"}`);
	});
}

module.exports = { createApp };
