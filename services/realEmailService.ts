import emailjs from '@emailjs/browser';
import { STORAGE_KEYS } from '../constants';

export interface EmailJSConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

export interface RealEmailRequest {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
}

export interface RealEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Initialize EmailJS
export function initEmailJS(config: EmailJSConfig): boolean {
  try {
    emailjs.init(config.publicKey);
    return true;
  } catch (error) {
    console.error('Failed to initialize EmailJS:', error);
    return false;
  }
}

// Send real email via EmailJS
export async function sendRealEmail(
  request: RealEmailRequest,
  config: EmailJSConfig
): Promise<RealEmailResponse> {
  try {
    // Validate config
    if (!config.serviceId || !config.templateId || !config.publicKey) {
      return {
        success: false,
        error: 'EmailJS configuration is incomplete'
      };
    }

    // EmailJS template parameters
    const templateParams = {
      to_email: request.to,
      from_name: request.fromName || 'Backend Studio',
      subject: request.subject,
      message: request.body,
      to_name: request.to.split('@')[0] // Extract name from email
    };

    const response = await emailjs.send(
      config.serviceId,
      config.templateId,
      templateParams,
      config.publicKey
    );

    return {
      success: true,
      messageId: response.text
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.text || error.message || 'Failed to send email'
    };
  }
}

// Get EmailJS config from localStorage
export function getEmailJSConfig(): EmailJSConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.EMAILJS_CONFIG);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

// Save EmailJS config to localStorage
export function saveEmailJSConfig(config: EmailJSConfig): void {
  localStorage.setItem(STORAGE_KEYS.EMAILJS_CONFIG, JSON.stringify(config));
}

// Validate EmailJS config
export function validateEmailJSConfig(config: Partial<EmailJSConfig>): string[] {
  const errors: string[] = [];
  
  if (!config.serviceId?.trim()) {
    errors.push('Service ID is required');
  }
  
  if (!config.templateId?.trim()) {
    errors.push('Template ID is required');
  }
  
  if (!config.publicKey?.trim()) {
    errors.push('Public Key is required');
  }
  
  return errors;
}