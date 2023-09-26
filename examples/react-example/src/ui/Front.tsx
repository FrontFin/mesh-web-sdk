import React, { useEffect, useState } from 'react'
import {
  FrontConnection,
  FrontPayload,
  TransferFinishedPayload,
  createFrontConnection
} from '@front-finance/link'
import { clientId } from '../utility/config'

export const FrontComponent: React.FC<{
  linkToken?: string | null
  onBrokerConnected: (authData: FrontPayload) => void
  onTransferFinished?: (payload: TransferFinishedPayload) => void
  onExit?: (error?: string) => void
}> = ({ linkToken, onBrokerConnected, onTransferFinished, onExit }) => {
  const [frontConnection, setFrontConnection] =
    useState<FrontConnection | null>(null)

  useEffect(() => {
    setFrontConnection(
      createFrontConnection({
        clientId: clientId,
        onBrokerConnected: authData => {
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
