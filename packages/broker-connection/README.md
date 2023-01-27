# front-broker-connection

JS library for integrating with Front Finance

### Install

With `npm`:

```
npm install --save @front/broker-connection
```

With `yarn`

```
yarn add @front/broker-connection
```

### Generating connection method

```tsx
import { createFrontConnection } from '@front/broker-connection';

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

To open authentication link rpovided by Front Finance Integration API you need to call `openLink` method:

```tsx
frontConnection.openLink(authLink)
```

ℹ️ See full source code example at [react-example/src/ui/Front.tsx](../../examples/react-example/src/ui/Front.tsx)

```tsx
import {
  createFrontConnection,
  FrontConnection,
  FrontPayload
} from '@front/broker-connection'

// ...

const [frontConnection, setFrontConnection] = useState<FrontConnection | null>(
  null
)

useEffect(() => {
  setFrontConnection(createFrontConnection(options))
}, [])

useEffect(() => {
  if (authLink) {
    frontConnection?.openLink(authLink)
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

| key                 | type                                                   |
| ------------------- | ------------------------------------------------------ |
| `clientId`          | `string`                                               |
| `onBrokerConnected` | `(payload: FrontPayload) => void`                      |
| `onExit`            | `((error?: string \| undefined) => void) \| undefined` |

#### `createFrontConnection` return value

| key        | type                  |
| ---------- | --------------------- |
| `openLink` | `() => Promise<void>` |

## Typescript support

TypeScript definitions for `@front/broker-connection` are built into the npm package.
