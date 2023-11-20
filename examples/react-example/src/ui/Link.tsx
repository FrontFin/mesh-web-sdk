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
  const [linkConnection, setLinkConnection] =
    useState<Link | null>(null)

  useEffect(() => {
    setLinkConnection(
      createLink({
        clientId: clientId,
        onIntegrationConnected: (authData) => {
          console.info('[FRONT SUCCESS]', authData)
          onIntegrationConnected(authData)
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
      linkConnection?.openLink(linkToken)
    }
  }, [linkConnection, linkToken])

  return <></>
}
