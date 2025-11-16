/**
 * Time Utility Functions
 * 
 * Provides functions for time parsing, formatting, and comparison
 * used throughout the attendance automation system.
 */

/**
 * Parses a time string in HH:MM format to minutes since midnight
 * 
 * @param {string} timeStr - Time string in HH:MM format (e.g., "09:30")
 * @returns {number} Minutes since midnight (e.g., 570 for "09:30")
 * @throws {Error} If time format is invalid
 * 
 * @example
 * parseTime("09:30") // Returns 570
 * parseTime("00:00") // Returns 0
 * parseTime("23:59") // Returns 1439
 */
export function parseTime(timeStr: string): number {
    const parts = timeStr.split(':');
    
    if (parts.length !== 2) {
        throw new Error(`Invalid time format: ${timeStr}. Expected HH:MM`);
    }
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
        throw new Error(`Invalid time format: ${timeStr}. Hours and minutes must be numbers`);
    }
    
    if (hours < 0 || hours > 23) {
        throw new Error(`Invalid hours: ${hours}. Must be between 0 and 23`);
    }
    
    if (minutes < 0 || minutes > 59) {
        throw new Error(`Invalid minutes: ${minutes}. Must be between 0 and 59`);
    }
    
    return hours * 60 + minutes;
}

/**
 * Formats a Date object to HH:MM string in 24-hour format
 * 
 * @param {Date} date - Date object to format
 * @returns {string} Time string in HH:MM format with leading zeros
 * 
 * @example
 * formatTime(new Date('2025-11-16T09:05:00')) // Returns "09:05"
 * formatTime(new Date('2025-11-16T23:59:00')) // Returns "23:59"
 */
export function formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Gets the current date in YYYY-MM-DD format
 * Uses local timezone
 * 
 * @returns {string} Current date as YYYY-MM-DD
 * 
 * @example
 * getCurrentDate() // Returns "2025-11-16"
 */
export function getCurrentDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Gets the current day of week as a number (1-7)
 * Converts JavaScript's 0-6 (Sunday-Saturday) to 1-7 (Monday-Sunday)
 * 
 * @param {Date} date - Date object to get day from
 * @returns {number} Day of week (1=Monday, 2=Tuesday, ..., 7=Sunday)
 * 
 * @example
 * getCurrentDayOfWeek(new Date('2025-11-16')) // Returns 7 (Sunday)
 * getCurrentDayOfWeek(new Date('2025-11-17')) // Returns 1 (Monday)
 */
export function getCurrentDayOfWeek(date: Date): number {
    const jsDay = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    return jsDay === 0 ? 7 : jsDay; // Convert to 1-7 where 1=Monday, 7=Sunday
}

/**
 * Checks if current time is within a time window of the target time
 * 
 * @param {string} currentTime - Current time in HH:MM format
 * @param {string} targetTime - Target time in HH:MM format
 * @param {number} windowMinutes - Time window in minutes (e.g., 2 means ±2 minutes)
 * @returns {boolean} True if current time is within the window
 * 
 * @example
 * isWithinTimeWindow("09:01", "09:00", 2) // Returns true (within ±2 minutes)
 * isWithinTimeWindow("09:05", "09:00", 2) // Returns false (outside window)
 * isWithinTimeWindow("08:58", "09:00", 2) // Returns true (within ±2 minutes)
 */
export function isWithinTimeWindow(
    currentTime: string,
    targetTime: string,
    windowMinutes: number
): boolean {
    try {
        const currentMinutes = parseTime(currentTime);
        const targetMinutes = parseTime(targetTime);
        
        const diffMinutes = Math.abs(currentMinutes - targetMinutes);
        
        // Handle midnight wrap-around
        // e.g., if target is 23:59 and current is 00:01
        const wrapAroundDiff = 1440 - diffMinutes; // 1440 = 24 hours in minutes
        const actualDiff = Math.min(diffMinutes, wrapAroundDiff);
        
        return actualDiff <= windowMinutes;
    } catch (error) {
        // If time parsing fails, return false
        console.error(`Error in isWithinTimeWindow: ${error}`);
        return false;
    }
}

/**
 * Formats an ISO timestamp to a human-readable format
 * 
 * @param {string} isoString - ISO 8601 timestamp string
 * @returns {string} Formatted timestamp (e.g., "Nov 16, 2025 9:01 AM")
 * 
 * @example
 * formatTimestamp("2025-11-16T09:01:23.456Z") // Returns "Nov 16, 2025 9:01 AM"
 */
export function formatTimestamp(isoString: string): string {
    try {
        const date = new Date(isoString);
        
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        };
        
        return date.toLocaleString('en-US', options);
    } catch (error) {
        console.error(`Error formatting timestamp: ${error}`);
        return 'Invalid Date';
    }
}

/**
 * Gets relative time string (e.g., "2 hours ago", "just now")
 * 
 * @param {string} isoString - ISO 8601 timestamp string
 * @returns {string} Relative time string
 * 
 * @example
 * getRelativeTime("2025-11-16T07:00:00Z") // Returns "2 hours ago" (if current time is 09:00)
 */
export function getRelativeTime(isoString: string): string {
    try {
        const date = new Date(isoString);
        const now = new Date();
        
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        const diffMs = now.getTime() - date.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSeconds < 60) {
            return 'just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            return formatTimestamp(isoString);
        }
    } catch (error) {
        console.error(`Error getting relative time: ${error}`);
        return 'Invalid Date';
    }
}
