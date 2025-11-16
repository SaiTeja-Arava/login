/**
 * Today's status for tracking daily attendance execution
 * 
 * This tracks the current day's login/logout attempts and success status.
 * It automatically resets when the date changes (lazy reset on first cron execution).
 * 
 * @interface TodayStatus
 * @property {string} date - Current date in YYYY-MM-DD format (used for daily reset detection)
 * @property {number} loginAttempts - Number of login attempts made today
 * @property {boolean} loginSuccess - Whether login succeeded today (prevents duplicate executions)
 * @property {string} [loginTime] - ISO timestamp of last login attempt (optional)
 * @property {number} logoutAttempts - Number of logout attempts made today
 * @property {boolean} logoutSuccess - Whether logout succeeded today (prevents duplicate executions)
 * @property {string} [logoutTime] - ISO timestamp of last logout attempt (optional)
 * @property {string} [lastError] - Last error message if execution failed (optional)
 */
export interface TodayStatus {
    date: string;
    loginAttempts: number;
    loginSuccess: boolean;
    loginTime?: string;
    logoutAttempts: number;
    logoutSuccess: boolean;
    logoutTime?: string;
    lastError?: string;
}

/**
 * User entity stored in the database
 * Password is encrypted using AES-256-CBC
 */
export interface User {
    /** Employee ID / Username */
    id: string;
    /** AES-256 encrypted password */
    password: string;
    /** Login time in HH:MM format (24-hour) */
    loginTime: string;
    /** Logout time in HH:MM format (24-hour) */
    logoutTime: string;
    /** Array of weekdays (1=Monday, 2=Tuesday, ..., 7=Sunday) */
    weekdays: number[];
    /** 
     * Today's attendance execution status (optional)
     * Auto-managed by the system, resets daily
     */
    todayStatus?: TodayStatus;
}

/**
 * User Data Transfer Object
 * Used for API responses where password should not be included
 */
export interface UserDTO {
    id: string;
    loginTime: string;
    logoutTime: string;
    weekdays: number[];
    /** Today's attendance execution status (read-only, auto-managed) */
    todayStatus?: TodayStatus;
}

/**
 * Request body for creating a new user
 */
export interface CreateUserRequest {
    id: string;
    /** Plain text password (will be encrypted) */
    password: string;
    loginTime: string;
    logoutTime: string;
    weekdays: number[];
}

/**
 * Request body for updating an existing user
 * All fields optional except those being updated
 */
export interface UpdateUserRequest {
    password?: string;
    loginTime?: string;
    logoutTime?: string;
    weekdays?: number[];
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    errors?: string[];
    statusCode?: number;
}

/**
 * Validation error structure
 */
export interface ValidationError {
    field: string;
    message: string;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
    success: false;
    message: string;
    errors?: string[];
    statusCode: number;
}
