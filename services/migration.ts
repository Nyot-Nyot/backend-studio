import { STORAGE_KEYS } from '../constants';
import { IndexedDBService, STORES, initIndexedDB, isIndexedDBAvailable } from './indexedDB';

// Migration flags
const MIGRATION_FLAGS = {
  COMPLETED: 'api_sim_migration_completed',
  IN_PROGRESS: 'api_sim_migration_in_progress',
  FAILED: 'api_sim_migration_failed'
} as const;

export interface MigrationResult {
  success: boolean;
  migratedStores: string[];
  failedStores: string[];
  totalRecords: number;
  errors: string[];
}

// Check if migration is needed
export function shouldRunMigration(): boolean {
  if (!isIndexedDBAvailable()) {
    console.warn('IndexedDB not available, staying with localStorage');
    return false;
  }

  // Already completed
  if (localStorage.getItem(MIGRATION_FLAGS.COMPLETED)) {
    return false;
  }

  // Check if there's any localStorage data to migrate
  const hasData = Object.values(STORAGE_KEYS).some(key => {
    const data = localStorage.getItem(key);
    return data && data !== '[]' && data !== '{}';
  });

  return hasData;
}

// Migrate specific store from localStorage to IndexedDB
async function migrateStore(
  localStorageKey: string, 
  indexedDBStore: string,
  transform?: (data: any) => any[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const data = localStorage.getItem(localStorageKey);
    
    if (!data || data === '[]' || data === '{}') {
      return { success: true, count: 0 };
    }

    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch (parseError) {
      return { 
        success: false, 
        count: 0, 
        error: `Failed to parse localStorage data: ${parseError}` 
      };
    }

    // Transform data if needed (some stores might need ID generation, etc.)
    const records = transform ? transform(parsedData) : (Array.isArray(parsedData) ? parsedData : [parsedData]);
    
    if (records.length > 0) {
      await IndexedDBService.putMany(indexedDBStore as any, records);
    }

    return { success: true, count: records.length };
  } catch (error) {
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Main migration function
export async function runMigration(
  onProgress?: (stage: string, progress: number) => void
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedStores: [],
    failedStores: [],
    totalRecords: 0,
    errors: []
  };

  try {
    // Set migration in progress flag
    localStorage.setItem(MIGRATION_FLAGS.IN_PROGRESS, Date.now().toString());
    
    onProgress?.('Initializing IndexedDB...', 0);
    
    // Initialize IndexedDB
    await initIndexedDB();
    
    onProgress?.('Migrating projects...', 10);
    
    // Migrate Projects
    const projectsResult = await migrateStore(
      STORAGE_KEYS.PROJECTS,
      STORES.PROJECTS
    );
    if (projectsResult.success) {
      result.migratedStores.push('projects');
      result.totalRecords += projectsResult.count;
    } else {
      result.failedStores.push('projects');
      result.errors.push(projectsResult.error || 'Unknown error');
    }

    onProgress?.('Migrating mocks...', 25);
    
    // Migrate Mocks
    const mocksResult = await migrateStore(
      STORAGE_KEYS.MOCKS,
      STORES.MOCKS
    );
    if (mocksResult.success) {
      result.migratedStores.push('mocks');
      result.totalRecords += mocksResult.count;
    } else {
      result.failedStores.push('mocks');
      result.errors.push(mocksResult.error || 'Unknown error');
    }

    onProgress?.('Migrating environment variables...', 40);
    
    // Migrate Environment Variables
    const envVarsResult = await migrateStore(
      STORAGE_KEYS.ENV_VARS,
      STORES.ENV_VARS
    );
    if (envVarsResult.success) {
      result.migratedStores.push('envVars');
      result.totalRecords += envVarsResult.count;
    } else {
      result.failedStores.push('envVars');
      result.errors.push(envVarsResult.error || 'Unknown error');
    }

    onProgress?.('Migrating logs...', 60);
    
    // Migrate Logs
    const logsResult = await migrateStore(
      STORAGE_KEYS.LOGS,
      STORES.LOGS,
      (data) => {
        // Transform logs if needed - add IDs if missing
        return Array.isArray(data) ? data.map((log: any, index: number) => ({
          id: log.id || `log_${Date.now()}_${index}`,
          ...log
        })) : [];
      }
    );
    if (logsResult.success) {
      result.migratedStores.push('logs');
      result.totalRecords += logsResult.count;
    } else {
      result.failedStores.push('logs');
      result.errors.push(logsResult.error || 'Unknown error');
    }

    onProgress?.('Migrating email outbox...', 75);
    
    // Migrate Email Outbox
    const outboxResult = await migrateStore(
      STORAGE_KEYS.EMAIL_OUTBOX,
      STORES.EMAIL_OUTBOX
    );
    if (outboxResult.success) {
      result.migratedStores.push('emailOutbox');
      result.totalRecords += outboxResult.count;
    } else {
      result.failedStores.push('emailOutbox');
      result.errors.push(outboxResult.error || 'Unknown error');
    }

    onProgress?.('Migrating email inbox...', 85);
    
    // Migrate Email Inbox  
    const inboxResult = await migrateStore(
      STORAGE_KEYS.EMAIL_INBOX,
      STORES.EMAIL_INBOX
    );
    if (inboxResult.success) {
      result.migratedStores.push('emailInbox');
      result.totalRecords += inboxResult.count;
    } else {
      result.failedStores.push('emailInbox');
      result.errors.push(inboxResult.error || 'Unknown error');
    }

    onProgress?.('Finalizing migration...', 95);

    // Migration successful if at least some stores migrated and no critical failures
    result.success = result.migratedStores.length > 0 && result.failedStores.length === 0;

    if (result.success) {
      // Mark migration as completed
      localStorage.setItem(MIGRATION_FLAGS.COMPLETED, Date.now().toString());
      localStorage.removeItem(MIGRATION_FLAGS.IN_PROGRESS);
      
      // Optional: Create backup of localStorage data before potential cleanup
      const backupData: any = {};
      Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
        const data = localStorage.getItem(storageKey);
        if (data) {
          backupData[key] = data;
        }
      });
      localStorage.setItem('api_sim_localStorage_backup', JSON.stringify({
        timestamp: Date.now(),
        data: backupData
      }));
      
      onProgress?.('Migration completed successfully!', 100);
    } else {
      localStorage.setItem(MIGRATION_FLAGS.FAILED, JSON.stringify({
        timestamp: Date.now(),
        errors: result.errors
      }));
      localStorage.removeItem(MIGRATION_FLAGS.IN_PROGRESS);
      
      onProgress?.('Migration completed with errors', 100);
    }

  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
    
    localStorage.setItem(MIGRATION_FLAGS.FAILED, JSON.stringify({
      timestamp: Date.now(),
      errors: result.errors
    }));
    localStorage.removeItem(MIGRATION_FLAGS.IN_PROGRESS);
  }

  return result;
}

