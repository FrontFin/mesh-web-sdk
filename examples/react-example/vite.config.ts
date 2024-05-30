import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3006,
    host: 'localhost'
  },
  build: {
    outDir: './build',
    emptyOutDir: true
  },
  plugins: [react()]
})
