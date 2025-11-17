/**
 * Attendance Model
 * 
 * Defines types and interfaces for attendance automation functionality.
 * These models support automated login/logout execution and tracking.
 */

import { User } from './user.model';

/**
 * Parameters for executing an attendance action
 * 
 * @interface AttendanceActionParams
 * @property {User} user - The user for whom to execute the attendance action (with decrypted password)
 * @property {'login' | 'logout'} action - The type of attendance action to perform
 */
export interface AttendanceActionParams {
    user: User;
    action: 'login' | 'logout';
}

/**
 * Result returned after executing an attendance action
 * 
 * @interface AttendanceActionResult
 * @property {boolean} log_in - True if login action was successful, false otherwise
 * @property {boolean} log_out - True if logout action was successful, false otherwise
 * @property {string} [actualInTime] - Actual "In time" from attendance system (e.g., "12:15 PM") (optional)
 * @property {string} [actualOutTime] - Actual "Out time" from attendance system (e.g., "7:30 PM") (optional)
 */
export interface AttendanceActionResult {
    log_in: boolean;
    log_out: boolean;
    actualInTime?: string;
    actualOutTime?: string;
}

/**
 * Log entry for an attendance execution
 * 
 * Used to track the history of automated and manual attendance actions.
 * Stored in attendance_logs.json for audit and debugging purposes.
 * 
 * @interface AttendanceLog
 * @property {string} userId - The ID of the user for whom the action was executed
 * @property {'login' | 'logout'} action - The type of action that was executed
 * @property {string} scheduledTime - The scheduled time for the action in HH:MM format
 * @property {string} executionTime - ISO 8601 timestamp of when the action was actually executed
 * @property {boolean} success - Whether the action completed successfully
 * @property {string} [error] - Error message if the action failed (optional)
 */
export interface AttendanceLog {
    userId: string;
    action: 'login' | 'logout';
    scheduledTime: string;
    executionTime: string;
    success: boolean;
    error?: string;
}

/**
 * Execution context for automation cycle
 * 
 * Represents the current state during a cron execution cycle.
 * Used to determine which users are eligible for automation.
 * 
 * @interface ExecutionContext
 * @property {string} currentTime - Current time in HH:MM format (24-hour)
 * @property {number} currentDay - Current day of week (1=Monday, 2=Tuesday, ..., 7=Sunday)
 * @property {string} currentDate - Current date in YYYY-MM-DD format for daily reset detection
 * @property {User[]} users - All users loaded from storage
 */
export interface ExecutionContext {
    currentTime: string;
    currentDay: number;
    currentDate: string;
    users: User[];
}
