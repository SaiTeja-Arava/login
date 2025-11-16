import express from 'express';
import * as userController from '../controllers/user.controller';

const router = express.Router();

/**
 * POST /api/sync-user
 * Create or update a user
 */
router.post('/sync-user', userController.syncUserController);

/**
 * GET /api/users/:id
 * Get a user by ID
 */
router.get('/users/:id', userController.getUserController);

/**
 * DELETE /api/users/:id
 * Delete a user by ID
 */
router.delete('/users/:id', userController.deleteUserController);

export default router;
