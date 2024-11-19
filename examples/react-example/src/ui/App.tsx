import React, { useState, useCallback } from 'react'
import { linkApiUrl, clientId, clientSecret } from '../utility/config'
import { LinkComponent } from './Link'
import {
  LinkPayload,
  TransferFinishedPayload,
  createLink,
  IntegrationAccessToken
} from '@meshconnect/web-link-sdk'
import { FrontApi } from '@meshconnect/node-api'
import { Section, Button, Input, theme } from '../components/StyledComponents'

interface Destination {
  symbol: string
  address: string
  networkId: string
  addressTag?: string | null
  amount?: number | null
}

export const App: React.FC = () => {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<LinkPayload | null>(null)
  const [transferFinishedData, setTransferFinishedData] =
    useState<TransferFinishedPayload | null>(null)

  const [amount, setAmount] = useState<number>(5)
  const [destinations, setDestinations] = useState<Destination[]>([
    {
      symbol: 'USDC',
      address: '0x9Bf6207f8A3f4278E0C989527015deFe10e5D7c6',
      networkId: 'e3c7fdd8-b1fc-4e51-85ae-bb276e075611'
    },
    // {
    //   symbol: 'USDT',
    //   address: '0x9Bf6207f8A3f4278E0C989527015deFe10e5D7c6',
    //   networkId: 'e3c7fdd8-b1fc-4e51-85ae-bb276e075611'
    // },
    // {
    //   symbol: 'AVAX',
    //   address: '0x9Bf6207f8A3f4278E0C989527015deFe10e5D7c6',
    //   networkId: 'BAD16371-C22A-4BF4-A311-274D046CD760'
    // },
    {
      symbol: 'OP',
      address: '0x9Bf6207f8A3f4278E0C989527015deFe10e5D7c6',
      networkId: '18fa36b0-88a8-43ca-83db-9a874e0a2288'
    }
  ])
  const [customIntegrationId, setCustomIntegrationId] = useState('')

  // ONLY FOR DEMO PURPOSES
  const getMeshPayLink = useCallback(async () => {
    setError(null)
    setLinkToken(null)
    const api = new FrontApi({
      baseURL: linkApiUrl,
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret // never use client secret on FE
      }
    })

    try {
      const response = await api.managedAccountAuthentication.v1LinktokenCreate(
        {
          userId: 'first-user',
          integrationId: customIntegrationId || null,
          transferOptions: {
            fundingOptions: {
              enabled: true
            },
            toAddresses: destinations.map(dest => ({
              ...dest,
              amount: amount
            })),
            clientFee: 0,
            isInclusiveFeeEnabled: false,
            transferType: 'payment'
          }
        }
      )

      const data = response.data
      if (!data?.content?.linkToken) {
        setError('No link token received')
        return
      }

      setLinkToken(data.content.linkToken)
    } catch (err: any) {
      setError(err.message || 'Failed to create link token')
    }
  }, [amount, destinations, customIntegrationId])

  // deconstructed link token
  const [customIntegrationId1, setCustomIntegrationId1] = useState('')
  const [accessToken, setAccessToken] = useState('')

  const launchCatalogDirectly = useCallback(async () => {
    setError(null)

    // this will NEVER be stored on UI side
    // ONLY FOR DEMO PURPOSES
    const api = new FrontApi({
      baseURL: linkApiUrl,
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret
      }
    })

    try {
      // Get the link token first
      const response = await api.managedAccountAuthentication.v1LinktokenCreate(
        {
          userId: 'second-user',
          integrationId: customIntegrationId1,
          transferOptions: {
            fundingOptions: {
              enabled: true
            },
            // amountInFiat,
            toAddresses: destinations.map(dest => ({
              ...dest,
              amount: amount // Each destination will get the same amount
            })),
            clientFee: 0,
            isInclusiveFeeEnabled: false,
            transferType: 'payment'
          }
        }
      )

      const data = response.data
      if (!data?.content?.linkToken) {
        setError('No link token received')
        return
      }

      // Create the accessTokens array using your Coinbase access token
      // ONLY FOR DEMO PURPOSES
      const accessTokens: IntegrationAccessToken[] = [
        {
          accountId: 'anyguid',
          accountName: 'Coinbase wallets',
          accessToken: accessToken,
          brokerType: 'coinbase',
          brokerName: 'Coinbase'
        }
      ]

      // Create link with both the link token and accessTokens
      // link component with more options
      const meshLink = createLink({
        clientId: 'customIntegrationId1',
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
        },
        accessTokens,
        transferDestinationTokens: []
      })

      meshLink.openLink(data.content.linkToken)
    } catch (err: any) {
      setError(err.message || 'Failed to create link token')
    }
  }, [customIntegrationId1, accessToken, amount, destinations])

  const [directLinkToken, setDirectLinkToken] = useState('')

  // Add new handler function before the return statement
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
        minHeight: '100vh',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <h1
        style={{
          color: theme.colors.text,
          borderBottom: `2px solid ${theme.colors.primary}`,
          paddingBottom: theme.spacing.sm,
          marginBottom: theme.spacing.lg
        }}
      >
        Mesh Pay Workshop
      </h1>

      <LinkComponent
        linkToken={linkToken}
        onIntegrationConnected={setPayload}
        onExit={err => {
          setLinkToken(null)
          setError(err || null)
        }}
        onTransferFinished={setTransferFinishedData}
      />

      <Section title="1. Configure Payment">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm
          }}
        >
          <Input
            label="Amount (Crypto):"
            type="number"
            value={amount || ''}
            onChange={e =>
              setAmount(e.target.value ? Number(e.target.value) : 0)
            }
            min="0"
            style={{ width: '150px' }}
          />
        </div>
      </Section>

      <Section title="2. Configure Merchant">
        {destinations.map((dest, index) => {
          // Determine network name based on network ID ending
          const networkName = dest.networkId.endsWith('11')
            ? 'ETH'
            : dest.networkId.endsWith('60')
            ? 'AVAX'
            : dest.networkId.endsWith('88')
            ? 'Optimism'
            : ''

          return (
            <div
              key={index}
              style={{
                marginBottom: theme.spacing.sm,
                padding: theme.spacing.sm,
                backgroundColor: '#f8f9fa',
                borderRadius: theme.borderRadius
              }}
            >
              <h3 style={{ marginBottom: '5px' }}>
                Merchant Destination {index + 1}
              </h3>
              <p>Symbol: {dest.symbol}</p>
              <p>Address: {dest.address}</p>
              <p>
                Network ID: {dest.networkId} {networkName && `(${networkName})`}
              </p>
            </div>
          )
        })}
      </Section>

      <Section title="3. Launch Payment">
        <Input
          label="Custom Integration ID:"
          value={customIntegrationId}
          onChange={e => {
            const value = e.target.value
            console.log('Setting customIntegrationId:', value) // For debugging
            setCustomIntegrationId(value)
          }}
          placeholder="Enter your integration ID"
        />
        <Button onClick={getMeshPayLink}>Launch Mesh Pay</Button>
      </Section>

      {error && (
        <Section title="Error" style={{ backgroundColor: '#fff3f3' }}>
          <p style={{ color: theme.colors.error }}>{error}</p>
        </Section>
      )}

      {transferFinishedData && (
        <Section title="Transfer Result">
          <pre
            style={{
              backgroundColor: '#f8f9fa',
              padding: theme.spacing.sm,
              borderRadius: theme.borderRadius,
              overflow: 'auto'
            }}
          >
            {JSON.stringify(transferFinishedData, null, 2)}
          </pre>
        </Section>
      )}

      <Section title="4. Direct Catalog Launch">
        <Input
          label="Custom Integration ID:"
          value={customIntegrationId1}
          onChange={e => setCustomIntegrationId1(e.target.value)}
        />
        <Input
          label="Access Token:"
          value={accessToken}
          onChange={e => setAccessToken(e.target.value)}
          placeholder="Enter access token to skip to transfer step"
        />
        <p
          style={{
            fontSize: '0.9em',
            color: '#666',
            marginBottom: theme.spacing.sm
          }}
        >
          Note: Providing an access token will initialize the transfer flow
          directly
        </p>
        <Button onClick={launchCatalogDirectly}>
          Launch Integration {accessToken ? '(Direct to Transfer)' : ''}
        </Button>
      </Section>

      <Section title="5. Direct Link Token Launch">
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
    </div>
  )
}

export default App
