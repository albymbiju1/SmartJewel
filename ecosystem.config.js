module.exports = {
  apps: [{
    name: 'smartjewel-wa',
    script: './whatsapp-service/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3300
    },
    error_file: './whatsapp-service/logs/error.log',
    out_file: './whatsapp-service/logs/out.log',
    log_file: './whatsapp-service/logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Restart policy
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s',

    // Process management
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true
  }]
};
