const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 9615;

// PM2 logs directory
const PM2_HOME = path.join(process.env.USERPROFILE || process.env.HOME, '.pm2');
const PM2_LOGS = path.join(PM2_HOME, 'logs');

app.get('/', async (req, res) => {
    try {
        let processHtml = '';
        
        // Check if attendance-server log file exists (indicating it's been running)
        const outLogFile = path.join(PM2_LOGS, 'attendance-server-out.log');
        const errorLogFile = path.join(PM2_LOGS, 'attendance-server-error.log');
        
        const isRunning = fs.existsSync(outLogFile) || fs.existsSync(errorLogFile);
        
        if (isRunning) {
            const statusClass = 'online';
            const status = 'ONLINE';
            
            processHtml = `
                <div class="process-card">
                    <h3>attendance-server</h3>
                    <span class="status ${statusClass}">${status}</span>
                    <div class="info">
                        <p><strong>Type:</strong> Attendance Automation</p>
                        <p><strong>Port:</strong> 7889</p>
                        <p><strong>Logs:</strong> Streaming</p>
                    </div>
                    <button class="log-btn" onclick="viewLogs('attendance-server')">📋 View Logs</button>
                </div>
            `;
        } else {
            processHtml = '<div class="process-card" style="color: #dc3545;">No attendance-server process logs found</div>';
        }

        res.send(`<!DOCTYPE html>
<html>
<head>
    <title>PM2 Dashboard</title>
    <meta http-equiv="refresh" content="60">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #282c34; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .header h1 { margin: 0 0 10px 0; }
        .process-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .process-card { background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .process-card h3 { margin: 0; color: #282c34; }
        .status { display: inline-block; padding: 8px 12px; border-radius: 3px; font-weight: bold; margin: 10px 0; }
        .status.online { background: #28a745; color: white; }
        .status.stopped { background: #dc3545; color: white; }
        .info { margin: 10px 0; font-size: 14px; }
        .info p { margin: 5px 0; }
        .log-btn { padding: 8px 15px; background: #17a2b8; color: white; border: none; border-radius: 3px; cursor: pointer; margin-top: 10px; }
        .log-btn:hover { background: #138496; }
    </style>
    <script>
        function viewLogs(app) { window.open('/logs/' + app, '_blank'); }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Attendance Manager Dashboard</h1>
            <p>Auto-refreshing every 60 seconds...</p>
        </div>
        <div class="process-list">${processHtml}</div>
    </div>
</body>
</html>`);
    } catch (err) {
        res.send(`<pre style="color: red;">Error: ${err.message}</pre>`);
    }
});

app.get('/logs/:app', (req, res) => {
    try {
        const appName = req.params.app;
        const pm2Logs = path.join(process.env.USERPROFILE || process.env.HOME, '.pm2', 'logs');
        const outLogFile = path.join(pm2Logs, `${appName}-out.log`);
        const errorLogFile = path.join(pm2Logs, `${appName}-error.log`);

        let logs = '';
        
        // Read output logs
        if (fs.existsSync(outLogFile)) {
            try {
                const content = fs.readFileSync(outLogFile, 'utf-8');
                const lines = content.split('\n').slice(-10000); // Last 10000 lines (~1 minute)
                logs += lines.join('\n');
            } catch (e) {
                logs += `\nError reading output logs: ${e.message}`;
            }
        }

        // Get current time in IST
        const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Attendance Manager Logs</title>
    <meta http-equiv="refresh" content="60">
    <style>
        body { font-family: 'Courier New', monospace; background: #1e1e1e; color: #d4d4d4; margin: 0; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { color: #4ec9b0; margin-bottom: 20px; }
        .header h2 { margin: 0 0 10px 0; font-size: 24px; }
        .controls { margin-bottom: 15px; display: flex; gap: 10px; align-items: center; }
        a { color: #569cd6; text-decoration: none; padding: 8px 12px; background: #2d2d30; border-radius: 3px; display: inline-block; }
        a:hover { background: #3e3e42; }
        button { color: #d4d4d4; background: #2d2d30; border: 1px solid #3e3e42; padding: 8px 12px; border-radius: 3px; cursor: pointer; }
        button:hover { background: #3e3e42; }
        .timestamp { color: #858585; font-size: 12px; }
        .info { color: #4ec9b0; }
        .success { color: #28a745; }
        .error { color: #f48771; }
        .warning { color: #dcdcaa; }
    </style>
    <script>
        function copyLogs() {
            const logsText = document.getElementById('logsContent').innerText;
            navigator.clipboard.writeText(logsText).then(() => {
                alert('Logs copied to clipboard!');
            }).catch(() => {
                alert('Failed to copy logs');
            });
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📋 Attendance Manager Live Logs</h2>
            <div class="controls">
                <a href="/">← Back to Dashboard</a>
                <button onclick="copyLogs()">📋 Copy Logs</button>
                <span class="timestamp">Last updated: ${now} IST</span>
                <span style="color: #858585; margin-left: auto;">Auto-refreshing every 60 seconds...</span>
            </div>
        </div>
        <pre id="logsContent">${logs.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </div>
</body>
</html>`);
    } catch (err) {
        res.send(`<pre style="color: #f48771;">Error: ${err.message}</pre>`);
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatUptime(timestamp) {
    if (!timestamp) return 'N/A';
    const ms = Date.now() - timestamp;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════╗
║   PM2 Dashboard Started ✓           ║
╚══════════════════════════════════════╝

📊 Listening on all interfaces (port ${PORT})

Access locally:   http://localhost:${PORT}
Access from LAN:  http://10.1.4.163:${PORT}
Access via Tailscale: http://100.71.6.84:${PORT}

Open from any browser!
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Dashboard] Shutting down...');
    process.exit(0);
});
