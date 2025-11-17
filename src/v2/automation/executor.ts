/**
 * Attendance Action Executor
 * 
 * Executes attendance actions (login/logout) with retry logic and status tracking.
 * This is the bridge between the automation queue and the actual Puppeteer implementation.
 */

import { User } from '../models/user.model';
import { AttendanceActionResult } from '../models/attendance.model';
import { performAttendanceAction } from '../attendance-v2';
import { updateUserStatus } from '../services/attendance.service';
import { AUTOMATION_CONFIG } from '../config/constants';

const { MAX_RETRY_ATTEMPTS, RETRY_DELAY_MS } = AUTOMATION_CONFIG;

/**
 * Execute an attendance action with retry logic
 * 
 * This function:
 * 1. Calls the performAttendanceAction function from attendance-v2.ts
 * 2. Retries on failure up to MAX_RETRY_ATTEMPTS times
 * 3. Updates the user's todayStatus after each attempt
 * 4. Returns the final result
 * 
 * @param {User} user - User object with decrypted password
 * @param {'login' | 'logout'} action - Action type to execute
 * @returns {Promise<AttendanceActionResult>} Result of the action execution
 */
export async function executeAttendanceAction(
    user: User,
    action: 'login' | 'logout'
): Promise<AttendanceActionResult> {
    let lastResult: AttendanceActionResult = { log_in: false, log_out: false };
    let lastError: string | undefined;

    // Retry loop
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        try {
            console.log(`[Executor] Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} - ${action} for user ${user.id}`);

            // Call the actual attendance action implementation
            lastResult = await performAttendanceAction({
                user,
                action
            });

            // Check if action succeeded
            const success = action === 'login' ? lastResult.log_in : lastResult.log_out;
            const actualTime = action === 'login' ? lastResult.actualInTime : lastResult.actualOutTime;

            if (success) {
                console.log(`[Executor] ✓ ${action} succeeded for user ${user.id} on attempt ${attempt}`);

                // Update user status with success and actual time
                await updateUserStatus(user.id, action, true, undefined, actualTime);

                return lastResult;
            } else {
                lastError = `${action} failed - no error details`;
                console.log(`[Executor] ✗ ${action} failed for user ${user.id} on attempt ${attempt}`);
            }

        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            console.error(`[Executor] ✗ ${action} error for user ${user.id} on attempt ${attempt}:`, lastError);
        }

        // If not the last attempt, wait before retrying
        if (attempt < MAX_RETRY_ATTEMPTS) {
            console.log(`[Executor] Waiting ${RETRY_DELAY_MS}ms before retry...`);
            await delay(RETRY_DELAY_MS);
        }
    }

    // All attempts failed - update status with failure
    console.error(`[Executor] All ${MAX_RETRY_ATTEMPTS} attempts failed for ${action} - user ${user.id}`);
    await updateUserStatus(user.id, action, false, lastError);

    return lastResult;
}

/**
 * Delay helper function
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
