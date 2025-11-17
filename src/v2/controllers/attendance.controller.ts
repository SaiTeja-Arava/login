/**
 * Attendance Controller
 * 
 * Handles HTTP requests for attendance automation features:
 * - Get attendance logs
 * - Manually trigger attendance automation
 */

import { Request, Response, NextFunction } from 'express';
import { getAttendanceLogs } from '../services/attendance.service';
import { processAttendanceQueue } from '../automation/attendance.automation';
import { acquireLock, releaseLock, isLocked, getLockStatus, getLockStatusForAPI } from '../utils/execution-lock.util';

/**
 * Get attendance logs with optional filtering
 * 
 * Query parameters:
 * - userId: Filter logs by user ID (optional)
 * - limit: Maximum number of logs to return (optional, default: 100)
 * 
 * @route GET /api/v2/attendance/logs
 */
export async function getLogsController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.query.userId as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

        // Validate limit
        if (isNaN(limit) || limit < 1 || limit > 1000) {
            res.status(400).json({
                error: 'Invalid limit parameter. Must be between 1 and 1000.'
            });
            return;
        }

        // Get logs from service
        const logs = await getAttendanceLogs(userId, limit);

        res.status(200).json({
            success: true,
            count: logs.length,
            logs
        });

    } catch (error) {
        console.error('[Controller] Error getting attendance logs:', error);
        next(error);
    }
}

/**
 * Manually trigger attendance automation
 * 
 * This bypasses the scheduler and immediately processes the attendance queue.
 * Useful for testing or manual execution outside of scheduled times.
 * 
 * @route POST /api/v2/attendance/trigger
 */
export async function manualTriggerController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        console.log('[Controller] Manual trigger requested');

        // Check if attendance processing is already in progress
        if (isLocked()) {
            const lockStatus = getLockStatus();
            console.log(`[Controller] Manual trigger REJECTED - already locked by ${lockStatus.source}`);

            res.status(409).json({
                success: false,
                error: 'Attendance processing already in progress',
                message: `Cannot trigger: attendance automation is currently being executed by ${lockStatus.source}`,
                lockedBy: lockStatus.source,
                startedAt: lockStatus.startTime?.toISOString()
            });
            return;
        }

        // Try to acquire the lock
        if (!acquireLock('manual')) {
            // Race condition - lock was acquired between the check and acquisition attempt
            const lockStatus = getLockStatus();
            console.log(`[Controller] Manual trigger REJECTED - lock acquired by ${lockStatus.source} during race`);

            res.status(409).json({
                success: false,
                error: 'Attendance processing already in progress',
                message: 'Another process started execution just before this request',
                lockedBy: lockStatus.source,
                startedAt: lockStatus.startTime?.toISOString()
            });
            return;
        }

        // Lock acquired successfully - send immediate response
        console.log('[Controller] Manual trigger ACCEPTED - lock acquired');
        res.status(202).json({
            success: true,
            message: 'Attendance automation triggered successfully. Processing in background.',
            startedAt: new Date().toISOString()
        });

        // Process queue asynchronously
        try {
            await processAttendanceQueue();
            console.log('[Controller] Manual trigger completed successfully');
        } catch (error) {
            console.error('[Controller] Manual trigger failed:', error);
        } finally {
            // Always release the lock
            releaseLock();
        }

    } catch (error) {
        console.error('[Controller] Error triggering attendance automation:', error);
        next(error);
    }
}

/**
 * Get current execution status
 * 
 * Returns whether attendance automation is currently executing,
 * and if so, by which source (cron or manual).
 * 
 * @route GET /api/v2/attendance/status
 */
export async function getExecutionStatusController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const status = getLockStatusForAPI();

        res.status(200).json({
            success: true,
            ...status
        });

    } catch (error) {
        console.error('[Controller] Error getting execution status:', error);
        next(error);
    }
}
