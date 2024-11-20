import React, { useState, useCallback } from 'react'
import {
  createLink,
  LinkPayload,
  TransferFinishedPayload
} from '@meshconnect/web-link-sdk'
import { Section, Button, Input, theme } from '../components/StyledComponents'

export const App: React.FC = () => {
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<LinkPayload | null>(null)
  const [transferFinishedData, setTransferFinishedData] =
    useState<TransferFinishedPayload | null>(null)
  const [directLinkToken, setDirectLinkToken] = useState('')

  const handleDirectTokenLaunch = useCallback(() => {
    if (!directLinkToken) {
      setError('Please enter a link token')
      return
    }

    setPayload(null)
    setTransferFinishedData(null)
    setError(null)

    const meshLink = createLink({
      clientId: 'directLinkToken',
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
      }
    })

    meshLink.openLink(directLinkToken)
  }, [directLinkToken])

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
    </div>
  )
}

export default App
