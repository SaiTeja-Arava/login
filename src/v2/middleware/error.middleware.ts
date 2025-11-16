import { Request, Response, NextFunction } from 'express';

/**
 * Global error handling middleware
 * Catches all errors thrown in the application and formats them
 */
export function errorHandler(
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    // Log error to console for debugging
    console.error('Error:', error.message);
    if (error.errors) {
        console.error('Validation errors:', error.errors);
    }

    // Determine status code
    const statusCode = error.statusCode || 500;

    // Format error response based on error type
    const response: any = {
        success: false,
        message: error.message || 'Internal server error'
    };

    // Include validation errors if present
    if (error.errors && Array.isArray(error.errors)) {
        response.errors = error.errors;
    }

    // Send error response
    res.status(statusCode).json(response);
}
