import emailjs from "@emailjs/browser";

export type Attachment = { name: string; mime: string; b64: string };

function blobToBase64(blob: Blob): Promise<string> {
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
    // convert attachments to sizes for logging/debug purposes
    const sizes = await Promise.all(
      files.map(async (f) => ({ name: f.name, size: f.blob.size || 0 }))
    );
    // emulate network delay
    await new Promise((res) => setTimeout(res, 500));
    console.info('[emailService] Demo send: recipients=', recipients, 'subject=', subject, 'attachments=', sizes);
    return { status: 'demo', ok: true } as any;
  }

  if (!serviceId || !templateId || !publicKey) {
    throw new Error("EmailJS configuration not found (VITE_EMAILJS_*). Please configure serviceId/templateId/publicKey.");
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
