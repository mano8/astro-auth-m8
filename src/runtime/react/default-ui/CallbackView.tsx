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
    <section className="not-content fa-auth-panel mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border/70 bg-card/95 p-6 text-card-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90">
      <p className={state.role === "alert" ? "text-sm text-destructive" : "text-sm text-muted-foreground"} role={state.role}>
        {state.message}
      </p>
    </section>
  );
}
