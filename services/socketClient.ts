import { io, Socket } from 'socket.io-client';

export type LogPayload = {
  id?: string;
  workspaceId?: string;
  source?: string;
  level?: string;
  message?: string;
  ts?: number;
  [k: string]: any;
};

export type SocketEvent = 'log:new' | 'connect' | 'disconnect' | string;

export class SocketClient {
  private socket: Socket | null = null;
  private url: string;
  private token?: string;
  private debug: boolean;
  private pendingHandlers: Map<string, Set<(p?: any) => void>> = new Map();
  private ioFactory: (url: string, opts?: any) => Socket;

  constructor(url?: string, opts?: { ioFactory?: (url: string, opts?: any) => Socket; debug?: boolean }) {
    const envPort = (typeof import.meta !== 'undefined' && (import.meta.env as any)?.VITE_SOCKET_PORT) ? String((import.meta.env as any).VITE_SOCKET_PORT) : '9150';
    const envUrl = (typeof import.meta !== 'undefined' && (import.meta.env as any)?.VITE_SOCKET_URL) ? String((import.meta.env as any).VITE_SOCKET_URL) : undefined;
    this.url = url || envUrl || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:${envPort}` : 'http://localhost:9150');
    this.debug = opts?.debug ?? (typeof process !== 'undefined' && !!(process.env && process.env.DEBUG_SOCKET));
    this.ioFactory = opts?.ioFactory ?? ((u: string, o?: any) => (io as any)(u, o));
  }

  // connect returns the socket instance (or existing socket) so callers can inspect it.
  connect(token?: string, opts?: { transports?: string[] }) {
    this.token = token;
    if (this.socket) {
      if (this.debug) console.info('[socketClient] connect() called but socket already exists - returning existing socket');
      return this.socket;
    }

    if (this.debug) console.info('[socketClient] connecting to', this.url);

    this.socket = this.ioFactory(this.url, {
      auth: { token },
      transports: opts?.transports || ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });

    // Attach queued handlers
    for (const [ev, set] of this.pendingHandlers.entries()) {
      for (const h of set) {
        this.socket.on(ev, h);
      }
    }
    this.pendingHandlers.clear();

    if (this.debug) this.socket.on('connect', () => { console.info('[socketClient] connected', this.socket?.id); });
    if (this.debug) this.socket.on('disconnect', (reason: any) => { console.info('[socketClient] disconnected', reason); });

    return this.socket;
  }

  on(event: SocketEvent, handler: (payload?: any) => void) {
    // If socket isn't created yet, queue handlers to be attached when connect() runs
    if (!this.socket) {
      let set = this.pendingHandlers.get(event);
      if (!set) {
        set = new Set();
        this.pendingHandlers.set(event, set);
      }
      set.add(handler);
      // ensure we don't silently lose handlers; optionally kick off connect if token exists
      return;
    }
    this.socket.on(event, handler);
  }

  off(event: SocketEvent, handler?: (payload?: any) => void) {
    // remove from pending handlers first
    const pset = this.pendingHandlers.get(event as string);
    if (pset) {
      if (handler) pset.delete(handler as any);
      else this.pendingHandlers.delete(event as string);
    }

    if (!this.socket) return;
    if (handler) this.socket.off(event, handler as any);
    else this.socket.removeAllListeners(event);
  }

  emit(event: string, payload?: any) {
    this.socket?.emit(event, payload);
  }

  join(room: string) {
    this.socket?.emit('join', room);
  }

  leave(room: string) {
    this.socket?.emit('leave', room);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected() {
    return !!(this.socket && this.socket.connected);
  }

  // Expose a lightweight status method
  getStatus() {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    return 'connecting';
  }
}

export const socketClient = new SocketClient();
export default socketClient;
