module.exports = {
  apps: [{
    name: 'franksfotos-prod',
    // Direkt next aufrufen mit explizitem Port (nicht über npm start, um ENV-Vererbungsprobleme zu vermeiden)
    script: 'node_modules/.bin/next',
    args: 'start -p 3001',
    cwd: '/home/users/franksellke/www/frank-sellke',
    instances: 1,
    exec_mode: 'fork',
    error_file: '/home/users/franksellke/www/frank-sellke/log/pm2/franksfotos-error.log',
    out_file: '/home/users/franksellke/www/frank-sellke/log/pm2/franksfotos-out.log',
    log_file: '/home/users/franksellke/www/frank-sellke/log/pm2/franksfotos-combined.log',
    time: true,
    max_memory_restart: '2G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: [
      'node_modules',
      'logs',
      '.git'
    ],
    restart_delay: 5000,
    max_restarts: 15,
    min_uptime: '15s',
    env: {
      NODE_ENV: 'production',
      PORT: '3001',

      // Database Configuration
      DATABASE_HOST: '87.118.90.98',
      DATABASE_PORT: '3306',
      DATABASE_USER: 'franksellke',
      DATABASE_PASSWORD: 'B5tkfUXoEZy!tY8zQV',
      DATABASE_NAME: 'fotodatenbank',
      DATABASE_URL: 'mysql://franksellke:B5tkfUXoEZy!tY8zQV@87.118.90.98:3306/fotodatenbank',

      // Auth (NextAuth.js)
      AUTH_SECRET: 'f35b2d5876f4a33cc1d6d159d9142f20f116406d4ba0c933350c2d0173adf867',
      AUTH_URL: 'https://www.frank-sellke.de',

      // Upload
      UPLOAD_DOMAIN: 'https://pics.frank-sellke.de',
      UPLOAD_API_KEY: 'eb79f197cb6766d3a889e69ccf5eea0ecfe550ce3d61b043e2e2d9777d62d2a9',
      UPLOAD_PHP_ENDPOINT: 'https://pics.frank-sellke.de/upload.php',

      // Wasserzeichen
      WATERMARK_TEXT: '© FranksFotos – frank-sellke.de',
      WATERMARK_OPACITY: '0.4',

      // App
      SITE_BASE_URL: 'https://www.frank-sellke.de',
      NEXT_PUBLIC_APP_URL: 'https://www.frank-sellke.de',
      NEXT_PUBLIC_APP_NAME: 'FranksFotos',
      NEXT_PUBLIC_MEDIA_BASE_URL: 'https://pics.frank-sellke.de',

      // Performance
      NEXT_TELEMETRY_DISABLED: '1'
    }
  }]
}
