# @front-finance/link

JS library for integrating with Front Finance

### Install

With `npm`:

```
npm install --save @front-finance/link
```

With `yarn`

```
yarn add @front-finance/link
```

### Getting connection link

Connection link should be obtained from the GET `/api/v1/cataloglink` endpoint. Api reference for this request is available [here](https://integration-api.getfront.com/apireference#tag/Integrations/paths/~1api~1v1~1cataloglink/get). Request must be preformed from the server side because it requires the client secret. You will get the response in the following format:

```json
{
  "content": {
    "url": "https://web.getfront.com/broker-connect?auth_code={authCode}",
    "iFrameUrl": "https://web.getfront.com/b2b-iframe/{clientId}/broker-connect?auth_code={authCode}"
  },
  "status": "ok",
  "message": ""
}
```

You can use `iFrameUrl` from this response to open the popup window with `openPopup` method.

### Generating connection method

```tsx
import { createFrontConnection } from '@front-finance/link';

// ...

const frontConnection = createFrontConnection({
  clientId: '<Your Front Finance Client Id>',
  onBrokerConnected: (brokerData: FrontPayload) => {
    // use broker account data
  },
  onExit: (error?: string) => {
    if (error) {
      // handle error
    } else {
      // ...
    }
  }

```

### Using connection to open auth link

To open authentication link rpovided by Front Finance Integration API you need to call `openPopup` method:

```tsx
frontConnection.openPopup(authLink)
```

ℹ️ See full source code example at [react-example/src/ui/Front.tsx](../../examples/react-example/src/ui/Front.tsx)

```tsx
import {
  createFrontConnection,
  FrontConnection,
  FrontPayload
} from '@front-finance/link'

// ...

const [frontConnection, setFrontConnection] = useState<FrontConnection | null>(
  null
)

useEffect(() => {
  setFrontConnection(createFrontConnection(options))
}, [])

useEffect(() => {
  if (authLink) {
    frontConnection?.openPopup(authLink)
  }
}, [frontConnection, authLink])

return <></>
```

### Getting tokens

After successfull authentication on Front Finance user will be redirected back to provided callback URL.
`FrontConnection` instance will check if URL contains query parameters, load broker tokens and fire the events.

### Available Connection configuration options

ℹ️ See [src/types/index.ts](src/utils/types.ts) for exported types.

#### `createFrontConnection` arguments

| key                  | type                                                   | description                                                                          |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `clientId`           | `string`                                               | Keys from https://dashboard.getfront.com/company/keys page                           |
| `onBrokerConnected`  | `(payload: FrontPayload) => void`                      | Callback called when users connects their accounts                                   |
| `onExit`             | `((error?: string \| undefined) => void) \| undefined` | Called if connection not happened                                                    |
| `onTransferFinished` | `(payload: TransferFinishedPayload) => void`           | Callback called when a crypto transfer is executed                                   |
| `onEvent`            | `(payload: FrontEventType) => void`                    | A callback function that is called when various events occur within the Front iframe |
| `accessTokens`       | `IntegrationAccessToken[]`                             | An array of integration access tokens                                                |

#### `createFrontConnection` return value

| key          | type                                   | description         |
| ------------ | -------------------------------------- | ------------------- |
| `openPopup`  | `(iframeUrl: string) => Promise<void>` | Opens url in popup  |
| `closePopup` | `() => Promise<void>`                  | Closes popup window |

### Using tokens

You can use broker tokens to perform requests to get current balance, assets and execute transactions. Full API reference can be found [here](https://integration-api.getfront.com/apireference).

## Typescript support

TypeScript definitions for `@front-finance/link` are built into the npm package.
