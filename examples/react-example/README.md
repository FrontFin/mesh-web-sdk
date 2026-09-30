# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Before run

Need to set up your Mesh Connect Client Id and Secret key in .env file.

Run `pnpm install` to install all dependencies.

## Available Scripts

In the project directory, you can run:

### `pnpm start`

Runs the app in the development mode.\
Open [http://localhost:3006](http://localhost:3006) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

## Backup / outage flow (`openLinkBackup`)

The **"Backup / Outage Flow"** section demonstrates the deposit-only flow the SDK
runs when the primary Mesh API is down (SDK Backup / Redundancy Flow). It mirrors
the React Native example.

1. **Open backup deposit** — calls `link.openLinkBackup(config, { widgetOrigin })`.
   Pick a token/network and see the QR / deposit address. No link token, no
   primary Mesh API call. The **Tier-1 widget origin** field (or
   `VITE_BACKUP_WIDGET_ORIGIN`) sets where the widget loads from; default is the
   CI-deployed backup widget (the `link-backup` Cloudflare Worker).
2. **Force Tier-2 fallback** — points the flow at an unreachable origin so the
   Tier-1 load never completes its ready handshake; after ~5s the SDK cascades to
   the **bundled Tier-2 offline widget** (no Mesh-owned network dependency) via an
   iframe `srcdoc`. The "Active tier" line flips to Tier 2 (from the
   `backupTierChanged` event).
3. **Force JIT** — drops the static addresses so each destination resolves via
   the `onAddressInit` / `onStatusPoll` callbacks, which run in this app and call
   a **local mock backend**.

### Two local gotchas

- **The hosted widget requires https.** It sends `Content-Security-Policy:
  frame-ancestors https:`, so a browser will only iframe it from an **https** page.
  Run the example over https to test Tier-1 against it:

  ```
  pnpm start:https
  ```

  By default this uses a self-signed cert (`@vitejs/plugin-basic-ssl`), so the
  browser shows **`ERR_CERT_AUTHORITY_INVALID`** — click **Advanced → Proceed to
  localhost**, or in Chrome type **`thisisunsafe`** on the warning page. To avoid
  the warning entirely, generate a locally-trusted cert with
  [mkcert](https://github.com/FiloSottile/mkcert):

  ```
  brew install mkcert && mkcert -install
  mkdir -p certs
  mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost
  pnpm start:https   # now uses the trusted cert automatically (certs/ is gitignored)
  ```

  Plain `pnpm start` (http) still works for **Tier-2** (loaded via `srcdoc`, not
  subject to `frame-ancestors`) and for pointing at a **local widget**.
- **JIT needs a callback-capable widget.** The Tier-2 bundle shipped in the SDK is
  the callback build, so **Force Tier-2 + Force JIT works locally over http**. For
  **Tier-1 JIT**, point the Tier-1 origin at a callback-capable widget (the default
  CI-deployed widget, or run `mesh-backup-widget` locally).

### Local mock backend (for the JIT path)

The JIT callbacks call a zero-dependency mock client backend (see
`mock-backend/server.mjs`), mirroring the client-spec integration example
(`POST /wallets/addresses/assign`, `GET /wallets/deposit_addresses`). Run it in a
second terminal:

```
pnpm mock
```

It listens on `http://localhost:8770` (override with `MOCK_BACKEND_PORT`, or point
the app elsewhere with `VITE_MOCK_BACKEND_URL`). It reports `pending` for the
first couple of polls per token/network, then returns a **demo** address — never
send real funds.

> Recommended JIT test (all http, no mixed-content issues): `pnpm start` +
> `pnpm mock`, turn on **Force Tier-2** and **Force JIT**, then open the backup
> deposit and watch the poll loop resolve an address over the bridge. (An https
> page cannot fetch the http mock, so keep the JIT path on http.)
