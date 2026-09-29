# @meshconnect/web-link-sdk

A client-side JS library for integrating with Mesh Connect

## Install

With `npm`:

```
npm install --save @meshconnect/web-link-sdk
```

With `yarn`

```
yarn add @meshconnect/web-link-sdk
```

## Getting Link token

Link token should be obtained from the GET `/api/v1/linktoken` endpoint. Api reference for this request is available [here](https://docs.meshconnect.com/api-reference/managed-account-authentication/get-link-token-with-parameters). Request must be preformed from the server side because it requires the client secret. You will get the response in the following format:

```json
{
  "content": {
    "linkToken": "{linktoken}"
  },
  "status": "ok",
  "message": ""
}
```

You can use `linkToken` value from this response to open the popup window with `openLink` method.

## Generating connection method

```tsx
import { createLink } from '@meshconnect/web-link-sdk';

// ...

const linkConnection = createLink({
  onIntegrationConnected: (data: LinkPayload) => {
    // use broker account data
  },
  onExit: (error?: string) => {
    if (error) {
      // handle error
    } else {
      // ...
    }
  }

```

## Using connection to open auth link

To open authentication link provided by Front Finance Integration API you need to call `openLink` method:

```tsx
linkConnection.openLink(linkToken)
```

ℹ️ See full source code example at [react-example/src/ui/Link.tsx](../../examples/react-example/src/ui/Link.tsx)

```tsx
import { createLink, Link, LinkPayload } from '@meshconnect/web-link-sdk'

// ...

const [linkConnection, setLinkConnection] = useState<Link | null>(null)

useEffect(() => {
  setLinkConnection(createLink(options))
}, [])

useEffect(() => {
  if (authLink) {
    linkConnection?.openLink(linkToken)
  }
}, [linkConnection, authLink])

return <></>
```

## Getting tokens

After successfull authentication on the Link session, the popup will be closed and the broker tokens will be passed to the `onIntegrationConnected` function.
`Link` instance will check if URL contains query parameters, load broker tokens and fire the events.

### Available Connection configuration options

ℹ️ See [src/types/index.ts](src/utils/types.ts) for exported types.

#### `createLink` arguments

| key                      | type                                                   | description                                                                          |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `onIntegrationConnected` | `(payload: LinkPayload) => void`                       | Callback called when users connects their accounts                                   |
| `onExit`                 | `((error?: string \| undefined) => void) \| undefined` | Called if connection not happened                                                    |
| `onTransferFinished`     | `(payload: TransferFinishedPayload) => void`           | Callback called when a crypto transfer is executed                                   |
| `onEvent`                | `(payload: LinkEventType) => void`                     | A callback function that is called when various events occur within the Front iframe |
| `accessTokens`           | `IntegrationAccessToken[]`                             | An array of integration access tokens                                                |
| `language`               | `'en' \| undefined`                                    | Link UI language                                                                     |
| `displayFiatCurrency`    | `'USD' \| undefined`                                   | A fiat currency to display fiat equivalent of a crypto amount                        |
| `theme`                  | `'dark' \| 'light' \| 'system' \| undefined`           | Color theme of Link UI interface                                                     |
| `renderType`             | `'overlay' \| 'embedded' \| undefined`                 | `'overlay'` (default) renders a full-screen popup; `'embedded'` renders inside a client-supplied iframe (requires `customIframeId` in `openLink`) |

All callbacks are optional.

#### Withdrawal events

When a user confirms a withdrawal, `onEvent` receives a `withdrawalRequested` event, followed by `onExit` as Link closes.
Use it to continue the withdrawal in your app, for example to prompt for your own 2FA.
The payload carries no address or amount: read the transfer details from the webhook or the transfer API.

```ts
onEvent: event => {
  if (event.type === 'withdrawalRequested') {
    const { transferId, status } = event.payload // 'pending' or 'success'; treat any other value as pending
  }
}
```

#### `createLink` return value

| key                  | type                                                        | description                                                                                                |
| -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `openLink`           | `(linkToken: string, customIframeId?: string) => void`      | Opens the Link UI popup. Optionally targets an existing iframe by ID instead of creating a new popup       |
| `openLinkBackup`     | `(backupConfig: MeshBackupConfig, options?: MeshBackupOptions) => void` | Opens the deposit-only **backup flow** when the Mesh API is unavailable (see below)             |
| `closeLink`          | `() => void`                                                | Closes the Link UI popup immediately                                                                       |
| `closeLinkRequested` | `() => void`                                                | Requests graceful close in `embedded` mode (sends `closeRequested` to iframe); closes immediately otherwise  |

### Backup / outage flow

If a `linktoken` request fails in a way that indicates a Mesh outage (network/DNS error, timeout, HTTP 5xx or 429), you can open a **deposit-only backup flow** instead of the normal flow. It runs select-token → select-network → QR / copy-address from Mesh infrastructure on a separate domain, and resolves deposit addresses either from static config or through callbacks you provide.

```ts
const link = createLink({
  onIntegrationConnected, onTransferFinished, onEvent, onExit,

  // JIT callbacks — required only if any destination omits `address`. They run in
  // YOUR app with YOUR session; only (symbol, networkId) and the resolved address
  // cross the bridge. `fetch` resolves on 4xx/5xx, so throw on a non-OK response to
  // fail closed.
  onAddressInit: async (symbol, networkId) => {
    const res = await api.post('/wallets/addresses/assign', { currency: symbol, network_id: networkId })
    if (!res.ok) throw new Error('address init failed')
  },
  onStatusPoll: async (symbol, networkId) => {
    const res = await api.get('/wallets/deposit_addresses', { currency: symbol })
    if (!res.ok) throw new Error('status poll failed')
    const m = (await res.json()).deposit_addresses.find(a => a.network_id === networkId && a.address)
    return m ? { status: 'ready', address: m.address, addressTag: m.address_tag } : { status: 'pending' }
  }
})

// Normal path:
link.openLink(linkToken)
// Outage path — same handlers, no link token:
link.openLinkBackup(backupConfig)
```

Callbacks (`onAddressInit`, `onStatusPoll`) are passed to `createLink`. `onAddressInit(symbol, networkId)` kicks off generation (its return is ignored; a throw/reject is a failure). `onStatusPoll(symbol, networkId)` returns `Promise<{ status: 'pending' | 'ready' | 'failed'; address?; addressTag? }>` and is polled until `ready`/`failed`; it must be idempotent per `(symbol, networkId)`. Supply both only if any `backupConfig.destinations[]` entry omits `address`.

> **⚠️ Host CSP requirements (web only).** Serve the embedding page over **https**. Your Content-Security-Policy's `frame-src`/`child-src` (or `default-src`) must allow **the backup widget origin** (`https://backup.meshconnect.com` by default) and **`blob:`** — the bundled last-resort fallback renders as a sandboxed `blob:` iframe, so a CSP that pins `frame-src` to the primary Mesh origin will block it and the fallback will fail. (React Native is not affected — it uses a native WebView, not an iframe.)

### Using tokens

You can use broker tokens to perform requests to get current balance, assets and execute transactions. Full API reference can be found [here](https://integration-api.meshconnect.com/apireference).

## Typescript support

TypeScript definitions for `@meshconnect/web-link-sdk` are built into the npm package.

### Exported types

| type                      | description                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `LinkPayload`             | Payload passed to `onIntegrationConnected`                                                    |
| `AccessTokenPayload`      | Broker access token details within `LinkPayload`                                              |
| `DelayedAuthPayload`      | Delayed auth details within `LinkPayload`                                                     |
| `IntegrationAccessToken`  | Access token shape used in the `accessTokens` option                                          |
| `TransferFinishedPayload` | Payload passed to `onTransferFinished`                                                        |
| `BrokerType`              | Union of supported broker/integration type strings (re-exported from `@meshconnect/node-api`) |
| `LinkOptions`             | Full options object passed to `createLink`                                                    |
| `Link`                    | Return type of `createLink`                                                                   |
| `MeshBackupConfig`        | Config passed to `openLinkBackup` (clientId, userId, destinations, preselectedSymbol)         |
| `MeshBackupOptions`       | Options for `openLinkBackup` (e.g. `customIframeId`, `widgetOrigin`)                           |
| `MeshBackupStatusResult`  | Return type of the `onStatusPoll` callback                                                     |
| `AccountToken`            | Account token within `AccessTokenPayload`                                                     |
| `Account`                 | Account details within `AccountToken`                                                         |
| `BrandInfo`               | Integration brand/logo info                                                                   |
