// Kumpulan kunci localStorage yang digunakan aplikasi
// Tujuan: mencegah string literal tersebar dan memudahkan migrasi jika kunci perlu diubah
export const STORAGE_KEY_PROYEK = "api_sim_projects";
export const STORAGE_KEY_MOCKS = "api_sim_mocks";
export const STORAGE_KEY_PROYEK_AKTIF = "api_sim_active_project";
export const STORAGE_KEY_VARIABEL_LINGKUNGAN = "api_sim_env_vars";

// Kunci fitur (legacy aliases masih dibaca oleh featureFlags.ts)
export const STORAGE_KEY_FITUR_EMAIL = "feature_email_export"; // Legacy key untuk fitur ekspor email
