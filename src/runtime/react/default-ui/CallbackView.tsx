import { useEffect, useState } from "react";
import { exchangeGoogleCode, takePkceVerifier } from "../../api/oauth.js";

type CallbackState = {
  message: string;
  role: "alert" | "status";
};

export function CallbackView() {
  const [state, setState] = useState<CallbackState>({ message: "Completing sign in", role: "status" });

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const verifier = takePkceVerifier();
    if (!code || !verifier) {
      setState({ message: "OAuth callback is missing required state.", role: "alert" });
      return;
    }
    exchangeGoogleCode({ code, code_verifier: verifier })
      .then(() => {
        window.location.assign("../user/account");
      })
      .catch(() => setState({ message: "Unable to complete OAuth sign in.", role: "alert" }));
  }, []);

  return (
    <section className="not-content fa-auth-panel">
      <p role={state.role}>{state.message}</p>
    </section>
  );
}
