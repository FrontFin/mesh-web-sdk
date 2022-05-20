import { FrontPayload, Front } from "./types";
export declare const createFrontConnection: (options: {
    authLink: string;
    onBrokerConnected: (payload: FrontPayload) => void;
    onExit?: ((error?: string | undefined) => void) | undefined;
}) => Front;
