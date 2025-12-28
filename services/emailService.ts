import emailjs from "@emailjs/browser";

export type Attachment = { name: string; mime: string; b64: string };

const MAX_ATTACHMENT_BYTES = 1_000_000; // 1MB per file
const MAX_TOTAL_BYTES = 5_000_000; // 5MB total attachments

function blobToBase64(blob: Blob): Promise<string> {
  if (blob.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment too large: ${blob.size} bytes (limit ${MAX_ATTACHMENT_BYTES} bytes). Please use smaller files.`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is like "data:application/json;base64,XXXXX" - keep the full data URL
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function sendEmailViaEmailJS(
  serviceId: string,
  templateId: string,
  publicKey: string,
  recipients: string,
  subject: string,
  message: string,
  files: { name: string; blob: Blob }[] = []
) {
  // Demo mode: allow testing in development without real EmailJS credentials
  const demoMode = ((typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined' && (import.meta as any).env.VITE_EMAILJS_DEMO === 'true') || process.env.VITE_EMAILJS_DEMO === 'true');
  if (demoMode) {
    // Avoid logging sensitive info like full recipient lists or attachment data.
    // Log only counts and total sizes so devs can validate behaviour without leaking data.
    const totalSize = files.reduce((s, f) => s + (f.blob.size || 0), 0);
    // emulate network delay
    await new Promise((res) => setTimeout(res, 500));
    console.info('[emailService] Demo send: recipients_count=', recipients ? recipients.split(/[;,\s]+/).filter(Boolean).length : 0, 'attachments_count=', files.length, 'attachments_total_bytes=', totalSize);
    return { status: 'demo', ok: true } as any;
  }

  if (!serviceId || !templateId || !publicKey) {
    throw new Error("EmailJS configuration not found (VITE_EMAILJS_*). Please configure serviceId/templateId/publicKey, or enable demo mode for local testing.");
  }

  // Enforce total size limits early
  const totalSize = files.reduce((s, f) => s + (f.blob.size || 0), 0);
  if (totalSize > MAX_TOTAL_BYTES) {
    throw new Error(`Total attachments size too large: ${totalSize} bytes (limit ${MAX_TOTAL_BYTES} bytes). Reduce attachment sizes or number of attachments.`);
  }

  const attachments: Attachment[] = [];
  for (const f of files) {
    const dataUrl = await blobToBase64(f.blob);
    attachments.push({ name: f.name, mime: f.blob.type || "application/octet-stream", b64: dataUrl });
  }

  // Prepare template params. EmailJS templates can access these variables.
  const templateParams = {
    to_email: recipients,
    subject,
    message,
    attachments: JSON.stringify(attachments),
  };

  try {
    const res = await emailjs.send(serviceId, templateId, templateParams, publicKey);
    return res;
  } catch (err: any) {
    // Normalize error
    const msg = err?.text || err?.message || "Failed to send email";
    throw new Error(msg);
  }
}
