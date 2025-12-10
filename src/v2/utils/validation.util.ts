import { CreateUserRequest } from '../models/user.model';

/**
 * Validates user ID
 * @param id - User ID to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateUserId(id: string): string[] {
    const errors: string[] = [];

    if (!id || id.trim().length === 0) {
        errors.push('User ID is required');
        return errors;
    }

    if (id.length > 50) {
        errors.push('User ID must be 50 characters or less');
    }

    // Allow alphanumeric, hyphens, and underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        errors.push('User ID can only contain letters, numbers, hyphens, and underscores');
    }

    return errors;
}

/**
 * Validates password
 * @param password - Password to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validatePassword(password: string): string[] {
    const errors: string[] = [];

    if (!password || password.length === 0) {
        errors.push('Password is required');
        return errors;
    }

    if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    return errors;
}

/**
 * Validates time format (HH:MM)
 * @param time - Time string to validate
 * @param fieldName - Name of the field for error messages
 * @returns Array of validation error messages (empty if valid)
 */
export function validateTime(time: string, fieldName: string = 'Time'): string[] {
    const errors: string[] = [];

    if (!time || time.trim().length === 0) {
        errors.push(`${fieldName} is required`);
        return errors;
    }

    // Validate HH:MM format
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(time)) {
        errors.push(`${fieldName} must be in HH:MM format (24-hour, e.g., 09:00 or 18:30)`);
    }

    return errors;
}

/**
 * Validates weekdays array
 * @param weekdays - Array of weekday numbers to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateWeekdays(weekdays: number[]): string[] {
    const errors: string[] = [];

    if (!weekdays || !Array.isArray(weekdays)) {
        errors.push('Weekdays must be an array');
        return errors;
    }

    // if (weekdays.length === 0) {
    //     errors.push('At least one weekday must be selected');
    //     return errors;
    // }

    // Check if all values are between 1 and 7
    const invalidDays = weekdays.filter(day => day < 1 || day > 7);
    if (invalidDays.length > 0) {
        errors.push('Weekdays must be numbers between 1 (Monday) and 7 (Sunday)');
    }

    // Check for duplicates
    const uniqueDays = new Set(weekdays);
    if (uniqueDays.size !== weekdays.length) {
        errors.push('Weekdays cannot contain duplicates');
    }

    return errors;
}

/**
 * Validates that logout time is after login time
 * @param loginTime - Login time in HH:MM format
 * @param logoutTime - Logout time in HH:MM format
 * @returns Array of validation error messages (empty if valid)
 */
export function validateTimeRange(loginTime: string, logoutTime: string): string[] {
    const errors: string[] = [];

    // First validate both times individually
    const loginErrors = validateTime(loginTime, 'Login time');
    const logoutErrors = validateTime(logoutTime, 'Logout time');

    if (loginErrors.length > 0 || logoutErrors.length > 0) {
        // Return early if times are invalid
        return [...loginErrors, ...logoutErrors];
    }

    // Parse times for comparison
    const [loginHour, loginMinute] = loginTime.split(':').map(Number);
    const [logoutHour, logoutMinute] = logoutTime.split(':').map(Number);

    const loginMinutes = loginHour * 60 + loginMinute;
    const logoutMinutes = logoutHour * 60 + logoutMinute;

    if (logoutMinutes <= loginMinutes) {
        errors.push('Logout time must be after login time');
    }

    return errors;
}

/**
 * Validates complete user object
 * @param user - User data to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateUser(user: CreateUserRequest): string[] {
    const errors: string[] = [];

    // Validate each field
    errors.push(...validateUserId(user.id));
    errors.push(...validatePassword(user.password));
    errors.push(...validateWeekdays(user.weekdays));
    errors.push(...validateTimeRange(user.loginTime, user.logoutTime));

    return errors;
}
