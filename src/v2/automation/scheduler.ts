/**
 * Attendance Automation Scheduler
 * 
 * Manages the cron-based scheduling of attendance automation.
 * Runs the attendance queue processing at configured intervals.
 */

import * as cron from 'node-cron';
import { processAttendanceQueue } from './attendance.automation';
import { AUTOMATION_CONFIG } from '../config/constants';
import { acquireLock, releaseLock, getLockStatus } from '../utils/execution-lock.util';

let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Format a Date into an IST (Asia/Kolkata) timestamp string: YYYY-MM-DD HH:mm:ss IST
 */
function formatToIST(date: Date): string {
    const fmt = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = fmt.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) {
        if (p.type !== 'literal') map[p.type] = p.value;
    }

    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} IST`;
}

/**
 * Start the attendance automation scheduler
 * 
 * This function:
 * 1. Checks if automation is enabled in config
 * 2. Sets up a cron job based on CRON_SCHEDULE
 * 3. Runs processAttendanceQueue at each interval
 * 4. Prevents concurrent executions
 * 
 * @returns {void}
 */
export function startScheduler(): void {
    // Check if automation is enabled
    if (!AUTOMATION_CONFIG.ENABLE_AUTOMATION) {
        console.log('[Scheduler] Attendance automation is DISABLED in config');
        return;
    }

    // Check if already running
    if (scheduledTask) {
        console.log('[Scheduler] Scheduler is already running');
        return;
    }

    console.log('\n========================================');
    console.log('[Scheduler] Starting attendance automation scheduler');
    console.log(`[Scheduler] Cron schedule: ${AUTOMATION_CONFIG.CRON_SCHEDULE}`);
    console.log(`[Scheduler] Time window: ${AUTOMATION_CONFIG.TIME_WINDOW_MINUTES} minutes`);
    console.log(`[Scheduler] Max retry attempts: ${AUTOMATION_CONFIG.MAX_RETRY_ATTEMPTS}`);
    console.log('========================================\n');

    // Create the cron job
    scheduledTask = cron.schedule(AUTOMATION_CONFIG.CRON_SCHEDULE, async () => {
        // Try to acquire the lock
        if (!acquireLock('cron')) {
            console.log('[Scheduler] Skipping cycle - attendance processing already in progress (manual trigger)');
            return;
        }

        try {
            const istNow = formatToIST(new Date());
            console.log(`[Scheduler] Triggered at IST Time  ${istNow}`);

            // Process the attendance queue
            await processAttendanceQueue();

        } catch (error) {
            console.error('[Scheduler] Error during execution:', error);
        } finally {
            // Always release the lock
            releaseLock();
        }
    });

    console.log('[Scheduler] ✓ Scheduler started successfully');
}

/**
 * Stop the attendance automation scheduler
 * 
 * Gracefully stops the running cron job.
 * 
 * @returns {void}
 */
export function stopScheduler(): void {
    if (!scheduledTask) {
        console.log('[Scheduler] No scheduler running');
        return;
    }

    console.log('[Scheduler] Stopping attendance automation scheduler...');

    scheduledTask.stop();
    scheduledTask = null;

    console.log('[Scheduler] ✓ Scheduler stopped successfully');
}

/**
 * Get scheduler status
 * 
 * @returns {object} Status information
 */
export function getSchedulerStatus(): { running: boolean; executing: boolean; schedule: string } {
    const lockStatus = getLockStatus();
    return {
        running: scheduledTask !== null,
        executing: lockStatus.locked && lockStatus.source === 'cron',
        schedule: AUTOMATION_CONFIG.CRON_SCHEDULE
    };
}
