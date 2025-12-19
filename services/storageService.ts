import { STORAGE_KEYS } from '../constants';
import { EmailMessage, EnvironmentVariable, LogEntry, MockEndpoint, Project } from '../types';
import { IndexedDBService, STORES, isIndexedDBAvailable } from './indexedDB';
import { getMigrationStatus, runMigration, shouldRunMigration } from './migration';

// Storage backend type
type StorageBackend = 'localStorage' | 'indexedDB';

// Unified storage service that abstracts localStorage vs IndexedDB
export class StorageService {
  private static backend: StorageBackend = 'localStorage';
  private static migrationCompleted = false;

  // Initialize storage service
  static async initialize(): Promise<void> {
    const migrationStatus = getMigrationStatus();

    if (isIndexedDBAvailable()) {
      if (migrationStatus.completed) {
        this.backend = 'indexedDB';
        this.migrationCompleted = true;
        console.log('StorageService: Using IndexedDB (migration completed)');
      } else if (shouldRunMigration()) {
        console.log('StorageService: Starting migration to IndexedDB...');
        try {
          const result = await runMigration((stage, progress) => {
            console.log(`Migration: ${stage} (${progress}%)`);
          });

          if (result.success) {
            this.backend = 'indexedDB';
            this.migrationCompleted = true;
            console.log(`Migration completed: ${result.totalRecords} records migrated`);
          } else {
            console.warn('Migration failed, continuing with localStorage:', result.errors);
          }
        } catch (error) {
          console.error('Migration error, continuing with localStorage:', error);
        }
      } else {
        // No data to migrate, can use IndexedDB directly
        this.backend = 'indexedDB';
        this.migrationCompleted = true;
        console.log('StorageService: Using IndexedDB (no migration needed)');
      }
    } else {
      console.log('StorageService: Using localStorage (IndexedDB not available)');
    }
  }

  // Get current backend
  static getBackend(): StorageBackend {
    return this.backend;
  }

  static isMigrationCompleted(): boolean {
    return this.migrationCompleted;
  }

  // Projects storage
  static async getProjects(): Promise<Project[]> {
    if (this.backend === 'indexedDB') {
      return IndexedDBService.getAll<Project>(STORES.PROJECTS);
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      return data ? JSON.parse(data) as Project[] : [];
    }
  }

