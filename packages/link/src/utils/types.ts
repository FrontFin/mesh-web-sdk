import type { BrokerType } from '@meshconnect/node-api'
import { SessionSummary, LinkEventType } from './event-types'

export type EventType =
  | 'brokerageAccountAccessToken'
  | 'delayedAuthentication'
  | 'loaded'
  | 'transferFinished'

export interface Link {
  /**
   * A function that takes linkToken parameter from `/api/v1/linktoken` endpoint as an input, and opens the Link UI popup
   * @param linkToken - Base64 encoded link token from the `/api/v1/linktoken` endpoint
   * @param customIframeId - Optional custom ID for the existing iframe element. If not provided, a new iframe element will be created
   */
  openLink: (linkToken: string, customIframeId?: string) => void
  /**
   * Opens the standalone backup deposit widget for use when the primary Mesh API
   * is unavailable. Unlike {@link openLink} there is no link token — the widget is
   * a static SPA served from an independent origin, hydrated with `session` over
   * the message bridge after it loads. The host event contract
   * (`onIntegrationConnected` / `onTransferFinished` / `onEvent` / `onExit`) is
   * unchanged, so the same handlers passed to `createLink` apply to both paths.
   * @param session - Backup deposit configuration, assembled server-side (canonical shape: OR-446).
   * @param options - Optional `widgetOrigin` (defaults to `DEFAULT_BACKUP_WIDGET_ORIGIN`) and `customIframeId` for embedded mode.
   */
  openLinkBackup: (
    session: MeshBackupConfig,
    options?: MeshBackupOptions
  ) => void
  /**
   * A function to close Link UI popup
   */
  closeLink: () => void
  /**
   * A function to request Link UI to close gracefully in embedded mode.
   */
  closeLinkRequested: () => void
}

/**
 * A single deposit destination offered by the backup widget. When `address` is
 * omitted it is resolved at runtime via the client-hosted JIT endpoints in
 * {@link MeshBackupJitConfig} — so `jit` is required whenever any destination
 * omits `address`.
 */
export interface MeshBackupDestination {
  /** Mesh network id for this destination. */
  networkId: string
  /** Token symbol (e.g. `USDC`). */
  symbol: string
  /** Static deposit address. Omit to resolve just-in-time via `jit`. */
  address?: string
  /** Destination tag / memo, for networks that require one (e.g. XRP). */
  addressTag?: string | null
}

/**
 * Client-hosted JIT (just-in-time) address endpoints, required when any
 * destination omits `address`. The widget calls these directly, presenting the
 * `token` as `Authorization: Bearer <token>`. Mesh never sees or validates the
 * token — the client owns its issuance and validation.
 */
export interface MeshBackupJitConfig {
  /** `POST` endpoint that begins address resolution. */
  initiateUrl: string
  /** `GET` endpoint the widget polls until an address is `ready`. */
  statusUrl: string
  /**
   * Short-lived (≤10 min), user-scoped bearer token, minted by the client
   * server-side at outage-detection time. Treat as exposed — it lives in the
   * widget iframe.
   */
  token: string
}

/**
 * Configuration handed to the backup deposit widget. Assemble this server-side
 * (destinations and any JIT token should not be built in untrusted client code)
 * and pass it to {@link Link.openLinkBackup}; it is delivered to the widget over
 * the message bridge after the widget loads. Canonical shape: OR-446.
 */
export interface MeshBackupConfig {
  /** The client's Mesh client id. */
  clientId: string
  /**
   * The client's end-user identifier. Echoed by JIT and used for analytics —
   * it is **not** an authentication credential.
   */
  userId: string
  /** Deposit destinations to offer. At least one is required. */
  destinations: MeshBackupDestination[]
  /**
   * Preselect a token symbol, skipping the token-select screen. Must match one
   * of the destination symbols; an unknown symbol falls back to token select.
   */
  preselectedSymbol?: string
  /** Required when any destination omits `address`. */
  jit?: MeshBackupJitConfig
  /**
   * Your correlation id, echoed to your JIT Initiate/Status endpoints so you can
   * tie the resolved deposit address to a transaction in your system.
   */
  transactionId?: string
}

/**
 * Optional arguments to {@link Link.openLinkBackup}.
 */
