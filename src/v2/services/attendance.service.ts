/**
 * Attendance Service
 * 
 * Business logic for attendance automation including:
 * - User eligibility filtering with lazy reset
 * - Skip logic to prevent duplicate executions
 * - Status updates after execution
 * - Attendance log management
 */

import { User } from '../models/user.model';
import { AttendanceLog } from '../models/attendance.model';
import { readUsersFromFile, writeUsersToFile } from '../utils/file.util';
import { getCurrentDate, getCurrentDayOfWeek, formatTime, isWithinTimeWindow } from '../utils/time.util';
import { resetUserStatusIfNeeded, updateActionStatus } from '../utils/status.util';
import { appendLog, getFilteredLogs as getFilteredLogsUtil } from '../utils/attendance-log.util';
import { AUTOMATION_CONFIG } from '../config/constants';
import { decrypt } from '../utils/encryption.util';

/**
 * Eligible user with action to perform
 */
interface EligibleUser {
    user: User;
    action: 'login' | 'logout';
}

/**
 * Gets eligible users for attendance automation
 * 
 * This function:
 * 1. Reads all users from storage
 * 2. Resets todayStatus for users if date has changed (lazy reset)
 * 3. Filters by current weekday
 * 4. Skips users who already succeeded (loginSuccess/logoutSuccess = true)
 * 5. Checks if current time is within the action's time window
 * 
 * @param {string} currentTime - Current time in HH:MM format
 * @param {number} currentDay - Current day of week (1-7, Monday-Sunday)
 * @param {string} currentDate - Current date in YYYY-MM-DD format
 * @returns {Promise<EligibleUser[]>} Array of eligible users with their actions
 */
export async function getEligibleUsers(
    currentTime: string,
    currentDay: number,
    currentDate: string
): Promise<EligibleUser[]> {
    try {
        // Read all users
        let users = await readUsersFromFile();

        // Reset todayStatus for users if date has changed (lazy reset)
        let usersNeedUpdate = false;
        users = users.map(user => {
            const resetUser = resetUserStatusIfNeeded(user, currentDate);
            if (resetUser !== user) {
                usersNeedUpdate = true;
            }
            return resetUser;
        });

        // Save users if any status was reset
        if (usersNeedUpdate) {
            await writeUsersToFile(users);
            console.log(`✓ Reset daily status for users (new day: ${currentDate})`);
        }

        const eligibleUsers: EligibleUser[] = [];

        for (const user of users) {
            // Skip if today is not in user's weekdays
            if (!user.weekdays.includes(currentDay)) {
                continue;
            }

            // Check login eligibility
            const needsLogin =
                !user.todayStatus?.loginSuccess && // Skip if already succeeded
                isWithinTimeWindow(currentTime, user.loginTime, AUTOMATION_CONFIG.TIME_WINDOW_MINUTES);

            if (needsLogin) {
                eligibleUsers.push({ user, action: 'login' });
            }

            // Check logout eligibility
            const needsLogout =
                !user.todayStatus?.logoutSuccess && // Skip if already succeeded
                isWithinTimeWindow(currentTime, user.logoutTime, AUTOMATION_CONFIG.TIME_WINDOW_MINUTES);

            if (needsLogout) {
                eligibleUsers.push({ user, action: 'logout' });
            }
        }

        return eligibleUsers;
    } catch (error) {
        console.error('Error getting eligible users:', error);
        throw new Error(`Failed to get eligible users: ${error}`);
    }
}

/**
 * Updates a user's todayStatus after an attendance action
 * 
 * This function:
 * 1. Reads all users from storage
 * 2. Finds the specific user
 * 3. Updates their todayStatus (increments attempts, sets success flag, timestamp)
 * 4. Saves back to storage immediately
 * 
 * @param {string} userId - The ID of the user to update
 * @param {'login' | 'logout'} action - The action that was performed
 * @param {boolean} success - Whether the action succeeded
 * @param {string} [error] - Optional error message if failed
 * @returns {Promise<void>}
 * @throws {Error} If user not found or update fails
 */
export async function updateUserStatus(
    userId: string,
    action: 'login' | 'logout',
    success: boolean,
    error?: string
): Promise<void> {
    try {
        // Read all users
        const users = await readUsersFromFile();

        // Find the user
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            throw new Error(`User not found: ${userId}`);
        }

        // Update the user's status
        users[userIndex] = updateActionStatus(users[userIndex], action, success, error);

        // Save immediately
        await writeUsersToFile(users);

        console.log(`✓ Updated ${action} status for user ${userId}: ${success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
        console.error('Error updating user status:', error);
        throw new Error(`Failed to update user status: ${error}`);
    }
}

/**
 * Logs an attendance execution to the log file
 * 
 * @param {Omit<AttendanceLog, 'executionTime'>} logData - Log data (executionTime will be added automatically)
 * @returns {Promise<void>}
 */
export async function logAttendanceExecution(
    logData: Omit<AttendanceLog, 'executionTime'>
): Promise<void> {
    try {
        const log: AttendanceLog = {
            ...logData,
            executionTime: new Date().toISOString()
        };

        await appendLog(log);

        const status = log.success ? '✓' : '✗';
        console.log(`${status} Logged ${log.action} for user ${log.userId}: ${log.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
        console.error('Error logging attendance execution:', error);
        // Don't throw - logging failures shouldn't stop execution
    }
}

/**
 * Gets attendance logs with optional filtering
 * 
 * @param {string} [userId] - Optional user ID to filter by
 * @param {number} [limit] - Optional maximum number of logs to return
 * @returns {Promise<AttendanceLog[]>} Array of logs in reverse chronological order
 */
export async function getAttendanceLogs(
    userId?: string,
    limit?: number
): Promise<AttendanceLog[]> {
    try {
        return await getFilteredLogsUtil(userId, limit);
    } catch (error) {
        console.error('Error getting attendance logs:', error);
        throw new Error(`Failed to get attendance logs: ${error}`);
    }
}

/**
 * Gets the current execution context
 * Useful for automation cycle initialization
 * 
 * @returns {Promise<{currentTime: string, currentDay: number, currentDate: string}>}
 */
export async function getCurrentExecutionContext(): Promise<{
    currentTime: string;
    currentDay: number;
    currentDate: string;
}> {
    const now = new Date();
    return {
        currentTime: formatTime(now),
        currentDay: getCurrentDayOfWeek(now),
        currentDate: getCurrentDate()
    };
}

/**
 * Finds a user by ID with decrypted password
 * Useful for manual trigger endpoints
 * 
 * @param {string} userId - The user ID to find
 * @returns {Promise<User | null>} User with decrypted password, or null if not found
 */
export async function findUserWithDecryptedPassword(userId: string): Promise<User | null> {
    try {
        const users = await readUsersFromFile();
        const user = users.find(u => u.id === userId);

        if (!user) {
            return null;
        }

        // Decrypt password
        const decryptedPassword = decrypt(user.password);

        return {
            ...user,
            password: decryptedPassword
        };
    } catch (error) {
        console.error('Error finding user with decrypted password:', error);
        throw new Error(`Failed to find user: ${error}`);
    }
}
