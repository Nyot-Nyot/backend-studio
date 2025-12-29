// klienSocket.ts
// Klien untuk menghubungkan dan berkomunikasi dengan server menggunakan Socket.IO

import { io, Socket } from 'socket.io-client';

/**
 * Tipe data untuk muatan log yang dikirim melalui socket
 */
export type MuatanLog = {
  id?: string;
  workspaceId?: string;
  source?: string;
  level?: string;
  message?: string;
  ts?: number;
  [k: string]: any;
};

/**
 * Tipe untuk event socket yang didukung
 */
export type PeristiwaSocket = 'log:new' | 'connect' | 'disconnect' | string;

/**
 * Kelas KlienSocket untuk mengelola koneksi dan komunikasi socket
 *
 * @contohPenggunaan
 * ```
 * const klien = new KlienSocket();
 * klien.sambungkan('token-auth');
 * klien.pasangPendengar('log:new', (data) => console.log(data));
 * ```
 */
export class KlienSocket {
  private soket: Socket | null = null;
  private urlServer: string;
  private token?: string;
  private modeDebug: boolean;
  private penanganTertunda: Map<string, Set<(muatan?: any) => void>> = new Map();
  private pabrikIo: (url: string, opsi?: any) => Socket;

  /**
   * Konstruktor untuk membuat instance KlienSocket
   * @param url - URL server socket (opsional, akan menggunakan environment variable jika tidak disediakan)
   * @param opsi - Opsi konfigurasi tambahan
   *
   * @contohPenggunaan
   * ```
   * // Dengan URL kustom
   * const klien = new KlienSocket('http://localhost:3000', { modeDebug: true });
   *
   * // Menggunakan default dari environment variable
   * const klien = new KlienSocket();
   * ```
   */
  constructor(url?: string, opsi?: { pabrikIo?: (url: string, opsi?: any) => Socket; modeDebug?: boolean }) {
    // Mendapatkan port socket dari environment variable atau default ke 9150
    const portEnv = (typeof import.meta !== 'undefined' && (import.meta.env as any)?.VITE_SOCKET_PORT)
      ? String((import.meta.env as any).VITE_SOCKET_PORT)
      : '9150';

    // Mendapatkan URL socket dari environment variable
    const urlEnv = (typeof import.meta !== 'undefined' && (import.meta.env as any)?.VITE_SOCKET_URL)
      ? String((import.meta.env as any).VITE_SOCKET_URL)
      : undefined;

    // Tentukan URL server: prioritas parameter > environment variable > default
    this.urlServer = url || urlEnv ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:${portEnv}`
        : 'http://localhost:9150');

    // Tentukan mode debug: prioritas parameter > environment variable > default false
    this.modeDebug = opsi?.modeDebug ??
      (typeof process !== 'undefined' && !!(process.env && process.env.DEBUG_SOCKET));

    // Factory untuk membuat instance Socket.IO (default menggunakan library asli)
    this.pabrikIo = opsi?.pabrikIo ?? ((url: string, opsi?: any) => (io as any)(url, opsi));
  }

  /**
   * Menyambungkan ke server socket
   * @param token - Token autentikasi (opsional)
   * @param opsi - Opsi koneksi tambahan
   * @returns Instance socket yang terhubung
   *
   * @catatan
   * - Jika sudah terhubung, akan mengembalikan socket yang ada
   * - Handler yang tertunda akan dipasang setelah koneksi terbentuk
   */
  sambungkan(token?: string, opsi?: { transport?: string[] }): Socket | null {
    this.token = token;

    // Jika sudah terhubung, kembalikan instance yang ada
    if (this.soket) {
      if (this.modeDebug) {
        console.info('[klienSocket] sambungkan() dipanggil tetapi soket sudah ada - mengembalikan soket yang ada');
      }
      return this.soket;
    }

    if (this.modeDebug) {
      console.info('[klienSocket] menyambungkan ke', this.urlServer);
    }

    // Buat instance soket baru
    this.soket = this.pabrikIo(this.urlServer, {
      auth: { token },
      transports: opsi?.transport || ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });

    // Pasang semua handler yang tertunda
    for (const [peristiwa, daftarHandler] of this.penanganTertunda.entries()) {
      for (const handler of daftarHandler) {
        this.soket.on(peristiwa, handler);
      }
    }
    this.penanganTertunda.clear();

    // Handler untuk debugging jika mode debug aktif
    if (this.modeDebug) {
      this.soket.on('connect', () => {
        console.info('[klienSocket] terhubung', this.soket?.id);
      });

      this.soket.on('disconnect', (alasan: any) => {
        console.info('[klienSocket] terputus', alasan);
      });
    }

    return this.soket;
  }

  /**
   * Memasang pendengar untuk event tertentu
   * @param peristiwa - Nama event yang didengarkan
   * @param handler - Fungsi yang akan dipanggil ketika event terjadi
   *
   * @catatan
   * - Jika soket belum dibuat, handler akan disimpan dan dipasang nanti saat koneksi
   */
  pasangPendengar(peristiwa: PeristiwaSocket, handler: (muatan?: any) => void): void {
    // Jika soket belum dibuat, simpan handler untuk dipasang nanti
    if (!this.soket) {
      let kumpulanHandler = this.penanganTertunda.get(peristiwa);
      if (!kumpulanHandler) {
        kumpulanHandler = new Set();
        this.penanganTertunda.set(peristiwa, kumpulanHandler);
      }
      kumpulanHandler.add(handler);
      return;
    }

    // Langsung pasang handler jika soket sudah ada
    this.soket.on(peristiwa, handler);
  }

  /**
   * Melepaskan pendengar untuk event tertentu
   * @param peristiwa - Nama event
   * @param handler - Handler spesifik yang akan dilepas (opsional, jika tidak ada maka semua handler untuk event tersebut akan dilepas)
   */
  lepaskanPendengar(peristiwa: PeristiwaSocket, handler?: (muatan?: any) => void): void {
    // Hapus dari daftar handler tertunda terlebih dahulu
    const kumpulanTertunda = this.penanganTertunda.get(peristiwa as string);
    if (kumpulanTertunda) {
      if (handler) {
        kumpulanTertunda.delete(handler as any);
      } else {
        this.penanganTertunda.delete(peristiwa as string);
      }
    }

    // Jika soket belum ada, tidak ada yang perlu dilakukan
    if (!this.soket) return;

    // Lepaskan handler dari soket
    if (handler) {
      this.soket.off(peristiwa, handler as any);
    } else {
      this.soket.removeAllListeners(peristiwa);
    }
  }

  /**
   * Mengirim event ke server
   * @param peristiwa - Nama event yang dikirim
   * @param muatan - Data yang dikirim bersama event (opsional)
   */
  kirimEvent(peristiwa: string, muatan?: any): void {
    this.soket?.emit(peristiwa, muatan);
  }

  /**
   * Bergabung ke ruangan (room) tertentu
   * @param ruangan - Nama ruangan yang akan diikuti
   */
  gabungRuangan(ruangan: string): void {
    this.soket?.emit('join', ruangan);
  }

  /**
   * Meninggalkan ruangan (room) tertentu
   * @param ruangan - Nama ruangan yang akan ditinggalkan
   */
  tinggalkanRuangan(ruangan: string): void {
    this.soket?.emit('leave', ruangan);
  }

  /**
   * Memutuskan koneksi dari server
   *
   * @catatan
   * - Setelah dipanggil, semua pendengar akan dihapus
   * - Instance soket akan diatur menjadi null
   */
  putuskan(): void {
    this.soket?.disconnect();
    this.soket = null;
  }

  /**
   * Memeriksa apakah klien terhubung ke server
   * @returns boolean - true jika terhubung, false jika tidak
   */
  apakahTerhubung(): boolean {
    return !!(this.soket && this.soket.connected);
  }

  /**
   * Mendapatkan status koneksi saat ini
   * @returns Status koneksi dalam bentuk string
   *
   * @nilaiKembalian
   * - 'terhubung' jika soket aktif dan terhubung
   * - 'menyambungkan' jika soket ada tetapi belum terhubung
   * - 'terputus' jika tidak ada soket
   */
  dapatkanStatus(): 'terhubung' | 'menyambungkan' | 'terputus' {
    if (!this.soket) return 'terputus';
    if (this.soket.connected) return 'terhubung';
    return 'menyambungkan';
  }

  // --- English-shaped aliases for compatibility with older modules ---
  connect(token?: string, opsi?: { transport?: string[] }): Socket | null {
    return this.sambungkan(token, opsi);
  }

  disconnect(): void {
    return this.putuskan();
  }

  isConnected(): boolean {
    return this.apakahTerhubung();
  }

  emit(event: string, muatan?: any): void {
    return this.kirimEvent(event, muatan);
  }

  on(event: PeristiwaSocket | string, handler: (payload?: any) => void): void {
    return this.pasangPendengar(event as PeristiwaSocket, handler);
  }

  off(event: PeristiwaSocket | string, handler?: (payload?: any) => void): void {
    return this.lepaskanPendengar(event as PeristiwaSocket, handler);
  }

  join(room: string): void {
    return this.gabungRuangan(room);
  }

  leave(room: string): void {
    return this.tinggalkanRuangan(room);
  }
}

/**
 * Instance default klien socket untuk digunakan di seluruh aplikasi
 *
 * @contohPenggunaan
 * ```
 * import klienSocket from './klienSocket';
 *
 * klienSocket.sambungkan('token-auth');
 * klienSocket.pasangPendengar('log:new', (data) => {
 *   console.log('Log baru:', data);
 * });
 * ```
 */
export const klienSocket = new KlienSocket();
export default klienSocket;
