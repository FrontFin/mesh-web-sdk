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

1. **Open backup deposit** — calls `link.openLinkBackup(config, { widgetOrigin })`
   against the live demo widget (`https://demo-widget.cascadecode.com`). Pick a
   token/network and see the QR / deposit address. No link token, no primary Mesh
   API call.
2. **Force Tier-2 fallback** — points the flow at an unreachable origin so the
   Tier-1 load never completes its ready handshake; after ~5s the SDK cascades to
   the **bundled Tier-2 offline widget** (no Mesh-owned network dependency) via an
   iframe `srcdoc`. The "Active tier" line flips to Tier 2 (from the
   `backupTierChanged` event).
3. **Force JIT** — drops the static addresses so each destination resolves via
   the `onAddressInit` / `onStatusPoll` callbacks, which run in this app and call
   a **local mock backend**.

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
send real funds. With the mock running, turn on **Force JIT** and open the backup
deposit to watch the poll loop resolve an address over the bridge.
