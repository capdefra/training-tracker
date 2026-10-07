import { createServer } from 'vite';
import { resolve } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/run-ts.mjs <file.ts>');
  process.exit(1);
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  await server.ssrLoadModule(resolve(file));
} finally {
  await server.close();
}
