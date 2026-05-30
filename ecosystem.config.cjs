module.exports = {
  apps: [
    {
      name: 'zeromultas',
      cwd: '/home/deploy/zero-multas',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
      max_memory_restart: '500M',
      autorestart: true,
    },
  ],
}
