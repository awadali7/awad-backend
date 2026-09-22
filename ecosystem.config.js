/**
 * PM2 config for awad-backend.
 *
 * Written to coexist with whatever else PM2 already runs on the box: it uses a
 * distinct app name and its own port, and touches nothing global. Start it with
 *   pm2 start ecosystem.config.js
 * which ADDS this app to the PM2 process list rather than replacing it.
 *
 * HOST=127.0.0.1 keeps the port off the public internet — nginx proxies to it.
 * Secrets are NOT listed here; this file is committed. Put them in .env next to
 * it (gitignored), which the app loads via @nestjs/config.
 */
module.exports = {
  apps: [
    {
      name: 'awad-backend',
      script: 'dist/src/main.js',
      cwd: __dirname,
      instances: 1,
      // Keep it at 1: the login rate limiter stores counters in-process, so a
      // second instance would double the attempts allowed per minute.
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: 3001,
      },
      max_memory_restart: '300M',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
