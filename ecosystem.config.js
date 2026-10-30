module.exports = {
  apps: [
    {
      name: "login-server",

      script: "dist\\v2\\index.js",          // entry file
      cwd: "C:\\Users\\Admin\\Documents\\login", // current working directory

      // ---- Auto restart ----
      autorestart: true,

      // ---- Restart delay (ms) ----
      restart_delay: 5000,       // wait 5s before restart

      // ---- Max restarts ----
      max_restarts: 10,         // stop after 10 rapid restarts

      // ---- Logs ----
      out_file: "logs/login-out.log",
      error_file: "logs/login-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      // ---- Environment ----
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
