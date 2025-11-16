/**
 * Attendance Automation Scheduler
 * 
 * Manages the cron-based scheduling of attendance automation.
 * Runs the attendance queue processing at configured intervals.
 */

import * as cron from 'node-cron';
import { processAttendanceQueue } from './attendance.automation';
import { AUTOMATION_CONFIG } from '../config/constants';

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

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
        // Prevent concurrent executions
        if (isRunning) {
            console.log('[Scheduler] Previous execution still running, skipping this cycle');
            return;
        }

        try {
            isRunning = true;
            console.log(`[Scheduler] Triggered at ${new Date().toISOString()}`);

            // Process the attendance queue
            await processAttendanceQueue();

        } catch (error) {
            console.error('[Scheduler] Error during execution:', error);
        } finally {
            isRunning = false;
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
    return {
        running: scheduledTask !== null,
        executing: isRunning,
        schedule: AUTOMATION_CONFIG.CRON_SCHEDULE
    };
}
