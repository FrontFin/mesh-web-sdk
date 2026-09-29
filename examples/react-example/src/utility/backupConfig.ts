import type {
  MeshBackupConfig,
  MeshBackupStatusResult
} from '@meshconnect/web-link-sdk'

// --- Backup / outage demo -------------------------------------------------
// The deposit-only backup flow runs when the primary Mesh API is unavailable.
// It needs no link token: `openLinkBackup` loads the standalone backup widget
// from its origin and takes a client-assembled MeshBackupConfig. This origin is
// the live demo widget (OR-449); in production it is the shipped backup origin.
export const DEMO_BACKUP_WIDGET_ORIGIN = 'https://demo-widget.cascadecode.com'

// A deliberately unreachable origin (reserved `.invalid` TLD, RFC 6761). With
// "Force Tier-2 fallback" on, the backup flow is pointed here so the Tier-1 load
// never completes its ready handshake and the SDK cascades to the bundled Tier-2
// offline widget — the no-Mesh-domain fallback (OR-475).
export const DEAD_BACKUP_WIDGET_ORIGIN = 'https://backup-widget.invalid'

// Local mock client backend the JIT callbacks below call (see mock-backend/).
// Override with VITE_MOCK_BACKEND_URL. Run it with `pnpm mock` in this example.
export const MOCK_BACKEND_URL =
  (import.meta.env.VITE_MOCK_BACKEND_URL as string) || 'http://localhost:8770'

// networkIds are real Mesh network ids (from the live demo pairs manifest,
// https://demo-widget.cascadecode.com/backup/pairs/all.json). Static addresses
// are used so no backend is required in the default (non-JIT) path.
//
// The destinations deliberately span the Tier-2 logo cases: Tier 1 loads the
// full manifest so every logo renders; Tier 2 ships only the curated top-8
// tokens/networks, so anything else falls back to an initials placeholder —
// visible drift, never a broken flow.
//
// NOTE: demo addresses for the QR/copy screen only — do NOT send real funds.
const EVM_DEMO_ADDRESS = '0x503828976D22510aad0201ac7EC88293211D23Da'

export const DEMO_BACKUP_CONFIG: MeshBackupConfig = {
  clientId: '26C2621E-2C09-4CCC-DCF7-08DE90525AA1', // CDC (Crypto.com)
  userId: 'web-example-user',
  destinations: [
    // Both logos bundled (baseline).
    {
      networkId: 'e3c7fdd8-b1fc-4e51-85ae-bb276e075611',
      symbol: 'USDC',
      address: EVM_DEMO_ADDRESS
    }, // USDC · Ethereum
    {
      networkId: 'c5dc5d2e-68c1-4261-9a30-90b598738bf5',
      symbol: 'USDC',
      address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9'
    }, // USDC · Tron
    // Tier 2: token INITIALS (AAVE not in top-8), network logo shown.
    {
      networkId: 'e3c7fdd8-b1fc-4e51-85ae-bb276e075611',
      symbol: 'AAVE',
      address: EVM_DEMO_ADDRESS
    }, // AAVE · Ethereum
    // Tier 2: BOTH initials (DAI + Avalanche, neither bundled).
    {
      networkId: 'bad16371-c22a-4bf4-a311-274d046cd760',
      symbol: 'DAI',
      address: EVM_DEMO_ADDRESS
    } // DAI · Avalanche
  ]
  // No preselectedSymbol: show the token-select screen so the bundled-vs-initials
  // token logos are visible.
}

// The address-less variant used when "Force JIT" is on: same destinations,
// `address` stripped so each resolves via the onAddressInit/onStatusPoll
// callbacks below (OR-452 / client spec §5–§6).
export const JIT_BACKUP_CONFIG: MeshBackupConfig = {
  ...DEMO_BACKUP_CONFIG,
  destinations: DEMO_BACKUP_CONFIG.destinations.map(
    ({ networkId, symbol }) => ({
      networkId,
      symbol
    })
  )
}

// --- JIT via SDK callbacks (OR-452) ---------------------------------------
// These run HERE in the host app (no token, no client endpoint in the widget).
// They call the local mock backend, mirroring the client-spec integration
// example: POST to kick off generation, then GET-poll until an address is ready.
// In a real integration these hit YOUR backend with YOUR session, and MUST be
// idempotent — return the SAME address for a given (symbol, networkId).

/** Kick off address generation (return value ignored; a throw = failure). */
export async function demoOnAddressInit(
  symbol: string,
  networkId: string
): Promise<void> {
  await fetch(`${MOCK_BACKEND_URL}/wallets/addresses/assign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ currency: symbol, network_id: networkId })
  })
}

/** Poll for the resolved address. `pending` ⇒ the widget polls again. */
export async function demoOnStatusPoll(
  symbol: string,
  networkId: string
): Promise<MeshBackupStatusResult> {
  const url =
    `${MOCK_BACKEND_URL}/wallets/deposit_addresses` +
    `?currency=${encodeURIComponent(symbol)}` +
    `&network_id=${encodeURIComponent(networkId)}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  const json = (await res.json()) as {
    deposit_addresses?: {
      network_id: string
      address?: string
      address_tag?: string | null
    }[]
  }
  const match = json.deposit_addresses?.find(
    a => a.network_id === networkId && a.address
  )
  if (!match?.address) {
    return { status: 'pending' }
  }
  return match.address_tag
    ? { status: 'ready', address: match.address, addressTag: match.address_tag }
    : { status: 'ready', address: match.address }
}
