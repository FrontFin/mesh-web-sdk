import path from 'node:path'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)

// Resolved to an absolute path so it works under pnpm's isolated node_modules,
// where the alias target is not hoisted next to its importer
// (@meshconnect/uwc-bridge-parent imports '@solana/web3.js' without declaring it).
const solanaWeb3 = path.dirname(
  require.resolve('@meshconnect/solana-web3.js/package.json')
)

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
  plugins: [react()],
  resolve: {
    alias: {
      '@solana/web3.js': solanaWeb3
    }
  }
})
