/*
 * Wrapper berbahasa Indonesia untuk fungsi-fungsi publik.
 * Tujuan: memperkenalkan nama-nama deskriptif dalam Bahasa Indonesia
 * tanpa memutuskan eksport lama (non-breaking).
 */
import { sendEmailViaEmailJS } from "./emailService";

export async function kirimEmailDenganEmailJS(
  serviceId: string | undefined,
  templateId: string | undefined,
  publicKey: string | undefined,
  recipients: string,
  subject: string,
  message: string,
  attachments: { name: string; blob?: Blob }[] = []
) {
  // Hanya meneruskan ke implementasi yang ada. Memungkinkan penambahan logging/telemetry
  return sendEmailViaEmailJS(serviceId || "", templateId || "", publicKey || "", recipients, subject, message, attachments as any);
}

// Ekspor alias lama tidak diubah di sini; konsumen masih dapat mengimpornya dari ./emailService
