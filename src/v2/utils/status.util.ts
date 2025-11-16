/**
 * Daily Status Utility
 * 
 * Handles daily status tracking and reset logic for users.
 * Implements lazy reset pattern - status is reset when date changes,
 * detected during the first cron execution of the new day.
 */

import { TodayStatus, User } from '../models/user.model';
import { getCurrentDate } from './time.util';

/**
 * Creates a fresh TodayStatus object for a new day
 * All counters set to 0, all success flags set to false
 * 
 * @param {string} date - The date in YYYY-MM-DD format
 * @returns {TodayStatus} Fresh status object
 * 
 * @example
 * getInitialTodayStatus("2025-11-16")
 * // Returns: {
 * //   date: "2025-11-16",
 * //   loginAttempts: 0,
 * //   loginSuccess: false,
 * //   logoutAttempts: 0,
 * //   logoutSuccess: false
 * // }
 */
export function getInitialTodayStatus(date: string): TodayStatus {
    return {
        date: date,
        loginAttempts: 0,
        loginSuccess: false,
        loginTime: undefined,
        logoutAttempts: 0,
        logoutSuccess: false,
        logoutTime: undefined,
        lastError: undefined
    };
}

/**
 * Checks if the daily status needs to be reset
 * Returns true if:
 * - Status is missing (user has no todayStatus)
 * - Date is missing from status
 * - Date in status differs from current date
 * 
 * @param {string} currentDate - Current date in YYYY-MM-DD format
 * @param {string} [statusDate] - Date from todayStatus (optional)
 * @returns {boolean} True if reset is needed
 * 
 * @example
 * shouldResetStatus("2025-11-16", "2025-11-15") // Returns true (different dates)
 * shouldResetStatus("2025-11-16", "2025-11-16") // Returns false (same date)
 * shouldResetStatus("2025-11-16", undefined)    // Returns true (no date)
 */
export function shouldResetStatus(
    currentDate: string,
    statusDate?: string
): boolean {
    // No status date means reset is needed
    if (!statusDate) {
        return true;
    }

    // Different dates means reset is needed
    return statusDate !== currentDate;
}

/**
 * Resets user's todayStatus if the date has changed
 * Implements lazy reset pattern - only resets when needed
 * 
 * This function should be called at the start of each cron cycle
 * to ensure users have fresh status for the current day.
 * 
 * @param {User} user - The user whose status to check/reset
 * @param {string} currentDate - Current date in YYYY-MM-DD format
 * @returns {User} User with updated status (if reset was needed)
 * 
 * @example
 * const user = {
 *   id: "1188",
 *   // ... other fields
 *   todayStatus: { date: "2025-11-15", loginSuccess: true, ... }
 * };
 * 
 * const updatedUser = resetUserStatusIfNeeded(user, "2025-11-16");
 * // updatedUser.todayStatus.date === "2025-11-16"
 * // updatedUser.todayStatus.loginSuccess === false (reset)
 */
export function resetUserStatusIfNeeded(
    user: User,
    currentDate: string
): User {
    // Check if reset is needed
    if (shouldResetStatus(currentDate, user.todayStatus?.date)) {
        // Create new user object with reset status
        return {
            ...user,
            todayStatus: getInitialTodayStatus(currentDate)
        };
    }

    // No reset needed, return user as-is
    return user;
}

/**
 * Batch reset status for multiple users
 * Useful for processing all users at the start of a cron cycle
 * 
 * @param {User[]} users - Array of users to process
 * @param {string} [currentDate] - Current date (defaults to today)
 * @returns {User[]} Array of users with updated status
 * 
 * @example
 * const users = await readUsersFromFile();
 * const resetUsers = resetAllUsersIfNeeded(users);
 * await writeUsersToFile(resetUsers);
 */
export function resetAllUsersIfNeeded(
    users: User[],
    currentDate?: string
): User[] {
    const date = currentDate || getCurrentDate();
    return users.map(user => resetUserStatusIfNeeded(user, date));
}

/**
 * Updates a specific action's status (login or logout)
 * Increments attempt counter and optionally sets success flag
 * 
 * @param {User} user - The user to update
 * @param {'login' | 'logout'} action - The action type
 * @param {boolean} success - Whether the action succeeded
 * @param {string} [error] - Optional error message if failed
 * @returns {User} User with updated status
 * 
 * @example
 * const user = { id: "1188", todayStatus: { ... } };
 * const updated = updateActionStatus(user, 'login', true);
 * // updated.todayStatus.loginAttempts === original + 1
 * // updated.todayStatus.loginSuccess === true
 */
export function updateActionStatus(
    user: User,
    action: 'login' | 'logout',
    success: boolean,
    error?: string
): User {
    // Ensure user has todayStatus
    const currentDate = getCurrentDate();
    const currentStatus = user.todayStatus || getInitialTodayStatus(currentDate);

    // Reset status if date changed
    const status = shouldResetStatus(currentDate, currentStatus.date)
        ? getInitialTodayStatus(currentDate)
        : currentStatus;

    // Create updated status based on action type
    const updatedStatus: TodayStatus = {
        ...status,
        ...(action === 'login' ? {
            loginAttempts: status.loginAttempts + 1,
            loginSuccess: success,
            loginTime: new Date().toISOString()
        } : {
            logoutAttempts: status.logoutAttempts + 1,
            logoutSuccess: success,
            logoutTime: new Date().toISOString()
        }),
        lastError: error || status.lastError
    };

    return {
        ...user,
        todayStatus: updatedStatus
    };
}
