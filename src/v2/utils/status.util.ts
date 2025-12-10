/**
 * Daily Status Utility
 * 
 * Handles daily status tracking and reset logic for users.
 * Implements lazy reset pattern - status is reset when date changes,
 * detected during the first cron execution of the new day.
 */

import { TodayStatus, User } from '../models/user.model';
import { getCurrentDate, randomizeTime } from './time.util';
import { AUTOMATION_CONFIG } from '../config/constants';

/**
 * Creates a fresh TodayStatus object for a new day
 * All counters set to 0, all success flags set to false
 * Generates randomized execution times for the day
 * 
 * @param {string} date - The date in YYYY-MM-DD format
 * @param {User} user - The user object (needed for scheduled times)
 * @returns {TodayStatus} Fresh status object with randomized times
 */
export function getInitialTodayStatus(date: string, user: User): TodayStatus {
    const window = AUTOMATION_CONFIG.TIME_WINDOW_MINUTES;

    // Calculate randomized times based on user's scheduled times and the config window
    const randomizedLogin = randomizeTime(user.loginTime, window);
    const randomizedLogout = randomizeTime(user.logoutTime, window);

    console.log(`[Status] Generated random times for user ${user.id} on ${date}: Login ${user.loginTime} -> ${randomizedLogin}, Logout ${user.logoutTime} -> ${randomizedLogout}`);

    return {
        date: date,
        loginAttempts: 0,
        loginSuccess: false,
        loginTime: undefined,
        randomizedLoginTime: randomizedLogin,
        actualInTime: undefined,
        logoutAttempts: 0,
        logoutSuccess: false,
        logoutTime: undefined,
        randomizedLogoutTime: randomizedLogout,
        actualOutTime: undefined,
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
            todayStatus: getInitialTodayStatus(currentDate, user)
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
 * @param {string} [actualTime] - Optional actual time from attendance system (e.g., "12:15 PM")
 * @returns {User} User with updated status
 * 
 * @example
 * const user = { id: "1188", todayStatus: { ... } };
 * const updated = updateActionStatus(user, 'login', true, undefined, "12:15 PM");
 * // updated.todayStatus.loginAttempts === original + 1
 * // updated.todayStatus.loginSuccess === true
 * // updated.todayStatus.actualInTime === "12:15 PM"
 */
export function updateActionStatus(
    user: User,
    action: 'login' | 'logout',
    success: boolean,
    error?: string,
    actualTime?: string
): User {
    // Ensure user has todayStatus
    const currentDate = getCurrentDate();
    const currentStatus = user.todayStatus || getInitialTodayStatus(currentDate, user); // Pass user here

    // Reset status if date changed
    const status = shouldResetStatus(currentDate, currentStatus.date)
        ? getInitialTodayStatus(currentDate, user) // Pass user here
        : currentStatus;

    // Create updated status based on action type
    const updatedStatus: TodayStatus = {
        ...status,
        ...(action === 'login' ? {
            loginAttempts: status.loginAttempts + 1,
            loginSuccess: success,
            loginTime: new Date().toISOString(),
            actualInTime: actualTime || status.actualInTime
        } : {
            logoutAttempts: status.logoutAttempts + 1,
            logoutSuccess: success,
            logoutTime: new Date().toISOString(),
            actualOutTime: actualTime || status.actualOutTime
        }),
        lastError: error || status.lastError
    };

    return {
        ...user,
        todayStatus: updatedStatus
    };
}
