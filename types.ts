/**
 * Tipe data untuk aplikasi Backend Studio.
 * Mendefinisikan struktur data utama yang digunakan di seluruh aplikasi.
 */

// ================================
// ENUMERASI
// ================================

/**
 * Metode HTTP yang didukung oleh aplikasi.
 * Digunakan untuk menentukan jenis permintaan API.
 */
export enum MetodeHttp {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

// ================================
// TIPE DATA UTAMA
// ================================

/**
 * Representasi proyek atau workspace dalam aplikasi.
 * Setiap proyek berisi kumpulan endpoint mock yang terkait.
 */
export interface Proyek {
  id: string;
  nama: string;
  createdAt: number; // Timestamp dalam milidetik
}

/**
 * Konfigurasi autentikasi untuk endpoint.
 * Menentukan jenis dan parameter autentikasi yang diperlukan.
 */
export interface KonfigurasiAutentikasi {
  jenis: 'NONE' | 'BEARER_TOKEN' | 'API_KEY';
  token?: string;      // Nilai token/kunci yang diharapkan
  headerKey?: string;  // Kunci header kustom untuk jenis API_KEY (contoh: 'x-api-key')
}

/**
 * Konfigurasi proxy untuk meneruskan permintaan ke server eksternal.
 */
export interface KonfigurasiProxy {
  enabled: boolean;
  target?: string; // URL lengkap untuk meneruskan permintaan (contoh: https://api.contoh.com)
  timeout?: number; // dalam milidetik
  fallbackToMock?: boolean; // jika true, kembalikan ke mock lokal jika proxy gagal
}

/**
 * Variabel lingkungan yang dapat digunakan dalam response mock.
 * Mendukung substitusi dengan sintaks {{nama_variabel}}.
 */
export interface VariabelLingkungan {
  id: string;
  kunci: string;
  nilai: string;
}

/**
 * Endpoint mock yang mensimulasikan API.
 * Merupakan konfigurasi utama untuk setiap route yang dibuat pengguna.
 */
export interface MockEndpoint {
  id: string;
  projectId: string; // Tautan ke Proyek
  nama: string;
  path: string;
  metode: MetodeHttp;
  statusCode: number;
  delay: number; // dalam milidetik
  responseBody: string; // String JSON
  isActive: boolean;
  versi: string;
  createdAt: number;
  requestCount: number;
  headers: { key: string; value: string }[];
  storeName?: string; // Jika diatur, endpoint ini berinteraksi dengan bucket data
  authConfig?: KonfigurasiAutentikasi; // Validasi autentikasi bawaan
  proxy?: KonfigurasiProxy; // Konfigurasi proxy passthrough opsional per-route
}

/**
 * Konfigurasi endpoint yang dihasilkan oleh layanan AI.
 * Digunakan saat membuat endpoint secara otomatis.
 */
export interface KonfigurasiEndpointTerhasil {
  nama: string;
  path: string;
  metode: MetodeHttp | string;
  statusCode: number;
  responseBody: string; // JSON yang telah di-stringify
}

// ================================
// TIPE DATA SCHEMA DAN GENERATOR
// ================================

/**
 * Field dalam resource schema untuk generasi data berbasis schema.
 */
export interface FieldResource {
  nama: string;
  tipe: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  generator?: string; // contoh: 'uuid', 'randomName', 'email', 'number'
  nestedSchemaId?: string; // referensi ke ResourceSchema lain untuk object/array bersarang
}

/**
 * Schema resource untuk generasi data terstruktur.
 * Mendefinisikan struktur data yang dapat digunakan untuk mock data yang realistis.
 */
export interface SchemaResource {
  id: string;
  nama: string; // contoh: 'pengguna'
  fields: FieldResource[];
}

// ================================
// TIPE DATA LOGGING
// ================================

/**
 * Entri log yang mencatat permintaan dan response.
 * Digunakan untuk melacak aktivitas API.
 */
export interface EntriLog {
  id: string;
  timestamp: number;
  metode: MetodeHttp;
  path: string;
  statusCode: number;
  ip: string;
  duration: number; // durasi dalam milidetik
}

// Alias kompatibilitas: tipe log dengan nama bahasa Inggris (dipakai di beberapa komponen)
export type LogEntry = EntriLog;

// ================================
// TIPE DATA TESTING
// ================================

/**
 * State response untuk konsol pengujian.
 * Menyimpan hasil dari permintaan pengujian.
 */
export interface StateResponse {
  status: number;
  body: string;
  time: number;
  headers: { key: string; value: string }[];
  error?: string;
}

/**
 * State untuk konsol pengujian.
 * Menyimpan konfigurasi dan hasil pengujian manual.
 */
export interface StateKonsolPengujian {
  metode: MetodeHttp;
  path: string;
  response: StateResponse | null;
  body?: string; // Untuk permintaan POST/PUT dalam konsol
}

// ================================
// TIPE DATA UI DAN NAVIGASI
// ================================

/**
 * State tampilan aktif dalam aplikasi.
 * Menentukan halaman mana yang sedang ditampilkan.
 */
export type StateTampilan = 'dashboard' | 'editor' | 'logs' | 'settings' | 'test' | 'database';

// --- Alias ekspor untuk kompatibilitas (nama Inggris) ---
// Beberapa modul (komponen) masih mengimpor nama bahasa Inggris seperti `HttpMethod`.
// Menyediakan alias membuat perubahan ini kecil dan aman.
export { MetodeHttp as HttpMethod };
export type { Proyek as Project, StateTampilan as ViewState };
// Alias untuk konfigurasi autentikasi (kompatibilitas)
export type AuthConfig = KonfigurasiAutentikasi;

// Alias untuk konsol uji (nama Inggris yang dipakai di beberapa komponen)
export type TestConsoleState = StateKonsolPengujian;

/**
 * Tipe untuk toast notifikasi.
 * Menentukan kategori pesan yang ditampilkan.
 */
export type TipeToast = 'success' | 'error' | 'info' | 'warning';

/**
 * Pesan toast yang ditampilkan kepada pengguna.
 * Digunakan untuk komunikasi status dan notifikasi.
 */
export interface PesanToast {
  id: string;
  pesan: string;
  tipe: TipeToast;
  durasi?: number; // durasi dalam milidetik (opsional)
}

// ================================
// TIPE DATA SCENARIO (ALUR KERJA)
// ================================

/**
 * Payload untuk langkah memanggil API dalam scenario.
 */
export interface PayloadPanggilApi {
  url: string;
  metode: MetodeHttp;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * Payload untuk langkah emit socket dalam scenario.
 */
export interface PayloadEmitSocket {
  event: string;
  data?: unknown;
}

/**
 * Payload untuk langkah wait dalam scenario.
 */
export interface PayloadTunggu {
  duration: number; // dalam milidetik
}

/**
 * Langkah dasar dalam scenario.
 * Semua langkah scenario mewarisi dari tipe ini.
 */
export interface LangkahScenarioDasar {
  id: string;
  delay?: number; // penundaan sebelum eksekusi (dalam ms)
}

/**
 * Langkah scenario untuk memanggil API.
 */
export interface LangkahPanggilApi extends LangkahScenarioDasar {
  tipe: 'callApi';
  payload: PayloadPanggilApi;
}

/**
 * Langkah scenario untuk mengirim event socket.
 */
export interface LangkahEmitSocket extends LangkahScenarioDasar {
  tipe: 'emitSocket';
  payload: PayloadEmitSocket;
}

/**
 * Langkah scenario untuk menunggu.
 */
export interface LangkahTunggu extends LangkahScenarioDasar {
  tipe: 'wait';
  payload: PayloadTunggu;
}

/**
 * Langkah scenario tanpa operasi (placeholder).
 */
export interface LangkahNoop extends LangkahScenarioDasar {
  tipe: 'noop';
  payload?: undefined;
}

/**
 * Union type untuk semua jenis langkah scenario.
 * Digunakan untuk menentukan langkah-langkah dalam scenario.
 */
export type LangkahScenario =
  | LangkahPanggilApi
  | LangkahEmitSocket
  | LangkahTunggu
  | LangkahNoop;

/**
 * Scenario yang mendefinisikan alur kerja otomatis.
 * Digunakan untuk testing otomatis atau simulasi alur bisnis.
 */
export interface Scenario {
  id: string;
  nama: string;
  deskripsi?: string;
  createdAt: number;
  updatedAt?: number;
  steps: LangkahScenario[];
}

/**
 * Log untuk setiap langkah scenario yang dieksekusi.
 * Mencatat status dan output dari eksekusi langkah.
 */
export interface LogLangkahScenario<T = unknown> {
  stepId: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'success' | 'failed';
  /**
   * Output bisa berupa nilai serializable apa pun yang dihasilkan langkah.
   */
  output?: T;
  error?: string;
}

/**
 * Eksekusi scenario yang berjalan.
 * Menyimpan status dan log untuk semua langkah dalam eksekusi scenario.
 */
export interface EksekusiScenario<T = unknown> {
  id: string;
  scenarioId: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'completed' | 'failed';
  stepLogs: LogLangkahScenario<T>[];
}

// ================================
// TIPE DATA KONEKTOR
// ================================

/**
 * Konektor untuk integrasi dengan layanan eksternal.
 * Mendukung berbagai jenis konektor dengan konfigurasi spesifik.
 */
export interface Konektor<C extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  nama: string;
  tipe: string;
  /** Konfigurasi konektor spesifik; gunakan generic untuk mengetiknya per-konektor */
  config?: C;
  createdAt: number;
}

// ================================
// TIPE DATA EKSPOR (UNTUK KEMUDIAH IMPOR)
// ================================

/**
 * Struktur data untuk ekspor/import workspace.
 * Memastikan format yang konsisten untuk backup dan restore.
 */
export interface DataWorkspaceEkspor {
  versi: string;
  timestamp: number;
  projects: Proyek[];
  mocks: MockEndpoint[];
  envVars: VariabelLingkungan[];
}

/**
 * Parameter untuk modal ekspor email.
 * Digunakan saat mengirim konfigurasi via email.
 */
export interface ParameterEksporEmail {
  recipients: string[];
  subject: string;
  message: string;
  includeWorkspace: boolean;
  includeOpenApi: boolean;
  includeServer: boolean;
}
