import { FunctionComponent, useEffect, useState } from "react";
import { createFrontConnection } from "front-b2b";
import { FrontPayload } from "front-b2b/esm/types";
import { Front } from "front-b2b/esm/FrontLink";

export const FrontComponent: FunctionComponent<{
  authLink: string;
  onSuccess: (authData: FrontPayload) => void;
}> = ({ authLink, onSuccess }) => {
  const [frontConnection, setFrontConnection] = useState<Front | null>(null);

  useEffect(() => {
    setFrontConnection(
      createFrontConnection({
        authLink,
        onBrokerConnected: (authData) => {
          onSuccess(authData);
        },
        onExit: (error?: string) => {
          if (error) console.log(`[ERROR] ${error}`);
        },
      })
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    frontConnection?.open();
  }, [frontConnection]);

  return <></>;
};
