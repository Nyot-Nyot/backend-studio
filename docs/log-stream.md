# Real-time Log Streaming (Socket)

This document describes the lightweight socket-based log streaming feature used for development and e2e testing.

## Overview

-   The project ships a small socket server at `scripts/socket-server.cjs` (dev-only) that listens on `SOCKET_PORT` (default 9150) and exposes `POST /emit-log` to emit a `log:new` event.
-   Clients can connect with a socket.io client and listen for `log:new` events. Events can target a room `logs:<workspaceId>` or broadcast to `logs:all`.

## Running locally

1. Install dependencies: `npm install`
2. Start socket server: `npm run dev:socket` (listens on `:9150` by default)
3. Emit a test log: `curl -X POST http://localhost:9150/emit-log -H 'Content-Type: application/json' -d '{"id":"t1","ts":1690000000000,"method":"GET","path":"/api/test","statusCode":200}'`

## Integration

-   Client wrapper: `services/socketClient.ts` provides a simple API: `connect(token?)`, `on(event, handler)`, `emit(event, payload)`, `join(room)`, `disconnect()`.
-   App wires `socketClient.on('log:new', ...)` to append logs to the UI if `FEATURES.LOG_VIEWER()` is enabled.

## Security & Scaling

-   If `SOCKET_AUTH_TOKEN` is set in the env, the server requires the same token on handshake (query param or `auth.token` for socket.io clients).
-   For multi-instance deployments, use a socket.io adapter such as `socket.io-redis` to broadcast events between instances.

## Tests

-   Unit test: `test/socketClient.test.ts` validates that a client receives `log:new` when `POST /emit-log` is called.
-   E2E: `test/e2e/socket-log-stream.spec.ts` verifies the browser UI shows a log emitted by the socket server.
