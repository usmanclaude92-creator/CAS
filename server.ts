import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { app } from './src/server/app';

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  const entry = { level, message, time: new Date().toISOString(), ...meta };
  console[level === 'info' ? 'log' : level](JSON.stringify(entry));
}

const PORT = Number(process.env.PORT) || 3000;

// ==========================================
// VITE MIDDLEWARE (Development) & STATIC SERVING (Production)
// Only used for local dev and traditional (non-Vercel) hosting. On Vercel,
// api/index.ts wraps the same `app` as a serverless function and the static
// build is served directly from `dist/` by Vercel's CDN.
// ==========================================
let httpServer: ReturnType<typeof app.listen> | null = null;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer = app.listen(PORT, '0.0.0.0', () => {
    log('info', `Express + Vite backend listening on http://0.0.0.0:${PORT}`);
  });
}

function shutdown(signal: string) {
  log('info', `Received ${signal}, shutting down gracefully.`);
  if (httpServer) {
    httpServer.close(() => {
      log('info', 'HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
