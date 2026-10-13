#!/usr/bin/env node
/*
 * Zero-dependency mock CLIENT backend for the backup-flow JIT callbacks
 * (OR-452 / client spec §5–§6). This stands in for the client's own backend: the SDK's
 * `onAddressInit` / `onStatusPoll` callbacks (see src/utility/backupConfig.ts)
 * call these endpoints from the host app — the backup widget never touches them.
 *
 * Endpoints (mirroring the client-spec integration example):
 *   POST /wallets/addresses/assign   body { currency, network_id }  → { ok: true }
 *   GET  /wallets/deposit_addresses?currency=&network_id=
 *        → { deposit_addresses: [{ network_id, address, address_tag }] }
 *        Reports "pending" (empty list) for the first couple of polls per
 *        (currency, network_id), then returns a demo address — exercising the
 *        real poll loop. Addresses are idempotent per pair.
 *
 * ⚠️ Demo addresses only — never send real funds. Run with `pnpm mock`.
 */
import http from 'http'

const PORT = Number(process.env.MOCK_BACKEND_PORT) || 8770
const READY_AFTER_POLLS = 2 // report pending this many times, then ready

// Demo addresses by network id (format-valid placeholders, NOT real wallets).
const EVM_DEMO_ADDRESS = '0x503828976D22510aad0201ac7EC88293211D23Da'
const ADDRESS_BY_NETWORK = {
  'c5dc5d2e-68c1-4261-9a30-90b598738bf5': {
    address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9'
  } // Tron
}
const demoAddressFor = networkId =>
  ADDRESS_BY_NETWORK[networkId] || { address: EVM_DEMO_ADDRESS }

// Per-(currency,networkId) poll counter so status flips pending → ready.
const pollCounts = new Map()

const cors = res => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, accept')
}

const sendJson = (res, status, body) => {
  cors(res)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (req.method === 'OPTIONS') {
    cors(res)
    res.writeHead(204)
    res.end()
    return
  }

  // Kick off address generation. Return value is ignored by the widget; we just
  // reset the poll counter so the next status poll starts the pending → ready run.
  if (req.method === 'POST' && url.pathname === '/wallets/addresses/assign') {
    let raw = ''
    req.on('data', c => (raw += c))
    req.on('end', () => {
      let currency, networkId
      try {
        const body = JSON.parse(raw || '{}')
        currency = body.currency
        networkId = body.network_id
      } catch {
        return sendJson(res, 400, { error: 'invalid JSON body' })
      }
      pollCounts.set(`${currency}:${networkId}`, 0)
      console.log(`[mock] assign ${currency} on ${networkId}`)
      sendJson(res, 200, { ok: true })
    })
    return
  }

  // Poll for the resolved address.
  if (req.method === 'GET' && url.pathname === '/wallets/deposit_addresses') {
    const currency = url.searchParams.get('currency') || ''
    const networkId = url.searchParams.get('network_id') || ''
    const key = `${currency}:${networkId}`
    const n = (pollCounts.get(key) ?? 0) + 1
    pollCounts.set(key, n)

    if (n <= READY_AFTER_POLLS) {
      console.log(`[mock] poll ${key} → pending (${n})`)
      return sendJson(res, 200, { deposit_addresses: [] })
    }

    const { address, address_tag = null } = demoAddressFor(networkId)
    console.log(`[mock] poll ${key} → ready ${address}`)
    return sendJson(res, 200, {
      deposit_addresses: [{ network_id: networkId, address, address_tag }]
    })
  }

  sendJson(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.log(
    `Mock backup JIT backend on http://localhost:${PORT}\n` +
      `  POST /wallets/addresses/assign\n` +
      `  GET  /wallets/deposit_addresses?currency=&network_id=\n` +
      `  (ready after ${READY_AFTER_POLLS} pending polls; demo addresses only)`
  )
})
