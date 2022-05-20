import { FrontPayload } from "./types";
export interface Front {
    open: () => void;
    dispose: () => void;
}
export declare const createFrontConnection: (options: {
    authLink: string;
    onBrokerConnected: (payload: FrontPayload) => void;
    onExit?: ((error?: string | undefined) => void) | undefined;
}) => Front;
