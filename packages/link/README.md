# @meshconnect/web-link-sdk

A client-side JS library for integrating with Mesh Connect

### Install

With `npm`:

```
npm install --save @meshconnect/web-link-sdk
```

With `yarn`

```
yarn add @meshconnect/web-link-sdk
```

### Getting Link token

Link token should be obtained from the GET `/api/v1/linktoken` endpoint. Api reference for this request is available [here](https://docs.meshconnect.com/api-reference/managed-account-authentication/get-link-token-with-parameters). Request must be preformed from the server side because it requires the client secret. You will get the response in the following format:

```json
{
  "content": {
    "linkToken": "{linktoken}"
  },
  "status": "ok",
  "message": ""
}
```

You can use `linkToken` value from this response to open the popup window with `openLink` method.

### Generating connection method

```tsx
import { createLink } from '@meshconnect/web-link-sdk';

// ...

const linkConnection = createLink({
  clientId: '<Your Mesh Connect Client Id>',
  onIntegrationConnected: (data: LinkPayload) => {
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
linkConnection.openLink(linkToken)
```

ℹ️ See full source code example at [react-example/src/ui/Link.tsx](../../examples/react-example/src/ui/Link.tsx)

```tsx
import { createLink, Link, LinkPayload } from '@meshconnect/web-link-sdk'

// ...

const [linkConnection, setLinkConnection] = useState<Link | null>(null)

useEffect(() => {
  setLinkConnection(createLink(options))
}, [])

useEffect(() => {
  if (authLink) {
    linkConnection?.openLink(linkToken)
  }
}, [linkConnection, authLink])

return <></>
```

### Getting tokens

After successfull authentication on the Link session, the popup will be closed and the broker tokens will be passed to the `onIntegrationConnected` function.
`Link` instance will check if URL contains query parameters, load broker tokens and fire the events.

### Available Connection configuration options

ℹ️ See [src/types/index.ts](src/utils/types.ts) for exported types.

#### `createLink` arguments

| key                      | type                                                   | description                                                                          |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `clientId`               | `string`                                               | Keys from https://dashboard.meshconnect.com/company/keys page                        |
| `onIntegrationConnected` | `(payload: LinkPayload) => void`                       | Callback called when users connects their accounts                                   |
| `onExit`                 | `((error?: string \| undefined) => void) \| undefined` | Called if connection not happened                                                    |
| `onTransferFinished`     | `(payload: TransferFinishedPayload) => void`           | Callback called when a crypto transfer is executed                                   |
| `onEvent`                | `(payload: LinkEventType) => void`                     | A callback function that is called when various events occur within the Front iframe |
| `accessTokens`           | `IntegrationAccessToken[]`                             | An array of integration access tokens                                                |

#### `createLink` return value

| key         | type                                   | description              |
| ----------- | -------------------------------------- | ------------------------ |
| `openLink`  | `(linkToken: string) => Promise<void>` | Opens the Link UI popup  |
| `closeLink` | `() => Promise<void>`                  | Closes the Link UI popup |

### Using tokens

You can use broker tokens to perform requests to get current balance, assets and execute transactions. Full API reference can be found [here](https://integration-api.meshconnect.com/apireference).

## Typescript support

TypeScript definitions for `@meshconnect/web-link-sdk` are built into the npm package.
