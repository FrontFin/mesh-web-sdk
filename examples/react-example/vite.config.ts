import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const require = createRequire(import.meta.url)
const dirname = path.dirname(fileURLToPath(import.meta.url))

// Opt-in HTTPS (`pnpm start:https`). The hosted backup widget sends
// `frame-ancestors https:`, so it can only be iframed by an https page — use this
// to exercise the Tier-1 path against the hosted demo. Leave it off (plain http,
// `pnpm start`) for the JIT path, whose callbacks fetch the http mock backend (an
// https page → http fetch would be mixed-content-blocked).
const useHttps = process.env.HTTPS === 'true'

// Prefer a locally-trusted cert so the browser doesn't show
// ERR_CERT_AUTHORITY_INVALID. Generate one with mkcert:
//   brew install mkcert && mkcert -install
//   cd examples/react-example && mkdir -p certs && mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost
// Falls back to the self-signed `basic-ssl` plugin (click through the warning, or
// type `thisisunsafe` in Chrome) when no cert is present.
function trustedCert() {
  const dir = process.env.SSL_CERT_DIR || path.join(dirname, 'certs')
  const keyPath = path.join(dir, 'localhost-key.pem')
  const certPath = path.join(dir, 'localhost.pem')
  return fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
    : undefined
}

const cert = useHttps ? trustedCert() : undefined

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
    host: 'localhost',
    ...(cert ? { https: cert } : {})
  },
  build: {
    outDir: './build',
    emptyOutDir: true
  },
  // Use the trusted cert if present; otherwise fall back to self-signed basic-ssl.
  plugins: [react(), ...(useHttps && !cert ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@solana/web3.js': solanaWeb3
    }
  }
})
