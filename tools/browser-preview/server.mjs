#!/usr/bin/env node
/**
 * tools/browser-preview/server.mjs
 *
 * Lightweight local preview server for P0 visual QA.
 * Serves preview.html and canonical motion assets.
 * Zero external dependencies.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const LOOPBACK_HOST = '127.0.0.1';

const EXACT_ROUTES = new Map([
  ['/', join(__dirname, 'preview.html')],
  ['/index.html', join(__dirname, 'preview.html')],
  ['/preview.html', join(__dirname, 'preview.html')],
  ['/preview-session.mjs', join(__dirname, 'preview-session.mjs')],
  ['/preview-client.mjs', join(__dirname, 'preview-client.mjs')],
]);

const DIRECTORY_ROUTES = [
  {
    urlPrefix: '/src/app/assets/sfx/',
    directory: join(ROOT, 'src', 'app', 'assets', 'sfx'),
    extensions: new Set(['.wav']),
  },
  {
    urlPrefix: '/.preview-dist/app/motion/',
    directory: join(ROOT, '.preview-dist', 'app', 'motion'),
    extensions: new Set(['.js']),
  },
  {
    urlPrefix: '/.preview-dist/app/session/',
    directory: join(ROOT, '.preview-dist', 'app', 'session'),
    extensions: new Set(['.js']),
  },
  {
    urlPrefix: '/.preview-dist/game/',
    directory: join(ROOT, '.preview-dist', 'game'),
    extensions: new Set(['.js']),
  },
  {
    urlPrefix: '/src/game/assets/motion/',
    directory: join(ROOT, 'src', 'game', 'assets', 'motion'),
    extensions: new Set(['.json']),
  },
];

const MIME_TYPES = {
  '.wav': 'audio/wav',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function resolveWithin(directory, requestedPath) {
  const target = resolve(directory, requestedPath);
  const relativePath = relative(directory, target);
  if (relativePath === '' || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return null;
  }
  return target;
}

function resolveAllowedPath(pathname) {
  const exact = EXACT_ROUTES.get(pathname);
  if (exact != null) return exact;

  for (const route of DIRECTORY_ROUTES) {
    if (!pathname.startsWith(route.urlPrefix)) continue;
    const requestedPath = pathname.slice(route.urlPrefix.length);
    const filePath = resolveWithin(route.directory, requestedPath);
    if (filePath == null || !route.extensions.has(extname(filePath).toLowerCase())) {
      return null;
    }
    return filePath;
  }

  return null;
}

export function createPreviewServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${LOOPBACK_HOST}`);
      const pathname = decodeURIComponent(url.pathname);
      const filePath = resolveAllowedPath(pathname);

      const fileStat = filePath == null ? null : await stat(filePath).catch(() => null);
      if (!fileStat || !fileStat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Not Found: ${pathname}`);
        return;
      }

      const content = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': getContentType(filePath),
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Internal Server Error: ${err.message}`);
    }
  });
}

export async function startServer(preferredPort = 3000, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = preferredPort + attempt;
    const server = createPreviewServer();
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, LOOPBACK_HOST, resolve);
      });

      const url = `http://${LOOPBACK_HOST}:${port}`;
      console.log('\n======================================================');
      console.log('🥊 Boxing Talent P0 — Dev Browser Preview');
      console.log('------------------------------------------------------');
      console.log(`🌐 Preview URL: ${url}`);
      console.log('📱 Viewport:    390 × 844 (Mobile Frame)');
      console.log('🥋 Motion:      Canonical Jab / Straight / Hook (19 Joints)');
      console.log('🕹️ Controls:    LEFT / RIGHT / BACK / GUARD + Retry');
      console.log('⚠️ Notice:      DEV PREVIEW ONLY · Not Granite runtime');
      console.log('------------------------------------------------------');
      console.log('Press Ctrl+C to stop.');
      console.log('======================================================\n');

      if (process.argv.includes('--open')) {
        const cmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
        exec(cmd).unref();
      }

      return { server, port, url };
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
    }
  }

  throw new Error(`Could not find an open port starting from ${preferredPort}`);
}

// Auto-start if executed directly via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().catch((err) => {
    console.error('Failed to start preview server:', err);
    process.exit(1);
  });
}
