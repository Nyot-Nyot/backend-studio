import { EnvironmentVariable, MockEndpoint, Project } from "../types";
import { createZipBlob } from "./zipService";

// Batas total lampiran sebelum gagal (20 MB)
export const MAKS_BYTES_LAMPIRAN_EMAIL = 20 * 1024 * 1024;

export type LampiranFile = { name: string; blob: Blob };

/**
 * siapkanLampiranExport - membuat daftar file lampiran berdasarkan opsi pengguna.
 * - Tidak melakukan upload atau mutate state; hanya mengembalikan daftar file (name/blob).
 * - Memperhatikan opsi includeWorkspace/includeOpenApi/includeServer.
 */
export async function siapkanLampiranExport(options: {
  includeWorkspace: boolean;
  includeOpenApi: boolean;
  includeServer: boolean;
  proyek: Project[];
  rute: MockEndpoint[];
  variabelLingkungan: EnvironmentVariable[];
  proyekAktifId?: string;
}) {
  const { includeWorkspace, includeOpenApi, includeServer, proyek, rute, variabelLingkungan, proyekAktifId } = options;
  const files: LampiranFile[] = [];
  if (includeWorkspace) {
    files.push({
      name: `backend-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
      blob: new Blob([JSON.stringify({ version: "1.0", timestamp: Date.now(), proyek, rute, variabelLingkungan }, null, 2)], { type: "application/json" }),
    });
  }
  if (includeOpenApi) {
    if (proyekAktifId) {
      // Generate OpenAPI spec secara ringan: konsumen harus memanggil generateOpenApiSpec sendiri jika perlu
      // Untuk kompatibilitas, caller dapat memanggil generateOpenApiSpec dan menambahkan file langsung.
    }
  }
  if (includeServer) {
    // Caller harus menyediakan kode server (generateServerCode) agar fungsi ini tidak bergantung pada konteks App
  }
  return files;
}

/**
 * bungkusMenjadiZipJikaPerlu - jika lebih dari satu file, bungkus menjadi zip tunggal.
 * Mengembalikan array file: jika satu file asli, kembalikan seperti semula;
 * jika lebih dari satu, buat file zip dengan nama yang sesuai.
 */
export async function bungkusMenjadiZipJikaPerlu(files: LampiranFile[]) {
  if (files.length <= 1) return files;
  const zipBlob = (await createZipBlob(files)) as Blob;
  return [{ name: `backend-studio-export-${new Date().toISOString().slice(0, 10)}.zip`, blob: zipBlob }];
}

export function totalUkuranBytes(files: LampiranFile[]) {
  return files.reduce((s, f) => s + ((f.blob as Blob).size || 0), 0);
}

export function validasiUkuranLampiran(files: LampiranFile[]) {
  const total = totalUkuranBytes(files);
  if (total > MAKS_BYTES_LAMPIRAN_EMAIL) throw new Error("Attachments exceed 20 MB limit. Reduce attachment size.");
}
