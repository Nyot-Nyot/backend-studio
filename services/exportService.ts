import { MockEndpoint } from "../types";

export const renderBodyLiteral = (bodyStr: string) => {
  try {
    const parsed = JSON.parse(bodyStr);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return JSON.stringify(bodyStr || "");
  }
};

export const generateServerCode = (activeMocks: MockEndpoint[]) => {
  const routesCode = activeMocks
    .map((m) => {
      const bodyLiteral = renderBodyLiteral(m.responseBody || "");
      return `
app.${m.method.toLowerCase()}('${m.path}', async (req, res) => {
  // Handler for ${m.name}
  const status = ${m.statusCode};
  const body = ${bodyLiteral};
  // Simple per-route logging before sending response
  console.log(req.method, req.path, status);
  res.status(status).json(body);
});`;
    })
    .join("\n");

  return `const express = require('express');
const cors = require('cors');
const app = require('express')();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Middleware
app.use(cors());
app.use(require('express').json());

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
});`;
};
