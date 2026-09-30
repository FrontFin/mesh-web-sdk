import React, { useState, useCallback } from 'react'
import {
  createLink,
  LinkOptions,
  LinkPayload,
  LinkEventType,
  TransferFinishedPayload
} from '@meshconnect/web-link-sdk'
import { Section, Button, Input, theme } from '../components/StyledComponents'
import {
  DEMO_BACKUP_CONFIG,
  JIT_BACKUP_CONFIG,
  DEMO_BACKUP_WIDGET_ORIGIN,
  DEAD_BACKUP_WIDGET_ORIGIN,
  demoOnAddressInit,
  demoOnStatusPoll
} from '../utility/backupConfig'

export const App: React.FC = () => {
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<LinkPayload | null>(null)
  const [transferFinishedData, setTransferFinishedData] =
    useState<TransferFinishedPayload | null>(null)
  const [directLinkToken, setDirectLinkToken] = useState('')

  // --- Backup / outage demo state ---
  const [forceTier2, setForceTier2] = useState(false)
  const [forceJit, setForceJit] = useState(false)
  const [tier1Origin, setTier1Origin] = useState(DEMO_BACKUP_WIDGET_ORIGIN)
  const [backupTier, setBackupTier] = useState<'tier1' | 'tier2'>('tier1')
  const [backupStatus, setBackupStatus] = useState<string | null>(null)

  const handleOpenBackup = useCallback(() => {
    setError(null)
    setBackupTier('tier1')
    setBackupStatus('Backup widget opening…')

    const widgetOrigin = forceTier2 ? DEAD_BACKUP_WIDGET_ORIGIN : tier1Origin

    const meshLink = createLink({
      clientId: DEMO_BACKUP_CONFIG.clientId,
      theme: 'dark',
      onIntegrationConnected: () => {
        // Deposit-only backup does not connect accounts.
      },
      // JIT callbacks — required only when a destination omits `address` (the
      // "Force JIT" path). They run here in the host app and call the local mock
      // backend (run `pnpm mock`).
      onAddressInit: demoOnAddressInit,
      onStatusPoll: demoOnStatusPoll,
      onTransferFinished: transferData => {
        console.info('[MESH BACKUP TRANSFER FINISHED]', transferData)
        setTransferFinishedData(transferData)
      },
      onExit: (err, summary) => {
        if (err) console.error(`[MESH BACKUP ERROR] ${err}`)
        if (summary) console.log('Summary', summary)
        setError(err || null)
        setBackupStatus(err ? `Exited: ${err}` : 'Backup flow closed')
      },
      onEvent: (ev: LinkEventType) => {
        console.info('[MESH BACKUP Event]', ev)
        // Surface the Tier-1 → Tier-2 cascade so the demo shows which tier
        // actually rendered the deposit (OR-475).
        if (ev.type === 'backupTierChanged') {
          setBackupTier(ev.payload.to)
          setBackupStatus(`Cascaded to ${ev.payload.to} (${ev.payload.reason})`)
        }
      }
    })

    meshLink.openLinkBackup(forceJit ? JIT_BACKUP_CONFIG : DEMO_BACKUP_CONFIG, {
      widgetOrigin
    })
  }, [forceTier2, forceJit, tier1Origin])

  const prepareLink = useCallback(
    (linkOptions?: Partial<LinkOptions>) => {
      if (!directLinkToken) {
        setError('Please enter a link token')
        return
      }

      setPayload(null)
      setTransferFinishedData(null)
      setError(null)

      const meshLink = createLink({
        clientId: 'directLinkToken',
        language: 'en',
        displayFiatCurrency: 'USD',
        theme: 'dark',
        onIntegrationConnected: payload => {
          setPayload(payload)
          console.info('[MESH CONNECTED]', payload)
        },
        onExit: (error, summary) => {
          if (error) {
            console.error(`[MESH ERROR] ${error}`)
          }
          if (summary) {
            console.log('Summary', summary)
          }
          setError(error || null)
        },
        onTransferFinished: transferData => {
          console.info('[MESH TRANSFER FINISHED]', transferData)
          setTransferFinishedData(transferData)
        },
        onEvent: ev => {
          console.info('[MESH Event]', ev)
          if (ev.type === 'transferExecuted' && ev.payload) {
            setTransferFinishedData(ev.payload as TransferFinishedPayload)
          }
        },
        ...linkOptions
      })

      return meshLink
    },
    [directLinkToken]
  )

  const handleDirectTokenLaunch = useCallback(() => {
    const meshLink = prepareLink()
    meshLink?.openLink(directLinkToken)
  }, [prepareLink, directLinkToken])

  const handleCustomIframeLaunch = useCallback(() => {
    const meshLink = prepareLink({
      onExit: (error, summary) => {
        if (error) {
          console.error(`[MESH ERROR] ${error}`)
        }
        if (summary) {
          console.log('Summary', summary)
        }
        setError(error || null)

        const customIframe = document.getElementById(
          'custom-iframe'
        ) as HTMLIFrameElement
        if (customIframe) {
          customIframe.src = ''
        }
      }
    })
    meshLink?.openLink(directLinkToken, 'custom-iframe')
  }, [prepareLink, directLinkToken])

  return (
    <div
      style={{
        padding: theme.spacing.xl,
        maxWidth: '1000px',
        margin: '0 auto',
        backgroundColor: theme.colors.background,
        minHeight: '100vh'
      }}
    >
      <Section title="Direct Link Token Launch">
        <Input
          label="Link Token:"
          value={directLinkToken}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setDirectLinkToken(e.target.value)
          }
          placeholder="Enter your link token"
        />
        <Button onClick={handleDirectTokenLaunch}>
          Launch with Link Token
        </Button>

        <Button
          onClick={handleCustomIframeLaunch}
          style={{ marginInlineStart: '10px' }}
        >
          Launch with Link Token in custom frame
        </Button>
      </Section>

      <Section title="Backup / Outage Flow (openLinkBackup)">
        <p style={{ color: theme.colors.text, marginTop: 0 }}>
          Deposit-only flow for when the primary Mesh API is down. No link token —
          it loads the standalone backup widget and takes a{' '}
          <code>MeshBackupConfig</code>. Tier&nbsp;1 loads from the backup origin;
          on failure the SDK cascades to the SDK-bundled Tier&nbsp;2 offline
          widget. (This demo builds the config in the browser for convenience —
          real integrations assemble it <strong>server-side</strong> so deposit
          destinations aren&rsquo;t constructed in untrusted client code.)
        </p>

        <Input
          label="Tier-1 widget origin:"
          value={tier1Origin}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setTier1Origin(e.target.value)
          }
          placeholder={DEMO_BACKUP_WIDGET_ORIGIN}
          disabled={forceTier2}
        />
        <p
          style={{ marginTop: 0, fontSize: '0.85em', color: theme.colors.text }}
        >
          The hosted demo sends <code>frame-ancestors https:</code>, so it only
          frames from an <strong>https</strong> page. Over http, either serve
          this example with https or run a widget locally and paste its URL
          here.
        </p>

        <label style={{ display: 'block', marginBottom: theme.spacing.sm }}>
          <input
            type="checkbox"
            checked={forceTier2}
            onChange={e => setForceTier2(e.target.checked)}
          />{' '}
          Force Tier-2 fallback (point at an unreachable origin → cascade to the
          bundled offline widget; loaded as a sandboxed, opaque-origin{' '}
          <code>blob:</code> iframe — the host CSP must allow <code>blob:</code> in{' '}
          <code>frame-src</code>/<code>child-src</code>)
        </label>

        <label style={{ display: 'block', marginBottom: theme.spacing.md }}>
          <input
            type="checkbox"
            checked={forceJit}
            onChange={e => setForceJit(e.target.checked)}
          />{' '}
          Force JIT (drop static addresses → resolve via onAddressInit /
          onStatusPoll → local mock backend; run <code>pnpm mock</code>)
        </label>
        <p
          style={{ marginTop: 0, fontSize: '0.85em', color: theme.colors.text }}
        >
          JIT resolves address-less destinations via your{' '}
          <code>onAddressInit</code> / <code>onStatusPoll</code> callbacks over the
          bridge. The SDK-bundled Tier-2 widget supports it, so{' '}
          <strong>Force Tier-2 + Force JIT</strong> works fully locally over http
          with <code>pnpm mock</code>. Tier-1 JIT needs the callback-capable widget
          at the origin above.
        </p>

        <Button onClick={handleOpenBackup}>Open backup deposit</Button>

        <p style={{ color: theme.colors.text, marginBottom: 0 }}>
          <strong>Active tier:</strong>{' '}
          {backupTier === 'tier2'
            ? '● Tier 2 · bundled offline widget (no Mesh network)'
            : '○ Tier 1 · backup origin'}
          {backupStatus && (
            <>
              <br />
              <small>{backupStatus}</small>
            </>
          )}
        </p>
      </Section>

      {error && (
        <Section title="Error" style={{ backgroundColor: '#fff3f3' }}>
          <p style={{ color: theme.colors.error }}>{error}</p>
        </Section>
      )}

      {payload && (
        <Section title="Connection Results">
          <div>
            <p>
              <strong>Broker:</strong> {payload.accessToken?.brokerName}
            </p>
            <p>
              <strong>Broker Type:</strong> {payload.accessToken?.brokerType}
            </p>
            <p>
              <strong>Account Name:</strong>{' '}
              {payload.accessToken?.accountTokens[0]?.account.accountName}
            </p>
            <p>
              <strong>Account ID:</strong>{' '}
              {payload.accessToken?.accountTokens[0]?.account.accountId}
            </p>
            <p>
              <strong>Cash:</strong> $
              {payload.accessToken?.accountTokens[0]?.account.cash}
            </p>
            <p>
              <strong>Fund:</strong> $
              {payload.accessToken?.accountTokens[0]?.account.fund}
            </p>
            <p>
              <strong>Access Token:</strong>{' '}
              {payload.accessToken?.accountTokens[0]?.accessToken}
            </p>
            <p>
              <strong>Refresh Token:</strong>{' '}
              {payload.accessToken?.accountTokens[0]?.refreshToken}
            </p>
          </div>
        </Section>
      )}

      {transferFinishedData && (
        <Section title="Transfer Results">
          <div>
            <p>
              <strong>Status:</strong> {transferFinishedData.status}
            </p>
            <p>
              <strong>Amount:</strong> {transferFinishedData.amount}{' '}
              {transferFinishedData.symbol}
            </p>
            <p>
              <strong>Symbol:</strong> {transferFinishedData.symbol}
            </p>
            <p>
              <strong>Network ID:</strong> {transferFinishedData.networkId}
            </p>
            <p>
              <strong>To Address:</strong> {transferFinishedData.toAddress}
            </p>
            <p>
              <strong>Transaction ID:</strong> {transferFinishedData.txId}
            </p>
          </div>
        </Section>
      )}

      <iframe
        id="custom-iframe"
        title="Custom Iframe"
        style={{ width: '400px', height: '600px' }}
      ></iframe>
    </div>
  )
}

export default App