export interface MeshBackupOptions {
  /**
   * Origin serving the standalone backup widget. Defaults to
   * `DEFAULT_BACKUP_WIDGET_ORIGIN`. Override for staging, demo, or self-hosting.
   */
  widgetOrigin?: string
  /**
   * Custom ID for an existing iframe element, mirroring {@link Link.openLink}'s
   * embedded-mode param. Required when `createLink` was called with
   * `renderType: 'embedded'`.
   */
  customIframeId?: string
}

export interface AccountToken {
  account: Account
  accessToken: string
  refreshToken?: string
  tokenId?: string
}

export interface Account {
  accountId: string
  accountName: string
  fund?: number
  cash?: number
  isReconnected?: boolean
}

/**
 * Integration brand information
 */
export interface BrandInfo {
  /**
   * Integration logo in base 64 format
   */
  brokerLogo: string
  /**
   * Integration logo URL (obsolete, use `logoLightUrl` instead)
   */
  brokerLogoUrl?: string
  /**
   * Integration logo URL for light theme
   */
  logoLightUrl?: string
  /**
   * Integration logo URL for dark theme
   */
  logoDarkUrl?: string
  /**
   * Integration icon URL for light theme
   */
  iconLightUrl?: string
  /**
   * Integration icon URL for dark theme
   */
  iconDarkUrl?: string
}

export interface LinkPayload {
  accessToken?: AccessTokenPayload
  delayedAuth?: DelayedAuthPayload
}

export interface AccessTokenPayload {
  accountTokens: AccountToken[]
  brokerBrandInfo: BrandInfo
  expiresInSeconds?: number
  refreshTokenExpiresInSeconds?: number
  brokerType: BrokerType
  brokerName: string
}

export interface DelayedAuthPayload {
  refreshTokenExpiresInSeconds?: number
  brokerType: BrokerType
  refreshToken: string
  brokerName: string
  brokerBrandInfo: BrandInfo
}

export interface TransferFinishedPayload {
  status: 'success'
  txId: string
  fromAddress: string
  toAddress: string
  symbol: string
  amount: number
  networkId: string
  userId?: string
  clientTransactionId?: string
  amountInFiat?: number
  totalAmountInFiat?: number
  networkName?: string
  txHash?: string
  transferId?: string
  refundAddress?: string
}

export interface IntegrationAccessToken {
  accountId: string
  accountName: string
  accessToken: string
  brokerType: BrokerType
  brokerName: string
}

export interface LinkOptions {
  /**
   * @deprecated This property is unused and will be removed in the next major version.
   */
  clientId?: string

  /**
   * A callback function that is called when an integration is successfully connected.
   * It receives a payload of type `LinkPayload`.
   */
  onIntegrationConnected: (payload: LinkPayload) => void

  /**
   * (Optional) A callback function that is called when the Front iframe is closed.
   */
  onExit?: (error?: string, summary?: SessionSummary) => void

  /**
   * (Optional) A callback function that is called when a transfer is finished.
   * It receives a payload of type `TransferFinishedPayload`.
   */
  onTransferFinished?: (payload: TransferFinishedPayload) => void

  /**
   * (Optional) A callback function that is called when various events occur within the Front iframe.
   * It receives an object with type `LinkEventTypeKeys` indicating the event, and an optional 'payload' containing additional data.
   */
  onEvent?: (event: LinkEventType) => void

  /**
   * (Optional) An array of integration access tokens.
   * These access tokens are used to initialize crypto transfers flow at 'Select asset step'
   */
  accessTokens?: IntegrationAccessToken[]

  /**
   * Link UI language. Supported: 'en', 'ru'. Can be set as 'en-US', 'ru-RU', etc.
   */
  language?: string

  /**
   * The currency to display a fiat equivalent of the crypto amount in Link UI.
   * Default: 'USD'
   */
  displayFiatCurrency?: string

  /**
   * Link UI theme. Possible values: 'dark', 'light' and 'system'.
   */
  theme?: 'dark' | 'light' | 'system'

  /**
   * Controls how the Link UI is rendered.
   * - 'overlay' (default): renders as a full-screen popup managed by the SDK.
   * - 'embedded': renders inside a client-supplied iframe for a more native UI experience. Requires `customIframeId` in `openLink`.
   */
  renderType?: 'overlay' | 'embedded'
}

export interface LinkStyle {
  ir: number
  io: number
}

declare global {
  interface Window {
    meshLinkShouldSkipPrewarm?: boolean
  }
}