  static async saveProjects(projects: Project[]): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.clear(STORES.PROJECTS);
      await IndexedDBService.putMany<Project>(STORES.PROJECTS, projects);
      // dual-write mirror for backward compatibility
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    } else {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    }
  }

  static async getProject(id: string): Promise<Project | undefined> {
    if (this.backend === 'indexedDB') {
      return IndexedDBService.getById<Project>(STORES.PROJECTS, id);
    } else {
      const projects = await this.getProjects();
      return projects.find(p => p.id === id);
    }
  }

  static async saveProject(project: Project): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.put<Project>(STORES.PROJECTS, project);
      // dual-write
      const projects = await this.getProjects();
      const updated = Array.isArray(projects) ? [...projects.filter(p => p.id !== project.id), project] : [project];
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(updated));
    } else {
      const projects = await this.getProjects();
      const index = projects.findIndex(p => p.id === project.id);
      if (index >= 0) {
        projects[index] = project;
      } else {
        projects.push(project);
      }
      await this.saveProjects(projects);
    }
  }

  static async deleteProject(id: string): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.delete(STORES.PROJECTS, id);
      // dual-write mirror
      const projects = await this.getProjects();
      const filtered = projects.filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(filtered));
    } else {
      const projects = await this.getProjects();
      const filtered = projects.filter(p => p.id !== id);
      await this.saveProjects(filtered);
    }
  }

  // Mocks storage
  static async getMocks(): Promise<MockEndpoint[]> {
    if (this.backend === 'indexedDB') {
      return IndexedDBService.getAll<MockEndpoint>(STORES.MOCKS);
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.MOCKS);
      return data ? JSON.parse(data) as MockEndpoint[] : [];
    }
  }

  static async saveMocks(mocks: MockEndpoint[]): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.clear(STORES.MOCKS);
      await IndexedDBService.putMany<MockEndpoint>(STORES.MOCKS, mocks);
      // dual-write mirror
      localStorage.setItem(STORAGE_KEYS.MOCKS, JSON.stringify(mocks));
    } else {
      localStorage.setItem(STORAGE_KEYS.MOCKS, JSON.stringify(mocks));
    }
  }

  static async getMock(id: string): Promise<MockEndpoint | undefined> {
    if (this.backend === 'indexedDB') {
      return IndexedDBService.getById<MockEndpoint>(STORES.MOCKS, id);
    } else {
      const mocks = await this.getMocks();
      return mocks.find(m => m.id === id);
    }
  }

  static async saveMock(mock: MockEndpoint): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.put<MockEndpoint>(STORES.MOCKS, mock);
      // dual-write mirror
      const mocks = await this.getMocks();
      const updated = Array.isArray(mocks) ? [...mocks.filter(m => m.id !== mock.id), mock] : [mock];
      localStorage.setItem(STORAGE_KEYS.MOCKS, JSON.stringify(updated));
    } else {
      const mocks = await this.getMocks();
      const index = mocks.findIndex(m => m.id === mock.id);
      if (index >= 0) {
        mocks[index] = mock;
      } else {
        mocks.push(mock);
      }
      await this.saveMocks(mocks);
    }
  }

  static async deleteMock(id: string): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.delete(STORES.MOCKS, id);
      // dual-write mirror
      const mocks = await this.getMocks();
      const filtered = mocks.filter(m => m.id !== id);
      localStorage.setItem(STORAGE_KEYS.MOCKS, JSON.stringify(filtered));
    } else {
      const mocks = await this.getMocks();
      const filtered = mocks.filter(m => m.id !== id);
      await this.saveMocks(filtered);
    }
  }

  static async getMocksByProject(projectId: string): Promise<MockEndpoint[]> {
    if (this.backend === 'indexedDB') {
      return IndexedDBService.getByIndex<MockEndpoint>(STORES.MOCKS, 'projectId', projectId);
    } else {
      const mocks = await this.getMocks();
      return mocks.filter(m => m.projectId === projectId);
    }
  }

  // Environment Variables storage
  static async getEnvVars(): Promise<EnvironmentVariable[]> {
    if (this.backend === 'indexedDB') {
      return IndexedDBService.getAll<EnvironmentVariable>(STORES.ENV_VARS);
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.ENV_VARS);
      return data ? JSON.parse(data) as EnvironmentVariable[] : [];
    }
  }

  static async saveEnvVars(envVars: EnvironmentVariable[]): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.clear(STORES.ENV_VARS);
      await IndexedDBService.putMany<EnvironmentVariable>(STORES.ENV_VARS, envVars);
      // dual-write mirror
      localStorage.setItem(STORAGE_KEYS.ENV_VARS, JSON.stringify(envVars));
    } else {
      localStorage.setItem(STORAGE_KEYS.ENV_VARS, JSON.stringify(envVars));
    }
  }

  static async saveEnvVar(envVar: EnvironmentVariable): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.put<EnvironmentVariable>(STORES.ENV_VARS, envVar);
      // dual-write mirror
      const envVars = await this.getEnvVars();
      const updated = Array.isArray(envVars) ? [...envVars.filter(e => e.id !== envVar.id), envVar] : [envVar];
      localStorage.setItem(STORAGE_KEYS.ENV_VARS, JSON.stringify(updated));
    } else {
      const envVars = await this.getEnvVars();
      const index = envVars.findIndex(e => e.id === envVar.id);
      if (index >= 0) {
        envVars[index] = envVar;
      } else {
        envVars.push(envVar);
      }
      await this.saveEnvVars(envVars);
    }
  }

  static async deleteEnvVar(id: string): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.delete(STORES.ENV_VARS, id);
      // dual-write mirror
      const envVars = await this.getEnvVars();
      const filtered = envVars.filter(e => e.id !== id);
      localStorage.setItem(STORAGE_KEYS.ENV_VARS, JSON.stringify(filtered));
    } else {
      const envVars = await this.getEnvVars();
      const filtered = envVars.filter(e => e.id !== id);
      await this.saveEnvVars(filtered);
    }
  }

  // Logs storage
  static async getLogs(): Promise<LogEntry[]> {
    if (this.backend === 'indexedDB') {
      return IndexedDBService.getAll<LogEntry>(STORES.LOGS);
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.LOGS);
      return data ? JSON.parse(data) as LogEntry[] : [];
    }
  }

  static async saveLogs(logs: LogEntry[]): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.clear(STORES.LOGS);
      await IndexedDBService.putMany<LogEntry>(STORES.LOGS, logs);
      // dual-write mirror
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } else {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    }
  }

  static async addLog(log: LogEntry): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.put<LogEntry>(STORES.LOGS, log);
      // dual-write mirror
      const logs = await this.getLogs();
      const updated = Array.isArray(logs) ? [...logs, log] : [log];
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));
    } else {
      const logs = await this.getLogs();
      logs.push(log);
      await this.saveLogs(logs);
    }
  }

  static async clearLogs(): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.clear(STORES.LOGS);
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    } else {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    }
  }

  // Email Outbox storage
  static async getEmailOutbox(): Promise<EmailMessage[]> {
    if (this.backend === 'indexedDB') {
      return IndexedDBService.getAll<EmailMessage>(STORES.EMAIL_OUTBOX);
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.EMAIL_OUTBOX);
      return data ? JSON.parse(data) as EmailMessage[] : [];
    }
  }

  static async saveEmailOutbox(emails: EmailMessage[]): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.clear(STORES.EMAIL_OUTBOX);
      await IndexedDBService.putMany<EmailMessage>(STORES.EMAIL_OUTBOX, emails);
      // dual-write mirror
      localStorage.setItem(STORAGE_KEYS.EMAIL_OUTBOX, JSON.stringify(emails));
    } else {
      localStorage.setItem(STORAGE_KEYS.EMAIL_OUTBOX, JSON.stringify(emails));
    }
  }

  static async addEmailToOutbox(email: EmailMessage): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.put<EmailMessage>(STORES.EMAIL_OUTBOX, email);
      // dual-write mirror
      const emails = await this.getEmailOutbox();
      const updated = Array.isArray(emails) ? [...emails, email] : [email];
      localStorage.setItem(STORAGE_KEYS.EMAIL_OUTBOX, JSON.stringify(updated));
    } else {
      const emails = await this.getEmailOutbox();
      emails.push(email);
      await this.saveEmailOutbox(emails);
    }
  }

  static async updateEmailInOutbox(email: EmailMessage): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.put<EmailMessage>(STORES.EMAIL_OUTBOX, email);
      // dual-write mirror
      const emails = await this.getEmailOutbox();
      const updated = Array.isArray(emails) ? emails.map(e => e.id === email.id ? email : e) : [email];
      localStorage.setItem(STORAGE_KEYS.EMAIL_OUTBOX, JSON.stringify(updated));
    } else {
      const emails = await this.getEmailOutbox();
      const index = emails.findIndex(e => e.id === email.id);
      if (index >= 0) {
        emails[index] = email;
        await this.saveEmailOutbox(emails);
      }
    }
  }

  // Email Inbox storage
  static async getEmailInbox(): Promise<EmailMessage[]> {
    if (this.backend === 'indexedDB') {
      return IndexedDBService.getAll<EmailMessage>(STORES.EMAIL_INBOX);
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.EMAIL_INBOX);
      return data ? JSON.parse(data) as EmailMessage[] : [];
    }
  }

  static async saveEmailInbox(emails: EmailMessage[]): Promise<void> {
    if (this.backend === 'indexedDB') {
      await IndexedDBService.clear(STORES.EMAIL_INBOX);
      await IndexedDBService.putMany<EmailMessage>(STORES.EMAIL_INBOX, emails);
      // dual-write mirror
      localStorage.setItem(STORAGE_KEYS.EMAIL_INBOX, JSON.stringify(emails));
    } else {
      localStorage.setItem(STORAGE_KEYS.EMAIL_INBOX, JSON.stringify(emails));
    }
  }

  // Generic key-value storage for simple cases
  static async getValue(key: string): Promise<string | null> {
    if (this.backend === 'indexedDB') {
      // For non-structured data, still use localStorage
      return localStorage.getItem(key);
    } else {
      return localStorage.getItem(key);
    }
  }

  static async setValue(key: string, value: string): Promise<void> {
    if (this.backend === 'indexedDB') {
      // For non-structured data, still use localStorage
      localStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  }

  static async removeValue(key: string): Promise<void> {
    if (this.backend === 'indexedDB') {
      localStorage.removeItem(key);
    } else {
      localStorage.removeItem(key);
    }
  }
}

// Backwards compatibility exports
export const storageService = StorageService;
