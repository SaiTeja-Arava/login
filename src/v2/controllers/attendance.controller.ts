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

        // Send immediate response
        res.status(202).json({
            success: true,
            message: 'Attendance automation triggered. Processing in background.'
        });

        // Process queue asynchronously (don't await)
        processAttendanceQueue()
            .then(() => {
                console.log('[Controller] Manual trigger completed successfully');
            })
            .catch((error) => {
                console.error('[Controller] Manual trigger failed:', error);
            });

    } catch (error) {
        console.error('[Controller] Error triggering attendance automation:', error);
        next(error);
    }
}
