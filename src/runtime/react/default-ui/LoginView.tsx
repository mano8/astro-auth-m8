import { LoginForm } from "./LoginForm.js";

export function LoginView({ signupHref, googleEnabled = false, onGoogle }: { signupHref?: string; googleEnabled?: boolean; onGoogle?: () => void }) {
  return (
    <LoginForm
      googleEnabled={googleEnabled}
      onGoogleLogin={onGoogle}
      loginTitle="Sign in"
      loginDescription=""
      signInButtonText="Sign in"
      signinLabel="Signing in"
      after={signupHref ? <p><a href={signupHref}>Create an account</a></p> : null}
      onLoginSuccess={() => {
        window.location.assign("../user/account");
      }}
    />
  );
}
