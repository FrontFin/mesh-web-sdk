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

### Getting Link token

Link token should be obtained from the GET `/api/v1/linktoken` endpoint. Api reference for this request is available [here](https://integration-api.getfront.com/apireference#tag/Managed-Account-Authentication/paths/~1api~1v1~1linktoken/post). Request must be preformed from the server side because it requires the client secret. You will get the response in the following format:

```json
{
  "content": {
   "linkToken": "{linktoken}"
},
  },
  "status": "ok",
  "message": ""
}
```

You can use `linkToken` value from this response to open the popup window with `openLink` method.

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

To open authentication link provided by Front Finance Integration API you need to call `openLink` method:

```tsx
frontConnection.openLink(linkToken)
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
    frontConnection?.openLink(linkToken)
  }
}, [frontConnection, authLink])

return <></>
```

### Getting tokens

After successfull authentication on the Link session, the popup will be closed and the broker tokens will be passed to the `onBrokerConnected` function.
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

| key          | type                                   | description                    |
| ------------ | -------------------------------------- | ------------------------------ |
| `openLink`   | `(linkToken: string) => Promise<void>` | Opens the Link UI popup        |
| `closeLink`  | `() => Promise<void>`                  | Closes the Link UI popup       |
| `o̶p̶e̶n̶P̶o̶p̶u̶p̶`  | `(iframeUrl: string) => Promise<void>` | (OBSOLETE) Opens url in popup  |
| `c̶l̶o̶s̶e̶P̶o̶p̶u̶p̶` | `() => Promise<void>`                  | (OBSOLETE) Closes popup window |

### Using tokens

You can use broker tokens to perform requests to get current balance, assets and execute transactions. Full API reference can be found [here](https://integration-api.getfront.com/apireference).

## Typescript support

TypeScript definitions for `@front-finance/link` are built into the npm package.
