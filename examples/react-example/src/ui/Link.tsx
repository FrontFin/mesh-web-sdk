import React, { useEffect, useState } from 'react'
import {
  Link,
  LinkPayload,
  TransferFinishedPayload,
  createLink,
  getWagmiInjectedData
} from '@meshconnect/web-link-sdk'
import { clientId } from '../utility/config'

export const LinkComponent: React.FC<{
  linkToken?: string | null
  onIntegrationConnected: (authData: LinkPayload) => void
  onTransferFinished?: (payload: TransferFinishedPayload) => void
  onExit?: (error?: string) => void
}> = ({ linkToken, onIntegrationConnected, onTransferFinished, onExit }) => {
  const [linkConnection, setLinkConnection] = useState<Link | null>(null)

  const injectedConnectors = getWagmiInjectedData()
  useEffect(() => {
    setLinkConnection(
      createLink({
        clientId: clientId,
        injectedConnectors: injectedConnectors,
        onIntegrationConnected: authData => {
          console.info('[FRONT CONNECTED]', authData)
          onIntegrationConnected(authData)
        },
        onExit: (error, summary) => {
          if (error) {
            console.error(`[FRONT ERROR] ${error}`)
          }

          if (summary) {
            console.log('Summary', summary)
          }

          onExit?.()
        },
        onTransferFinished: transferData => {
          console.info('[FRONT TRANSFER FINISHED]', transferData)
          onTransferFinished?.(transferData)
        },
        onEvent: ev => {
          console.info('[FRONT Event]', ev)
        }
      })
    )
  }, [])

  useEffect(() => {
    if (linkToken) {
      linkConnection?.openLink(linkToken)
    }
  }, [linkConnection, linkToken])

  return <></>
}
