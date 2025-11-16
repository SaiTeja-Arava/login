/**
 * Attendance Log Utility
 * 
 * Handles reading, writing, and managing attendance execution logs.
 * Uses atomic file operations to prevent data corruption.
 */

import fs from 'fs/promises';
import path from 'path';
import { ATTENDANCE_LOGS_PATH } from '../config/constants';
import { AttendanceLog } from '../models/attendance.model';

/**
 * Maximum number of logs to retain (FIFO - First In, First Out)
 */
const MAX_LOGS = 1000;

/**
 * Ensures the attendance log file exists
 * Creates the file with an empty array if it doesn't exist
 * Also creates parent directories if needed
 * 
 * @returns {Promise<void>}
 */
export async function ensureAttendanceLogFileExists(): Promise<void> {
    try {
        // Check if file exists
        await fs.access(ATTENDANCE_LOGS_PATH);
    } catch (error) {
        // File doesn't exist, create it
        const dir = path.dirname(ATTENDANCE_LOGS_PATH);

        // Create directory if it doesn't exist
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (mkdirError) {
            // Ignore error if directory already exists
        }

        // Create file with empty array
        await fs.writeFile(ATTENDANCE_LOGS_PATH, '[]', 'utf-8');
        console.log(`✓ Created attendance logs file: ${ATTENDANCE_LOGS_PATH}`);
    }
}

/**
 * Reads attendance logs from the file
 * 
 * @returns {Promise<AttendanceLog[]>} Array of attendance logs
 * @throws {Error} If file read or JSON parse fails
 */
export async function readLogsFromFile(): Promise<AttendanceLog[]> {
    try {
        // Ensure file exists before reading
        await ensureAttendanceLogFileExists();

        const data = await fs.readFile(ATTENDANCE_LOGS_PATH, 'utf-8');
        const logs = JSON.parse(data);

        // Validate that it's an array
        if (!Array.isArray(logs)) {
            console.error('Attendance logs file is not an array, recreating...');
            await fs.writeFile(ATTENDANCE_LOGS_PATH, '[]', 'utf-8');
            return [];
        }

        return logs;
    } catch (error) {
        if (error instanceof SyntaxError) {
            // JSON parse error - file is corrupted
            console.error('Attendance logs file is corrupted, recreating...');
            await fs.writeFile(ATTENDANCE_LOGS_PATH, '[]', 'utf-8');
            return [];
        }
        throw new Error(`Failed to read attendance logs: ${error}`);
    }
}

/**
 * Writes attendance logs to the file using atomic operation
 * Uses a temporary file and rename to prevent corruption
 * 
 * @param {AttendanceLog[]} logs - Array of attendance logs to write
 * @returns {Promise<void>}
 * @throws {Error} If file write fails
 */
export async function writeLogsToFile(logs: AttendanceLog[]): Promise<void> {
    const tempPath = `${ATTENDANCE_LOGS_PATH}.tmp`;

    try {
        // Ensure directory exists
        const dir = path.dirname(ATTENDANCE_LOGS_PATH);
        await fs.mkdir(dir, { recursive: true });

        // Write to temporary file with pretty formatting
        const jsonData = JSON.stringify(logs, null, 2);
        await fs.writeFile(tempPath, jsonData, 'utf-8');

        // Atomic rename (replaces old file)
        await fs.rename(tempPath, ATTENDANCE_LOGS_PATH);
    } catch (error) {
        // Clean up temp file if it exists
        try {
            await fs.unlink(tempPath);
        } catch (unlinkError) {
            // Ignore cleanup error
        }

        throw new Error(`Failed to write attendance logs: ${error}`);
    }
}

/**
 * Appends a new log entry to the attendance logs
 * Automatically trims old logs if the count exceeds MAX_LOGS
 * 
 * @param {AttendanceLog} log - The log entry to append
 * @returns {Promise<void>}
 * @throws {Error} If read or write fails
 */
export async function appendLog(log: AttendanceLog): Promise<void> {
    try {
        // Read existing logs
        const logs = await readLogsFromFile();

        // Add new log
        logs.push(log);

        // Trim old logs if necessary (FIFO - remove oldest)
        if (logs.length > MAX_LOGS) {
            const excessCount = logs.length - MAX_LOGS;
            logs.splice(0, excessCount);
            console.log(`Trimmed ${excessCount} old log entries (max ${MAX_LOGS} logs)`);
        }

        // Write back to file
        await writeLogsToFile(logs);
    } catch (error) {
        throw new Error(`Failed to append log: ${error}`);
    }
}

/**
 * Gets logs filtered by user ID and limited by count
 * 
 * @param {string} [userId] - Optional user ID to filter by
 * @param {number} [limit] - Optional maximum number of logs to return
 * @returns {Promise<AttendanceLog[]>} Filtered and limited logs in reverse chronological order
 */
export async function getFilteredLogs(
    userId?: string,
    limit?: number
): Promise<AttendanceLog[]> {
    try {
        let logs = await readLogsFromFile();

        // Filter by user ID if provided
        if (userId) {
            logs = logs.filter(log => log.userId === userId);
        }

        // Sort by execution time (most recent first)
        logs.sort((a, b) => {
            return new Date(b.executionTime).getTime() - new Date(a.executionTime).getTime();
        });

        // Limit results if specified
        if (limit && limit > 0) {
            logs = logs.slice(0, limit);
        }

        return logs;
    } catch (error) {
        throw new Error(`Failed to get filtered logs: ${error}`);
    }
}
