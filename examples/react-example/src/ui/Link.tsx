import React, { useEffect, useState } from 'react'
import {
  Link,
  LinkPayload,
  TransferFinishedPayload,
  createFrontConnection
} from '@front-finance/link'
import { clientId } from '../utility/config'

export const FrontComponent: React.FC<{
  linkToken?: string | null
  onBrokerConnected: (authData: LinkPayload) => void
  onTransferFinished?: (payload: TransferFinishedPayload) => void
  onExit?: (error?: string) => void
}> = ({ linkToken, onBrokerConnected, onTransferFinished, onExit }) => {
  const [frontConnection, setFrontConnection] =
    useState<Link | null>(null)

  useEffect(() => {
    setFrontConnection(
      createFrontConnection({
        clientId: clientId,
        onIntegrationConnected: authData => {
          console.info('[FRONT SUCCESS]', authData)
          onBrokerConnected(authData)
        },
        onExit: (error?: string) => {
          if (error) {
            console.error(`[FRONT ERROR] ${error}`)
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
      frontConnection?.openLink(linkToken)
    }
  }, [frontConnection, linkToken])

  return <></>
}
