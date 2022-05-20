import { FrontPayload } from "front-b2b/esm/types";
import { FunctionComponent, useState } from "react";
import { headers } from "../utility/config";
import { FrontComponent } from "./Front";

export const App: FunctionComponent = () => {
  const [authLink, setAuthLink] = useState<string | null>(null);
  const [payload, setPayload] = useState<FrontPayload | null>(null);

  const getAuthLink = async () => {
    setAuthLink(null);
    const response = await fetch(
      "https://api.front.org/api/b2b/cataloglink?userId=some-user-id",
      {
        headers,
      }
    );
    const data = await response.json();
    if (!response.ok) {
      const error = (data && data.message) || response.statusText;
      console.error("Error!", error);
    } else {
      setAuthLink(data.content.url);
    }
  };

  return (
    <div style={{ padding: "15px" }}>
      {(payload && (
        <div style={{ wordWrap: "break-word" }}>
          <h1>Connected!</h1>
          <p>
            <b>Broker:</b> {payload.accessToken?.brokerName}
            <br />
            <b>Token:</b> {payload.accessToken?.accountTokens[0].accessToken}
            <br />
            <b>ID:</b> {payload.accessToken?.accountTokens[0].account.accountId}
            <br />
            <b>Name: </b>
            {payload.accessToken?.accountTokens[0].account.accountName}
            <br />
            <b>Cash:</b> ${payload.accessToken?.accountTokens[0].account.cash}
            <br />
          </p>
        </div>
      )) || (
        <p>
          No accounts connected recently! Please press the button below to use
          Front and authenticate
        </p>
      )}

      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <button
          style={{ width: "50%" }}
          onClick={() => {
            getAuthLink();
          }}
        >
          Front Broker Connection
        </button>
      </div>

      {authLink && (
        <FrontComponent
          authLink={
            "http://localhost:3000/broker-connect?auth_code=" +
            authLink.split("auth_code=")[1]
          }
          onSuccess={(authData: FrontPayload) => {
            setPayload(authData);
            setAuthLink(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
