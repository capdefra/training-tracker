import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the same build works locally and on GitHub project pages
// (https://<user>.github.io/<repo>/) without hardcoding the repository name.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 43217,
  },
  preview: {
    port: 43217,
  },
})
