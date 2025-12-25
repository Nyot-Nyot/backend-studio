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

const upload = multer({
	storage,
	limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

const app = express();
app.use(cors());
app.use(express.json());

// serve files with simple static middleware
app.use("/files", express.static(UPLOAD_DIR, { index: false }));

const USE_0X0 = process.env.EMAIL_HELPER_UPLOAD_TO_0X0 === 'true' || process.env.EMAIL_HELPER_PUBLIC_HOST === '0x0.st';

app.post("/upload-temp", upload.single("file"), async (req, res) => {
	if (!req.file) return res.status(400).json({ error: "No file uploaded" });
	const expiresAt = Date.now() + TTL_HOURS * 60 * 60 * 1000;
	// store metadata small JSON beside file
	const meta = { originalName: req.file.originalname, filename: req.file.filename, size: req.file.size, expiresAt };
	fs.writeFileSync(path.join(UPLOAD_DIR, `${req.file.filename}.json`), JSON.stringify(meta));

	if (USE_0X0) {
		try {
			const FormData = require('form-data');
			const form = new FormData();
			const filePath = path.join(UPLOAD_DIR, req.file.filename);
			form.append('file', fs.createReadStream(filePath), { filename: req.file.originalname });
			const fetchRes = await fetch('https://0x0.st', { method: 'POST', body: form, headers: form.getHeaders() });
			const text = (await fetchRes.text()).trim();
			if (fetchRes.ok && text && text.startsWith('http')) {
				const url = text;
				meta.remoteUrl = url;
				fs.writeFileSync(path.join(UPLOAD_DIR, `${req.file.filename}.json`), JSON.stringify(meta));
				// remove local file to save disk space
				try { fs.unlinkSync(filePath); } catch (e) {}
				return res.json({ url, expiresAt });
			} else {
				console.warn('0x0.st upload failed', fetchRes.status, text);
			}
		} catch (e) {
			console.error('Public upload error', e);
		}
	}

	// fallback to local url
	const fileUrl = `${req.protocol}://${req.get("host")}/files/${req.file.filename}`;
	res.json({ url: fileUrl, expiresAt });
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

app.listen(PORT, () => {
	console.log(`Email helper server running on port ${PORT}`);
	console.log(`Upload endpoint: POST http://localhost:${PORT}/upload-temp (form field name 'file')`);
	console.log(`Public uploads to 0x0.st enabled: ${USE_0X0 ? 'yes' : 'no'}`);
});
