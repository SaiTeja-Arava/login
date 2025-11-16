import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';

/**
 * Controller for syncing a user (create or update)
 * POST /api/sync-user
 */
export async function syncUserController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { user, isNew } = await userService.syncUser(req.body);

        // Return user without password in sync response
        const { password, ...userWithoutPassword } = user;

        res.status(isNew ? 201 : 200).json({
            success: true,
            message: isNew ? 'User created successfully' : 'User updated successfully',
            isNew,
            user: userWithoutPassword
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Controller for getting a user by ID
 * GET /api/users/:id
 */
export async function getUserController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { id } = req.params;
        const user = await userService.findUserById(id);

        if (!user) {
            const error = new Error('User not found');
            (error as any).statusCode = 404;
            throw error;
        }

        // Include decrypted password in get user response
        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Controller for deleting a user
 * DELETE /api/users/:id
 */
export async function deleteUserController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { id } = req.params;
        await userService.deleteUser(id);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        next(error);
    }
}
