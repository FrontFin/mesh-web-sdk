import React, { FunctionComponent, useEffect, useState } from 'react'
import { createFrontConnection } from 'front-broker-connection'
import { FrontConnection, FrontPayload } from 'front-broker-connection'
import { clientId } from '../utility/config'

export const FrontComponent: FunctionComponent<{
  authLink?: string | null
  onSuccess: (authData: FrontPayload) => void
}> = ({ authLink, onSuccess }) => {
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
        }
      })
    )
  }, [])

  useEffect(() => {
    if (authLink) {
      frontConnection?.openLink(authLink)
    }
  }, [frontConnection, authLink])

  return <></>
}
