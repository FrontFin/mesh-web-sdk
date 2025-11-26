import React, { useEffect, useState } from 'react'
import {
  Link,
  LinkPayload,
  TransferFinishedPayload,
  createLink
} from '@meshconnect/web-link-sdk'
import { clientId } from '../utility/config'

export const LinkComponent: React.FC<{
  linkToken?: string | null
  onIntegrationConnected: (authData: LinkPayload) => void
  onTransferFinished?: (payload: TransferFinishedPayload) => void
  onExit?: (error?: string) => void
}> = ({ linkToken, onIntegrationConnected, onTransferFinished, onExit }) => {
  const [linkConnection, setLinkConnection] = useState<Link | null>(null)

  useEffect(() => {
    setLinkConnection(
      createLink({
        clientId: clientId,
        language: 'en',
        displayFiatCurrency: 'USD',
        onIntegrationConnected: authData => {
          console.info('[MESH CONNECTED]', authData)
          onIntegrationConnected(authData)
        },
        onExit: (error, summary) => {
          if (error) {
            console.error(`[MESH ERROR] ${error}`)
          }

          if (summary) {
            console.log('Summary', summary)
          }

          onExit?.()
        },
        onTransferFinished: transferData => {
          console.info('[MESH TRANSFER FINISHED]', transferData)
          onTransferFinished?.(transferData)
        },
        onEvent: ev => {
          console.info('[MESH Event]', ev)
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
