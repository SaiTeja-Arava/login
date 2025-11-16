import express from 'express';
import path from 'path';
import userRoutes from './routes/user.routes';
import attendanceRoutes from './routes/attendance.routes';
import { errorHandler } from './middleware/error.middleware';
import { ensureFileExists } from './utils/file.util';
import { SERVER_PORT } from './config/constants';
import { startScheduler } from './automation/scheduler';
import { ensureAttendanceLogFileExists } from './utils/attendance-log.util';

const app = express();

/**
 * Middleware Setup
 */

// Parse JSON request bodies
app.use(express.json());

// Enable CORS for all routes (allow all origins for now)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Routes
 */

// Mount API routes
app.use('/api', userRoutes);
app.use('/api/attendance', attendanceRoutes);

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Error Handling
 */

// Global error handler (must be last)
app.use(errorHandler);

/**
 * Server Initialization
 */

async function startServer(): Promise<void> {
    try {
        // Ensure data directory and users.json file exist
        await ensureFileExists();
        console.log('✓ Data file initialized');

        // Ensure attendance logs file exists
        await ensureAttendanceLogFileExists();
        console.log('✓ Attendance logs file initialized');

        // Start server
        app.listen(SERVER_PORT, () => {
            console.log(`\n🚀 Server running on http://localhost:${SERVER_PORT}`);
            console.log(`📂 API endpoints:`);
            console.log(`   - POST   http://localhost:${SERVER_PORT}/api/sync-user`);
            console.log(`   - GET    http://localhost:${SERVER_PORT}/api/users/:id`);
            console.log(`   - DELETE http://localhost:${SERVER_PORT}/api/users/:id`);
            console.log(`   - GET    http://localhost:${SERVER_PORT}/api/attendance/logs`);
            console.log(`   - POST   http://localhost:${SERVER_PORT}/api/attendance/trigger`);
            console.log(`\n🌐 UI available at http://localhost:${SERVER_PORT}\n`);

            // Start the attendance automation scheduler
            startScheduler();
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();
