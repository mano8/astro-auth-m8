import { useEffect, useState } from "react";
import { exchangeGoogleCode, takePkceVerifier } from "../../api/oauth.js";

export function CallbackView() {
  const [message, setMessage] = useState("Completing sign in");

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const verifier = takePkceVerifier();
    if (!code || !verifier) {
      setMessage("OAuth callback is missing required state.");
      return;
    }
    exchangeGoogleCode({ code, code_verifier: verifier })
      .then(() => {
        window.location.assign("../user/account");
      })
      .catch(() => setMessage("Unable to complete OAuth sign in."));
  }, []);

  return <p>{message}</p>;
}
