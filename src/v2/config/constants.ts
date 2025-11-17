import path from 'path';
import { ProviderType } from '../providers/config/provider.config';

/**
 * Encryption master key for AES-256-CBC
 * 32 bytes (64 hex characters) required for AES-256
 * TODO: Move to environment variables in Phase 2
 */
export const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/**
 * Salt for encryption
 * TODO: Move to environment variables in Phase 2
 */
export const SALT = 'attendance_automation_salt_2025';

/**
 * Server configuration
 */
export const SERVER_PORT = 7889;

/**
 * Automation configuration
 * Controls the behavior of the attendance automation system
 */
export const AUTOMATION_CONFIG = {
    /** Cron schedule for automation (runs every minute) */
    CRON_SCHEDULE: '* * * * *',
    /** Time window tolerance in minutes (±6 minutes from scheduled time) */
    TIME_WINDOW_MINUTES: 6,
    /** Maximum number of retry attempts for failed executions */
    MAX_RETRY_ATTEMPTS: 3,
    /** Delay in milliseconds between retry attempts */
    RETRY_DELAY_MS: 5000,
    /** Feature flag to enable/disable automation */
    ENABLE_AUTOMATION: true
};

/**
 * Provider configuration
 */
export const DEFAULT_PROVIDER = ProviderType.AKRIVIA;

/**
 * File paths
 */
export const USERS_FILE_PATH = path.join(__dirname, '../data/users.json');
export const ATTENDANCE_LOGS_PATH = path.join(__dirname, '../data/attendance_logs.json');