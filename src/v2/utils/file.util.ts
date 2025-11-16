import fs from 'fs/promises';
import path from 'path';
import { USERS_FILE_PATH } from '../config/constants';
import { User } from '../models/user.model';

/**
 * Ensures the users.json file exists
 * Creates the file with an empty array if it doesn't exist
 * @throws Error if directory creation or file creation fails
 */
export async function ensureFileExists(): Promise<void> {
    try {
        // Check if file exists
        try {
            await fs.access(USERS_FILE_PATH);
            // File exists, do nothing
            return;
        } catch {
            // File doesn't exist, create it
        }

        // Ensure parent directory exists
        const dirPath = path.dirname(USERS_FILE_PATH);
        await fs.mkdir(dirPath, { recursive: true });

        // Create file with empty array
        await fs.writeFile(USERS_FILE_PATH, '[]', 'utf8');
    } catch (error) {
        throw new Error(`Failed to ensure file exists: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Reads all users from the JSON file
 * @returns Array of users
 * @throws Error if file read or JSON parse fails
 */
export async function readUsersFromFile(): Promise<User[]> {
    try {
        // Ensure file exists first
        await ensureFileExists();

        // Read file content
        const fileContent = await fs.readFile(USERS_FILE_PATH, 'utf8');

        // Parse JSON
        const users = JSON.parse(fileContent);

        // Validate it's an array
        if (!Array.isArray(users)) {
            throw new Error('Invalid users file format: expected array');
        }

        return users;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error('Invalid JSON in users file');
        }
        throw new Error(`Failed to read users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Writes users array to the JSON file
 * Uses atomic write (write to temp file, then rename) to prevent corruption
 * @param users - Array of users to write
 * @throws Error if file write fails
 */
export async function writeUsersToFile(users: User[]): Promise<void> {
    try {
        // Ensure directory exists
        const dirPath = path.dirname(USERS_FILE_PATH);
        await fs.mkdir(dirPath, { recursive: true });

        // Convert to JSON with pretty formatting
        const jsonContent = JSON.stringify(users, null, 2);

        // Atomic write: write to temp file first
        const tempFilePath = `${USERS_FILE_PATH}.tmp`;
        await fs.writeFile(tempFilePath, jsonContent, 'utf8');

        // Rename temp file to actual file (atomic operation)
        await fs.rename(tempFilePath, USERS_FILE_PATH);
    } catch (error) {
        throw new Error(`Failed to write users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
