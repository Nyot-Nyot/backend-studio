import { MockEndpoint } from "../types";

/**
 * Safely render a JS literal for embedding in generated server code.
 * If bodyStr is valid JSON (object/array/primitive) we return a pretty-printed JSON literal
 * (without wrapping quotes for objects/arrays) so that the generated code uses `res.json(body)`.
 * If bodyStr is not JSON (plain text), we return a JS string literal and the generated handler will
 * send it as text with `res.type('text/plain').send(body)` to match user intent.
 */
export const renderBodyLiteral = (bodyStr: string) => {
  const s = String(bodyStr ?? "");
  const trimmed = s.trim();
  // Quick heuristic: JSON objects/arrays or JSON primitives
  if (!trimmed) return { literal: "{}", isJson: true };
  try {
    const parsed = JSON.parse(s);
    // Render JSON with 2-space indentation
    return { literal: JSON.stringify(parsed, null, 2), isJson: true };
  } catch (e) {
    // Not valid JSON — return a safe JS string literal
    return { literal: JSON.stringify(s), isJson: false };
  }
};

function safeComment(s: string) {
  // avoid closing a comment if the name contains '*/'
  return String(s).replace(/\*\//g, "* /");
}

function safePathLiteral(p: string) {
  // Hasilkan literal string menggunakan tanda petik tunggal untuk konsistensi
  // Escape karakter single-quote agar aman di dalam string literal
  const escaped = String(p || "").replace(/'/g, "\\'");
  return `'${escaped}'`;
}

export const generateServerCode = (activeMocks: MockEndpoint[], opts?: { corsOrigin?: string; timeoutMs?: number }) => {
  const corsOrigin = opts?.corsOrigin ?? process.env.CORS_ORIGIN ?? "*";
  let timeoutMs = 30_000;
  if (typeof opts?.timeoutMs === 'number') {
    timeoutMs = opts!.timeoutMs;
  } else if (process.env.SERVER_TIMEOUT_MS) {
    const n = Number(process.env.SERVER_TIMEOUT_MS);
    if (!Number.isNaN(n) && n > 0) timeoutMs = n;
  }

  const routesCode = activeMocks
    .map((m) => {
      const { literal: bodyLiteral, isJson } = renderBodyLiteral(m.responseBody || "");
      const pathLiteral = safePathLiteral(m.path);
      const handlerComment = safeComment(m.name || "");

      if (isJson) {
        return `app.${m.method.toLowerCase()}(${pathLiteral}, async (req, res) => {
  // Handler for ${handlerComment}
  const status = ${m.statusCode};
  const body = ${bodyLiteral};
  // Simple per-route logging before sending response
  console.log(req.method, req.path, status);
  res.status(status).json(body);
});`;
      }

      // Plain text response — send as text to avoid surprising JSON consumers
      return `app.${m.method.toLowerCase()}(${pathLiteral}, async (req, res) => {
  // Handler for ${handlerComment}
  const status = ${m.statusCode};
  const body = ${bodyLiteral};
  // Simple per-route logging before sending response
  console.log(req.method, req.path, status);
  res.status(status).type('text/plain').send(body);
});`;
    })
    .join("\n\n");

  return `const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Middleware
app.use(cors({ origin: ${JSON.stringify(corsOrigin)} }));
app.use(cors());
app.use(express.json());

// Simple logger that logs method, path and final status after response finishes
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(req.method, req.originalUrl, res.statusCode);
  });
  next();
});

// Routes
${routesCode}

const server = app.listen(PORT, () => {
  // If PORT was 0 (ephemeral), server.address() contains the real port
  const addr = server.address();
  const actualPort = (addr && typeof addr === 'object' && 'port' in addr) ? addr.port : PORT;
  console.log('Server running on port ' + actualPort);
});

// Set a server timeout to guard long-running requests (ms)
server.setTimeout(${Number(timeoutMs)});
`;
};
