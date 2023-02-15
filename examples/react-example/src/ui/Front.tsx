import React, { useEffect, useState } from 'react'
import {
  FrontConnection,
  FrontPayload,
  createFrontConnection
} from '@front-finance/link'
import { clientId } from '../utility/config'

export const FrontComponent: React.FC<{
  iframeLink?: string | null
  onSuccess: (authData: FrontPayload) => void
  onExit?: (error?: string) => void
}> = ({ iframeLink, onSuccess, onExit }) => {
  const [frontConnection, setFrontConnection] =
    useState<FrontConnection | null>(null)

  useEffect(() => {
    setFrontConnection(
      createFrontConnection({
        clientId: clientId,
        onBrokerConnected: authData => {
          console.info('[FRONT SUCCESS]', authData)
          onSuccess(authData)
        },
        onExit: (error?: string) => {
          if (error) {
            console.error(`[FRONT ERROR] ${error}`)
          }

          onExit?.()
        }
      })
    )
  }, [])

  useEffect(() => {
    if (iframeLink) {
      frontConnection?.openPopup(iframeLink)
    }

    return () => {
      if (iframeLink) {
        frontConnection?.closePopup()
      }
    }
  }, [frontConnection, iframeLink])

  return <></>
}