// Check migration status
export function getMigrationStatus(): {
  completed: boolean;
  inProgress: boolean;
  failed: boolean;
  lastAttempt?: number;
  errors?: string[];
} {
  const completed = localStorage.getItem(MIGRATION_FLAGS.COMPLETED);
  const inProgress = localStorage.getItem(MIGRATION_FLAGS.IN_PROGRESS);
  const failed = localStorage.getItem(MIGRATION_FLAGS.FAILED);

  let lastAttempt: number | undefined;
  let errors: string[] | undefined;

  if (failed) {
    try {
      const failedData = JSON.parse(failed);
      lastAttempt = failedData.timestamp;
      errors = failedData.errors;
    } catch (e) {
      // Ignore parse error
    }
  }

  return {
    completed: !!completed,
    inProgress: !!inProgress,
    failed: !!failed,
    lastAttempt,
    errors
  };
}

// Reset migration state (for testing or retry)
export function resetMigrationState(): void {
  localStorage.removeItem(MIGRATION_FLAGS.COMPLETED);
  localStorage.removeItem(MIGRATION_FLAGS.IN_PROGRESS);
  localStorage.removeItem(MIGRATION_FLAGS.FAILED);
}

// Get localStorage backup data
export function getLocalStorageBackup(): any | null {
  const backup = localStorage.getItem('api_sim_localStorage_backup');
  if (backup) {
    try {
      return JSON.parse(backup);
    } catch (e) {
      return null;
    }
  }
  return null;
}