import React, { useState, useCallback } from 'react'
import { linkApiUrl, clientId, clientSecret } from '../utility/config'
import { LinkComponent } from './Link'
import { LinkPayload, TransferFinishedPayload } from '@meshconnect/web-link-sdk'
import { FrontApi } from '@meshconnect/node-api'

export const App: React.FC = () => {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<LinkPayload | null>(null)
  const [transferFinishedData, setTransferFinishedData] =
    useState<TransferFinishedPayload | null>(null)

  const getAuthLink = useCallback(async () => {
    setError(null)
    setLinkToken(null)
    const api = new FrontApi({
      baseURL: linkApiUrl,
      headers: {
        'x-client-id': clientId, // insert your client id here
        'x-client-secret': clientSecret // do not use your clientSecret on the FE
      }
    })

    const response = await api.managedAccountAuthentication.v1LinktokenCreate({
      userId: '2b743d87-c11a-498d-94fb-08dc4769788d'
    })

    const data = response.data
    if (response.status !== 200 || !data?.content) {
      const error = (data && data.message) || response.statusText
      console.error('Error!', error)
      setError(error)
    } else if (!data.content.linkToken) {
      setError('Iframe url is empty')
    } else {
      setLinkToken(data.content.linkToken)
    }
  }, [])

  const getTransferLink = useCallback(async () => {
    setError(null)
    setLinkToken(null)
    const api = new FrontApi({
      baseURL: linkApiUrl,
      headers: {
        'x-client-id': clientId, // insert your client id here
        'x-client-secret': clientSecret // do not use your clientSecret on the FE
      }
    })

    // this request should be performed from the backend side
    const response = await api.managedAccountAuthentication.v1LinktokenCreate({
      userId: '7652B44F-9CDB-4519-AC82-4FA5500F7455', // insert your unique user identifier here
      transferOptions: {
        amountInFiat: 0.01,
        // flip when using smart deposit
        //amountInFiat: 1.0,
        // clientFee: 0.001,
        toAddresses: [
          {
            symbol: 'USDC',
            address: '0x9Bf6207f8A3f4278E0C989527015deFe10e5D7c6',
            networkId: '7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12'
          },
          // leaving in for test
          {
            symbol: 'AVAX',
            address: '0xF389820c6b1A034BD4FfF178aC7A7d95e376A27a',
            networkId: 'bad16371-c22a-4bf4-a311-274d046cd760'
          }
        ]
      }
    })

    const data = response.data
    if (response.status !== 200 || !data?.content) {
      const error = (data && data.message) || response.statusText
      console.error('Error!', error)
      setError(error)
    } else if (!data.content.linkToken) {
      setError('Iframe url is empty')
    } else {
      setLinkToken(data.content.linkToken)
    }
  }, [])

  return (
    <div style={{ padding: '15px' }}>
      {(payload && (
        <div style={{ wordWrap: 'break-word' }}>
          <h1>Connected!</h1>
          <p>
            <b>Broker:</b> {payload.accessToken?.brokerName}
            <br />
            <b>Token:</b> {payload.accessToken?.accountTokens[0].accessToken}
            <br />
            <b>Refresh Token:</b>{' '}
            {payload.accessToken?.accountTokens[0].refreshToken}
            <br />
            <b>Token expires in seconds:</b>{' '}
            {payload.accessToken?.expiresInSeconds}
            <br />
            <b>ID:</b> {payload.accessToken?.accountTokens[0].account.accountId}
            <br />
            <b>Name: </b>
            {payload.accessToken?.accountTokens[0].account.accountName}
            <br />
            <b>Cash:</b> ${payload.accessToken?.accountTokens[0].account.cash}
            <br />
          </p>
        </div>
      )) || (
        <p>
          No accounts connected recently! Please press the button below to use
          Link and authenticate
        </p>
      )}

      {transferFinishedData && (
        <div style={{ wordWrap: 'break-word' }}>
          <h1>Transfer finished!</h1>
          <p>{JSON.stringify(transferFinishedData, null, 2)}</p>
        </div>
      )}

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <button style={{ width: '50%' }} onClick={getAuthLink}>
          Link
        </button>

        <button style={{ width: '50%' }} onClick={getTransferLink}>
          Transfer
        </button>
      </div>
      {/* <WagmiCoreProvider> */}
      {/* or <WagmiProvider> */}
      <LinkComponent
        linkToken={linkToken}
        onIntegrationConnected={(authData: LinkPayload) => {
          setPayload(authData)
          setLinkToken(null)
        }}
        onExit={err => {
          setLinkToken(null)
          setError(err || null)
        }}
        onTransferFinished={data => {
          setTransferFinishedData(data)
        }}
      />
      {/* </WagmiCoreProvider> */}
    </div>
  )
}

export default App
