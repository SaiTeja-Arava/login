/**
 * Attendance Automation Main Logic
 * 
 * Processes the attendance queue by:
 * 1. Getting eligible users for login/logout
 * 2. Decrypting passwords
 * 3. Executing actions via executor
 * 4. Logging all executions
 */

import { getEligibleUsers, findUserWithDecryptedPassword, logAttendanceExecution, getCurrentExecutionContext } from '../services/attendance.service';
import { executeAttendanceAction } from './executor';

/**
 * Process the attendance automation queue
 * 
 * This is the main function called by the scheduler.
 * It processes all eligible users for both login and logout actions.
 * 
 * Flow:
 * 1. Get current execution context (time, date, day)
 * 2. Find eligible login users (within login time window, not already logged in today)
 * 3. Find eligible logout users (within logout time window, not already logged out today)
 * 4. Execute each action with retry logic
 * 5. Log all execution results
 * 
 * @returns {Promise<void>}
 */
export async function processAttendanceQueue(): Promise<void> {
    console.log('\n========================================');
    console.log('[Automation] Processing attendance queue...');
    console.log('========================================\n');

    const context = await getCurrentExecutionContext();
    console.log(`[Automation] Execution context:`, {
        time: context.currentTime,
        date: context.currentDate,
        day: context.currentDay
    });

    try {
        // Get eligible users for login and logout
        const eligibleUsers = await getEligibleUsers(
            context.currentTime,
            context.currentDay,
            context.currentDate
        );

        const loginUsers = eligibleUsers.filter(eu => eu.action === 'login');
        const logoutUsers = eligibleUsers.filter(eu => eu.action === 'logout');

        console.log(`[Automation] Found ${loginUsers.length} users eligible for login`);
        console.log(`[Automation] Found ${logoutUsers.length} users eligible for logout`);

        // Process login actions
        for (const { user, action } of loginUsers) {
            try {
                console.log(`\n[Automation] Processing login for user: ${user.id}`);

                // Get user with decrypted password
                const decryptedUser = await findUserWithDecryptedPassword(user.id);

                if (!decryptedUser) {
                    console.error(`[Automation] User ${user.id} not found or decryption failed`);
                    await logAttendanceExecution({
                        userId: user.id,
                        action: 'login',
                        scheduledTime: user.loginTime,
                        success: false,
                        error: 'User not found or password decryption failed'
                    });
                    continue;
                }

                // Execute the login action
                const result = await executeAttendanceAction(decryptedUser, 'login');

                // Log the execution result
                const success = result.log_in;
                await logAttendanceExecution({
                    userId: user.id,
                    action: 'login',
                    scheduledTime: user.loginTime,
                    success,
                    error: success ? undefined : 'Login action failed'
                });

                console.log(`[Automation] Login ${success ? 'succeeded' : 'failed'} for user ${user.id}`);

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`[Automation] Error processing login for user ${user.id}:`, errorMsg);
                await logAttendanceExecution({
                    userId: user.id,
                    action: 'login',
                    scheduledTime: user.loginTime,
                    success: false,
                    error: errorMsg
                });
            }
        }

        // Process logout actions
        for (const { user, action } of logoutUsers) {
            try {
                console.log(`\n[Automation] Processing logout for user: ${user.id}`);

                // Get user with decrypted password
                const decryptedUser = await findUserWithDecryptedPassword(user.id);

                if (!decryptedUser) {
                    console.error(`[Automation] User ${user.id} not found or decryption failed`);
                    await logAttendanceExecution({
                        userId: user.id,
                        action: 'logout',
                        scheduledTime: user.logoutTime,
                        success: false,
                        error: 'User not found or password decryption failed'
                    });
                    continue;
                }

                // Execute the logout action
                const result = await executeAttendanceAction(decryptedUser, 'logout');

                // Log the execution result
                const success = result.log_out;
                await logAttendanceExecution({
                    userId: user.id,
                    action: 'logout',
                    scheduledTime: user.logoutTime,
                    success,
                    error: success ? undefined : 'Logout action failed'
                });

                console.log(`[Automation] Logout ${success ? 'succeeded' : 'failed'} for user ${user.id}`);

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`[Automation] Error processing logout for user ${user.id}:`, errorMsg);
                await logAttendanceExecution({
                    userId: user.id,
                    action: 'logout',
                    scheduledTime: user.logoutTime,
                    success: false,
                    error: errorMsg
                });
            }
        }

        console.log('\n========================================');
        console.log('[Automation] Queue processing completed');
        console.log(`[Automation] Processed ${loginUsers.length} logins, ${logoutUsers.length} logouts`);
        console.log('========================================\n');

    } catch (error) {
        console.error('[Automation] Fatal error processing queue:', error);
    }
}
