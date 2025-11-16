/**
 * Attendance Routes
 * 
 * Defines API endpoints for attendance automation features.
 */

import { Router } from 'express';
import { getLogsController, manualTriggerController } from '../controllers/attendance.controller';

const router = Router();

/**
 * GET /api/v2/attendance/logs
 * Get attendance execution logs
 * 
 * Query parameters:
 * - userId (optional): Filter logs by user ID
 * - limit (optional): Maximum number of logs to return (default: 100, max: 1000)
 */
router.get('/logs', getLogsController);

/**
 * POST /api/v2/attendance/trigger
 * Manually trigger attendance automation
 * 
 * Immediately processes the attendance queue outside of scheduled times.
 * Useful for testing or manual execution.
 */
router.post('/trigger', manualTriggerController);

export default router;
