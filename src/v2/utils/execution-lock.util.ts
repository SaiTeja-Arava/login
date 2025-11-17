/**
 * Execution Lock Utility
 * 
 * Manages a global lock to prevent concurrent execution of attendance automation.
 * Ensures that cron scheduler and manual trigger don't run simultaneously.
 * 
 * This prevents:
 * - Duplicate login/logout attempts
 * - Race conditions on user status updates
 * - Inconsistent attendance logs
 */

/**
 * Lock source type - who acquired the lock
 */
export type LockSource = 'cron' | 'manual';

/**
 * Lock status information
 */
export interface LockStatus {
    locked: boolean;
    source?: LockSource;
    startTime?: Date;
}

/**
 * Global lock state
 */
let executionLock: LockStatus = {
    locked: false,
    source: undefined,
    startTime: undefined
};

/**
 * Acquire the execution lock
 * 
 * @param {LockSource} source - Who is requesting the lock ('cron' or 'manual')
 * @returns {boolean} True if lock acquired successfully, false if already locked
 */
export function acquireLock(source: LockSource): boolean {
    // Check if already locked
    if (executionLock.locked) {
        console.log(`[ExecutionLock] Lock acquisition FAILED - already locked by ${executionLock.source}`);
        return false;
    }

    // Acquire the lock
    const startTime = new Date();
    executionLock = {
        locked: true,
        source,
        startTime
    };

    console.log(`[ExecutionLock] Lock ACQUIRED by ${source} at ${startTime.toISOString()}`);
    return true;
}

/**
 * Release the execution lock
 * 
 * @returns {void}
 */
export function releaseLock(): void {
    if (!executionLock.locked) {
        console.warn('[ExecutionLock] Attempted to release lock but it was not locked');
        return;
    }

    const source = executionLock.source;
    const duration = executionLock.startTime
        ? Date.now() - executionLock.startTime.getTime()
        : 0;

    // Release the lock
    executionLock = {
        locked: false,
        source: undefined,
        startTime: undefined
    };

    console.log(`[ExecutionLock] Lock RELEASED by ${source} (held for ${duration}ms)`);
}

/**
 * Check if the lock is currently held
 * 
 * @returns {boolean} True if locked, false otherwise
 */
export function isLocked(): boolean {
    return executionLock.locked;
}

/**
 * Get the current lock status with details
 * 
 * @returns {LockStatus} Current lock status including source and start time
 */
export function getLockStatus(): LockStatus {
    return {
        locked: executionLock.locked,
        source: executionLock.source,
        startTime: executionLock.startTime
    };
}

/**
 * Get lock status as a JSON-serializable object
 * (For API responses)
 * 
 * @returns {object} Lock status with ISO timestamp
 */
export function getLockStatusForAPI(): {
    executing: boolean;
    source?: LockSource;
    startedAt?: string;
} {
    return {
        executing: executionLock.locked,
        source: executionLock.source,
        startedAt: executionLock.startTime?.toISOString()
    };
}
