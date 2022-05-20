# front-b2b-link

JS library for integrating with Front Finance

### Generating connection method

```tsx
import { createFrontConnection } from 'front-b2b';

// ...

const frontConnection = createFrontConnection({
  authLink: '<GENERATED_AUTH_LINK>',
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

### Immediate connection

Front connection to open immediately when your page or component renders.
This is useful for scenarios without any user input (such as clicking a button)

ℹ️ See full source code example at [react-example/src/ui/Front.tsx](https://github.com/FrontFin/front-b2b-link/tree/main/react-example/src/ui/Front.tsx)

```tsx
import { createFrontConnection } from 'front-b2b';
import { FrontPayload } from 'front-b2b/esm/types';
import { Front } from 'front-b2b/esm/FrontLink';

// ...

const [frontConnection, setFrontConnection] = useState<Front | null>(null);

useEffect(() => {
    setFrontConnection(
      createFrontConnection(options)
    );
}, []);

useEffect(() => {
  frontConnection?.open();
}, [frontConnection]);

return <></>;
```

### Event fired connection

Await event to fire before starting Front connection.

```tsx
import { createFrontConnection } from 'front-b2b';
import { FrontPayload } from 'front-b2b/esm/types';
import { Front } from 'front-b2b/esm/FrontLink';

// ...

const [frontConnection, setFrontConnection] = useState<Front | null>(null);

useEffect(() => {
    setFrontConnection(
      createFrontConnection(options)
    );
}, []);
  
return (
    <button onClick={() => {
        frontConnection?.open();
      }}
    >
      Connect
    </button>
  );
```

### Available Connection configuration options

ℹ️ See [src/types/index.ts](https://github.com/FrontFin/front-b2b-link/tree/main/src/types/index.ts) for exported types.

#### `createFrontConnection` arguments

| key                   | type                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `authLink`            | `string`                                                                                  |
| `onBrokerConnected`   | `(payload: FrontPayload) => void`                                                         |
| `onExit`              | `((error?: string \| undefined) => void) \| undefined`                                    |

#### `createFrontConnection` return value

| key       | type                                                            |
| --------- | --------------------------------------------------------------- |
| `open`    | `() => void`                                                    |
| `dispose` | `() => void`                                                    |


## Typescript support

TypeScript definitions for `front-b2b-link` are built into the npm package.
