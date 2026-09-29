import path from 'node:path'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const require = createRequire(import.meta.url)

// Opt-in HTTPS (`pnpm start:https`). The hosted backup widget sends
// `frame-ancestors https:`, so it can only be iframed by an https page — use this
// to exercise the Tier-1 path against the hosted demo. Leave it off (plain http,
// `pnpm start`) for the JIT path, whose callbacks fetch the http mock backend (an
// https page → http fetch would be mixed-content-blocked).
const useHttps = process.env.HTTPS === 'true'

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
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@solana/web3.js': solanaWeb3
    }
  }
})
