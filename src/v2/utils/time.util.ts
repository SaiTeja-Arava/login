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
 * Randomizes a given HH:MM time within a specified minute window.
 * 
 * @param {string} baseTime - The central time in HH:MM format (e.g., "09:00").
 * @param {number} windowMinutes - The +/- minute window (e.g., 6 for +/- 6 minutes).
 * @returns {string} A new HH:MM time string, randomized within the window.
 * 
 * @example
 * randomizeTime("09:00", 6) // Returns something like "08:58" or "09:04"
 */
export function randomizeTime(baseTime: string, windowMinutes: number): string {
    try {
        let baseMinutes = parseTime(baseTime); // Converts "HH:MM" to minutes since midnight

        // Generate a random offset between -windowMinutes and +windowMinutes (inclusive)
        const randomOffset = Math.floor(Math.random() * (2 * windowMinutes + 1)) - windowMinutes;
        let randomizedMinutes = baseMinutes + randomOffset;

        // Handle time wrap-around for midnight
        // e.g., 00:05 - 10 minutes = 23:55 (1435 minutes)
        if (randomizedMinutes < 0) {
            randomizedMinutes += 1440; // Add 24 hours in minutes
        } else if (randomizedMinutes >= 1440) {
            randomizedMinutes -= 1440; // Subtract 24 hours in minutes
        }

        const hours = Math.floor(randomizedMinutes / 60);
        const minutes = randomizedMinutes % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } catch (error) {
        console.error(`Error randomizing time for ${baseTime}: ${error}`);
        // Fallback to baseTime on error to ensure a valid time is always returned
        return baseTime;
    }
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

/**
 * Checks if current time is after the scheduled time
 * 
 * @param {string} currentTime - Current time in HH:MM format
 * @param {string} scheduledTime - Scheduled time in HH:MM format
 * @returns {boolean} True if current time is after scheduled time
 * 
 * @example
 * isAfterScheduledTime("10:00", "09:00") // Returns true
 * isAfterScheduledTime("08:00", "09:00") // Returns false
 * isAfterScheduledTime("09:00", "09:00") // Returns false (equal)
 */
export function isAfterScheduledTime(
    currentTime: string,
    scheduledTime: string
): boolean {
    try {
        const currentMinutes = parseTime(currentTime);
        const scheduledMinutes = parseTime(scheduledTime);
        return currentMinutes > scheduledMinutes;
    } catch (error) {
        console.error(`Error in isAfterScheduledTime: ${error}`);
        return false;
    }
}

/**
 * Checks if current time is within X hours after the scheduled time
 * Used for extended retry windows
 * 
 * @param {string} currentTime - Current time in HH:MM format
 * @param {string} scheduledTime - Scheduled time in HH:MM format
 * @param {number} hours - Number of hours for the window
 * @returns {boolean} True if current time is within the hour window after scheduled time
 * 
 * @example
 * isWithinHoursAfter("10:30", "09:00", 2) // Returns true (1.5 hours after)
 * isWithinHoursAfter("11:30", "09:00", 2) // Returns false (2.5 hours after)
 */
export function isWithinHoursAfter(
    currentTime: string,
    scheduledTime: string,
    hours: number
): boolean {
    try {
        const currentMinutes = parseTime(currentTime);
        const scheduledMinutes = parseTime(scheduledTime);

        // Only check if current is after scheduled
        if (currentMinutes <= scheduledMinutes) {
            return false;
        }

        const diffMinutes = currentMinutes - scheduledMinutes;
        const hoursInMinutes = hours * 60;

        return diffMinutes <= hoursInMinutes;
    } catch (error) {
        console.error(`Error in isWithinHoursAfter: ${error}`);
        return false;
    }
}

/**
 * Checks if current time is between two times
 * 
 * @param {string} currentTime - Current time in HH:MM format
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @returns {boolean} True if current time is between start and end (inclusive)
 * 
 * @example
 * isBetweenTimes("15:00", "09:00", "18:00") // Returns true
 * isBetweenTimes("08:00", "09:00", "18:00") // Returns false
 * isBetweenTimes("19:00", "09:00", "18:00") // Returns false
 */
export function isBetweenTimes(
    currentTime: string,
    startTime: string,
    endTime: string
): boolean {
    try {
        const currentMinutes = parseTime(currentTime);
        const startMinutes = parseTime(startTime);
        const endMinutes = parseTime(endTime);

        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } catch (error) {
        console.error(`Error in isBetweenTimes: ${error}`);
        return false;
    }
}
