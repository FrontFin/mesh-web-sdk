import React, { useState, useCallback } from 'react'
import { frontApiUrl, clientId, clientSecret } from '../utility/config'
import { FrontComponent } from './Front'
import { FrontPayload, TransferFinishedPayload } from '@front-finance/link'
import { FrontApi } from '@front-finance/api'

export const App: React.FC = () => {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<FrontPayload | null>(null)
  const [trasnferFinishedData, setTrasnferFinishedData] =
    useState<TransferFinishedPayload | null>(null)

  const getAuthLink = useCallback(async () => {
    setError(null)
    setLinkToken(null)
    const api = new FrontApi({
      baseURL: frontApiUrl,
      headers: {
        'x-client-id': clientId, // insert your client id here
        'x-client-secret': clientSecret // do not use your clientSecret on the FE
      }
    })

    // this request should be performed from the backend side
    const response = await api.managedAccountAuthentication.v1LinktokenCreate({
      userId: '7652B44F-9CDB-4519-AC82-4FA5500F7455' // insert your unique user identifier here
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
      baseURL: frontApiUrl,
      headers: {
        'x-client-id': clientId, // insert your client id here
        'x-client-secret': clientSecret // do not use your clientSecret on the FE
      }
    })

    // this request should be performed from the backend side
    const response = await api.managedAccountAuthentication.v1LinktokenCreate({
      userId: '7652B44F-9CDB-4519-AC82-4FA5500F7455', // insert your unique user identifier here
      transferOptions: {
        amountInFiat: 10, // amount to transfer
        toAddresses: [
          {
            symbol: 'USDC', // cryptocurrency to transfer
            address: '0x9Bf6207f8A3f4278E0C989527015deFe10e5D7c6', // address to transfer
            networkId: '7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12' // network id from /api/v1/transfers/managed/networks request
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
          Front and authenticate
        </p>
      )}

      {trasnferFinishedData && (
        <div style={{ wordWrap: 'break-word' }}>
          <h1>Transfer finished!</h1>
          <p>{JSON.stringify(trasnferFinishedData, null, 2)}</p>
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
          Front Connection
        </button>

        <button style={{ width: '50%' }} onClick={getTransferLink}>
          Front Transfer
        </button>
      </div>

      <FrontComponent
        linkToken={linkToken}
        onBrokerConnected={(authData: FrontPayload) => {
          setPayload(authData)
          setLinkToken(null)
        }}
        onExit={err => {
          setLinkToken(null)
          setError(err || null)
        }}
        onTransferFinished={data => {
          setTrasnferFinishedData(data)
        }}
      />
    </div>
  )
}

export default App
