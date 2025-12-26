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

  constructor(url?: string) {
    const envPort = (typeof import.meta !== 'undefined' && (import.meta.env as any)?.VITE_SOCKET_PORT) ? String((import.meta.env as any).VITE_SOCKET_PORT) : '9150';
    this.url = url || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:${envPort}` : 'http://localhost:9150');
  }

  connect(token?: string, opts?: { transports?: string[] }) {
    this.token = token;
    if (this.socket) return;
    this.socket = io(this.url, {
      auth: { token },
      transports: opts?.transports || ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });
    // attach basic logging for debugging    console.info('[socketClient] connecting to', this.url);    this.socket.on('connect', () => { console.info('[socketClient] connected', this.socket?.id); });
    this.socket.on('disconnect', (reason) => { console.info('[socketClient] disconnected', reason); });
  }

  on(event: SocketEvent, handler: (payload?: any) => void) {
    // If socket isn't created yet, create it so handlers are registered reliably
    if (!this.socket) this.connect(this.token);
    this.socket?.on(event, handler);
  }

  off(event: SocketEvent, handler?: (payload?: any) => void) {
    if (!this.socket) return;
    if (handler) this.socket.off(event, handler);
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
}

export const socketClient = new SocketClient();
export default socketClient;
