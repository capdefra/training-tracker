import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Each production build stamps an id into the bundle and into version.json.
// A tab still running an older bundle compares the two and reloads.
function deployVersion(): Plugin {
  const buildId = new Date().toISOString()
  const body = `${JSON.stringify({ buildId })}\n`
  return {
    name: 'deploy-version',
    config() {
      return {
        define: {
          __APP_BUILD_ID__: JSON.stringify(buildId),
        },
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (!path.endsWith('/version.json')) {
          next()
          return
        }
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.end(body)
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: body,
      })
    },
  }
}

// Relative base so the same build works locally and on GitHub project pages
// (https://<user>.github.io/<repo>/) without hardcoding the repository name.
export default defineConfig({
  plugins: [react(), deployVersion()],
  base: './',
  server: {
    port: 43217,
  },
  preview: {
    port: 43217,
  },
})
