export interface EmailMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: 'queued' | 'sending' | 'delivered' | 'failed';
  trace: string[];
  createdAt: number;
  updatedAt: number;
}

export interface EmailSendRequest {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSendResponse {
  messageId: string;
  status: 'queued';
  trace: string[];
}

export interface EmailStatusResponse {
  messageId: string;
  status: EmailMessage['status'];
  updatedAt: number;
  trace: string[];
}

// SMTP-like protocol trace generator
export function generateSMTPTrace(to: string): string[] {
  return [
    "220 backend.studio ESMTP Service Ready",
    "HELO backend.studio",
    "250 backend.studio Hello",
    "MAIL FROM:<noreply@backend.studio>",
    "250 OK",
    `RCPT TO:<${to}>`,
    "250 OK",
    "DATA",
    "354 Enter message, ending with '.' on a line by itself",
    ". (message body transmitted)",
    "250 OK: queued as " + crypto.randomUUID().substring(0, 8),
    "QUIT",
    "221 backend.studio closing connection"
  ];
}

// Email validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Status progression scheduler (for simulation)
export function scheduleStatusUpdate(messageId: string, callback: (id: string, status: EmailMessage['status']) => void) {
  // queued → sending (500ms)
  setTimeout(() => {
    if (import.meta.env?.DEV) {
      console.log('Email status update:', messageId, 'sending');
    }
    callback(messageId, 'sending');
  }, 500);

  // sending → delivered/failed (1500ms total)
  setTimeout(() => {
    // 95% success rate for simulation (increase success rate)
    const isSuccess = Math.random() > 0.05;
    const finalStatus = isSuccess ? 'delivered' : 'failed';
    if (import.meta.env?.DEV) {
      console.log('Email status update:', messageId, finalStatus);
    }
    callback(messageId, finalStatus);
  }, 1500);
}