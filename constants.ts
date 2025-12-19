// Storage keys for localStorage
export const STORAGE_KEYS = {
  // Core app data
  PROJECTS: 'api_sim_projects',
  MOCKS: 'api_sim_mocks',
  ENV_VARS: 'api_sim_env_vars',
  LOGS: 'api_sim_logs',
  ACTIVE_PROJECT: 'api_sim_active_project',
  
  // Email system
  EMAIL_OUTBOX: 'api_sim_email_outbox',
  EMAIL_INBOX: 'api_sim_email_inbox',
  
  // Configuration
  USER_GEMINI_KEY: 'api_sim_user_gemini_key',
  EMAILJS_CONFIG: 'api_sim_emailjs_config',
  
  // Feature flags
  MIGRATED: 'api_sim_migrated',
  PERSIST_CHECKED: 'api_sim_persist_checked'
} as const;

// Email system constants
export const EMAIL_CONSTANTS = {
  DEFAULT_FROM_NAME: 'Backend Studio',
  DEFAULT_FROM_EMAIL: 'noreply@backend.studio',
  SUCCESS_RATE: 0.95, // 95% success rate for simulation
  STATUS_TRANSITIONS: {
    QUEUED_TO_SENDING: 500, // ms
    SENDING_TO_DELIVERED: 1500 // ms
  }
} as const;

// API endpoints
export const API_ENDPOINTS = {
  EMAIL_SEND: '/api/email/send',
  EMAIL_STATUS: '/api/email/status',
  EMAIL_INBOX: '/api/email/inbox',
  EMAIL_STREAM: '/api/email/stream'
} as const;