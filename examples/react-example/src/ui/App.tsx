import React, { useState, useCallback } from 'react'
import { createLink } from '@meshconnect/web-link-sdk'
import { Section, Button, Input, theme } from '../components/StyledComponents'

export const App: React.FC = () => {
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState(null)
  const [transferFinishedData, setTransferFinishedData] = useState(null)
  const [directLinkToken, setDirectLinkToken] = useState('')

  const handleDirectTokenLaunch = useCallback(() => {
    if (!directLinkToken) {
      setError('Please enter a link token')
      return
    }

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
          onChange={e => setDirectLinkToken(e.target.value)}
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
    </div>
  )
}

export default App
