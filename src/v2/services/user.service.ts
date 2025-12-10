import { User, CreateUserRequest } from '../models/user.model';
import { encrypt, decrypt } from '../utils/encryption.util';
import { validateUser, validateUserId, validatePassword, validateTimeRange, validateWeekdays } from '../utils/validation.util';
import { readUsersFromFile, writeUsersToFile } from '../utils/file.util';

/**
 * Finds a user by ID
 * @param id - User ID to search for
 * @returns User object with decrypted password, or null if not found
 */
export async function findUserById(id: string): Promise<User | null> {
    const users = await readUsersFromFile();
    const user = users.find(u => u.id === id);

    if (!user) {
        return null;
    }

    // Decrypt password before returning
    return {
        ...user,
        password: decrypt(user.password)
    };
}

/**
 * Creates a new user
 * @param userData - User data to create
 * @returns Created user with encrypted password
 * @throws Error if validation fails or user already exists
 */
export async function createUser(userData: CreateUserRequest): Promise<User> {
    // Validate user data
    const validationErrors = validateUser(userData);
    if (validationErrors.length > 0) {
        const error = new Error('Validation failed');
        (error as any).statusCode = 400;
        (error as any).errors = validationErrors;
        throw error;
    }

    // Check if user already exists
    const users = await readUsersFromFile();
    const existingUser = users.find(u => u.id === userData.id);

    if (existingUser) {
        const error = new Error('User already exists');
        (error as any).statusCode = 409;
        throw error;
    }

    // Encrypt password
    const encryptedPassword = encrypt(userData.password);

    // Create new user object
    const newUser: User = {
        id: userData.id,
        password: encryptedPassword,
        loginTime: userData.loginTime,
        logoutTime: userData.logoutTime,
        weekdays: userData.weekdays
    };

    // Add to users array and save
    users.push(newUser);
    await writeUsersToFile(users);

    return newUser;
}

/**
 * Updates an existing user
 * @param id - User ID to update
 * @param userData - Updated user data
 * @returns Updated user with encrypted password
 * @throws Error if user not found or validation fails
 */
export async function updateUser(id: string, userData: CreateUserRequest): Promise<User> {
    // For updates, password can be optional. If empty, we keep the old one.
    const isPasswordUpdate = userData.password && userData.password.length > 0;

    // Manually validate fields since password can be optional on update
    const validationErrors = [
        ...validateUserId(userData.id),
        ...validateWeekdays(userData.weekdays),
        ...validateTimeRange(userData.loginTime, userData.logoutTime)
    ];

    if (isPasswordUpdate) {
        validationErrors.push(...validatePassword(userData.password));
    }

    if (validationErrors.length > 0) {
        const error = new Error('Validation failed');
        (error as any).statusCode = 400;
        (error as any).errors = validationErrors;
        throw error;
    }

    const users = await readUsersFromFile();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
        const error = new Error('User not found');
        (error as any).statusCode = 404;
        throw error;
    }

    // Encrypt password only if a new one is provided
    const encryptedPassword = isPasswordUpdate
        ? encrypt(userData.password)
        : users[userIndex].password; // Keep old password

    // Update user object, preserving existing fields like todayStatus
    const updatedUser: User = {
        ...users[userIndex],
        id: id,
        password: encryptedPassword,
        loginTime: userData.loginTime,
        logoutTime: userData.logoutTime,
        weekdays: userData.weekdays
    };

    // Check if loginTime, logoutTime, or weekdays have changed
    const originalUser = users[userIndex];
    if (updatedUser.loginTime !== originalUser.loginTime ||
        updatedUser.logoutTime !== originalUser.logoutTime ||
        !arraysEqual(updatedUser.weekdays, originalUser.weekdays)) {
        
        // If any schedule-related field changed, clear randomized times to force recalculation on next daily reset
        if (updatedUser.todayStatus) {
            updatedUser.todayStatus.randomizedLoginTime = undefined;
            updatedUser.todayStatus.randomizedLogoutTime = undefined;
        }
    }

    users[userIndex] = updatedUser;
    await writeUsersToFile(users);

    return updatedUser;
}

/**
 * Helper function to compare two number arrays
 */
function arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort((x, y) => x - y);
    const sortedB = [...b].sort((x, y) => x - y);
    for (let i = 0; i < sortedA.length; i++) {
        if (sortedA[i] !== sortedB[i]) return false;
    }
    return true;
}

/**
 * Deletes a user by ID
 * @param id - User ID to delete
 * @returns true if deleted successfully
 * @throws Error if user not found
 */
export async function deleteUser(id: string): Promise<boolean> {
    const users = await readUsersFromFile();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
        const error = new Error('User not found');
        (error as any).statusCode = 404;
        throw error;
    }

    users.splice(userIndex, 1);
    await writeUsersToFile(users);

    return true;
}

/**
 * Syncs a user (creates if new, updates if exists)
 * @param userData - User data to sync
 * @returns Object containing the user and a flag indicating if it's new
 */
export async function syncUser(userData: CreateUserRequest): Promise<{ user: User; isNew: boolean }> {
    const existingUser = await findUserById(userData.id);

    if (existingUser) {
        // User exists, update it
        const updatedUser = await updateUser(userData.id, userData);
        return {
            user: updatedUser,
            isNew: false
        };
    } else {
        // User doesn't exist, create it
        const newUser = await createUser(userData);
        return {
            user: newUser,
            isNew: true
        };
    }
}
