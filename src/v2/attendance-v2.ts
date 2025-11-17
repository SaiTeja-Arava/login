import { AttendanceActionParams, AttendanceActionResult } from './models/attendance.model';
import { getAttendanceProvider } from './providers/provider.factory';

/**
 * ============================================
 * ATTENDANCE AUTOMATION - PROVIDER ABSTRACTION
 * ============================================
 * 
 * This file is provider-agnostic and works with any attendance provider
 * that implements the IAttendanceProvider interface.
 * 
 * The actual provider is configured in:
 * - src/v2/providers/provider.factory.ts (provider selection)
 * - src/v2/config/constants.ts (DEFAULT_PROVIDER setting)
 * 
 * To switch providers, change DEFAULT_PROVIDER in constants.ts
 */

/**
 * Main entry point for attendance action
 * Routes to the configured provider based on action type
 * 
 * This function is provider-agnostic - it works with any provider
 * that implements the IAttendanceProvider interface.
 * 
 * @param {AttendanceActionParams} params - Action parameters (user object with action type)
 * @returns {Promise<AttendanceActionResult>} Result with log_in and log_out flags
 */
export async function performAttendanceAction(
    params: AttendanceActionParams
): Promise<AttendanceActionResult> {
    const { action, user } = params;
    const provider = getAttendanceProvider();

    try {
        console.log(`[Attendance] Executing ${action} for user ${user.id} via ${provider.getName()}`);

        // Check health before proceeding
        const isHealthy = await provider.healthCheck();
        if (!isHealthy) {
            console.error('[Attendance] Health check failed - no internet connection');
            return {
                log_in: false,
                log_out: false
            };
        }

        // Prepare credentials
        const credentials = {
            userId: user.id,
            password: user.password || '' // Password should already be decrypted
        };

        // Execute action based on type
        if (action === 'login') {
            const result = await provider.login(credentials);
            console.log(`[Attendance] Login result for ${user.id}:`, result.success ? 'SUCCESS' : 'FAILED');

            return {
                log_in: result.success,
                log_out: false,
                actualInTime: result.actualInTime
            };

        } else if (action === 'logout') {
            const result = await provider.logout(credentials);
            console.log(`[Attendance] Logout result for ${user.id}:`, result.success ? 'SUCCESS' : 'FAILED');

            return {
                log_in: false,
                log_out: result.success,
                actualOutTime: result.actualOutTime
            };

        } else {
            // Invalid action type
            console.error(`[Attendance] Invalid action type: ${action}`);
            return {
                log_in: false,
                log_out: false
            };
        }

    } catch (error) {
        console.error(`[Attendance] Error executing ${action} for ${user.id}:`, error);
        return {
            log_in: false,
            log_out: false
        };
    }
}
