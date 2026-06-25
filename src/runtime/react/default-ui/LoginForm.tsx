import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../AuthProvider.js";
import { LoginFormSchema, type LoginForm as LoginFormData } from "../../schemas.js";

const defaultInputClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";
const defaultLabelClassName =
  "flex items-center gap-2 pb-2 text-sm leading-none font-medium select-none";

export type LoginFormClassNames = Partial<{
  root: string;
  header: string;
  title: string;
  description: string;
  form: string;
  content: string;
  error: string;
  field: string;
  label: string;
  input: string;
  fieldError: string;
  footer: string;
  submitButton: string;
  divider: string;
  dividerText: string;
  googleButton: string;
  googleIcon: string;
  after: string;
}>;

export type LoginFormProps = {
  errorMessage?: string;
  loginTitle?: string;
  loginDescription?: string;
  userLabel?: string;
  usernamePlaceholder?: string;
  passwordLabel?: string;
  signInButtonText?: string;
  signinWithGoogleButtonText?: string;
  signinLabel?: string;
  orText?: string;
  googleUnavailableText?: string;
  googleEnabled?: boolean;
  googleIcon?: ReactNode;
  onGoogleLogin?: () => Promise<void> | void;
  onLogin?: (credentials: LoginFormData) => Promise<void> | void;
  onLoginSuccess?: () => void;
  after?: ReactNode;
  classNames?: LoginFormClassNames;
};

export function LoginForm({
  errorMessage = "Invalid credentials. Please try again.",
  loginTitle = "Welcome Back",
  loginDescription = "Sign in to manage your account and security credentials",
  userLabel = "Email address",
  usernamePlaceholder = "you@example.com",
  passwordLabel = "Password",
  signInButtonText = "Sign In with Password",
  signinWithGoogleButtonText = "Continue with Google",
  signinLabel = "Signing in...",
  orText = "or",
  googleUnavailableText = "Google sign-in is not available.",
  googleEnabled = false,
  googleIcon,
  onGoogleLogin,
  onLogin,
  onLoginSuccess,
  after,
  classNames = {},
}: LoginFormProps = {}) {
  const { login } = useAuth();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLogin = onLogin ?? ((credentials: LoginFormData) => login(credentials.username, credentials.password));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormErrors({});
    setApiError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData);
    const result = LoginFormSchema.safeParse(data);

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errors[issue.path[0].toString()] = issue.message;
      });
      setFormErrors(errors);
      setIsSubmitting(false);
      return;
    }

    try {
      await submitLogin(result.data);
      onLoginSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : errorMessage;
      setApiError(message || errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!onGoogleLogin) {
      setApiError(googleUnavailableText);
      return;
    }
    setApiError(null);
    try {
      await onGoogleLogin();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : googleUnavailableText);
    }
  };

  return (
    <section className={classNames.root ?? "not-content fa-auth-panel"}>
      <div className={classNames.header}>
        <h1 className={classNames.title}>{loginTitle}</h1>
        {loginDescription ? <p className={classNames.description}>{loginDescription}</p> : null}
      </div>
      <form className={classNames.form} onSubmit={handleSubmit}>
        <div className={classNames.content}>
          {apiError ? (
            <div className={classNames.error} role="alert">
              {apiError}
            </div>
          ) : null}

          <div className={classNames.field}>
            <label className={classNames.label ?? defaultLabelClassName} htmlFor="username">
              {userLabel}
            </label>
            <input
              autoComplete="email"
              className={classNames.input ?? defaultInputClassName}
              id="username"
              name="username"
              placeholder={usernamePlaceholder}
              required
              type="email"
            />
            {formErrors.username ? (
              <p className={classNames.fieldError}>{formErrors.username}</p>
            ) : null}
          </div>

          <div className={classNames.field}>
            <label className={classNames.label ?? defaultLabelClassName} htmlFor="password">
              {passwordLabel}
            </label>
            <input
              autoComplete="current-password"
              className={classNames.input ?? defaultInputClassName}
              id="password"
              name="password"
              required
              type="password"
            />
            {formErrors.password ? (
              <p className={classNames.fieldError}>{formErrors.password}</p>
            ) : null}
          </div>
        </div>

        <div className={classNames.footer}>
          <button className={classNames.submitButton} disabled={isSubmitting} type="submit">
            {isSubmitting ? signinLabel : signInButtonText}
          </button>

          {googleEnabled ? (
            <>
              <div className={classNames.divider}>
                <span className={classNames.dividerText}>{orText}</span>
              </div>
              <button className={classNames.googleButton} type="button" onClick={handleGoogleLogin}>
                {googleIcon ? <span className={classNames.googleIcon}>{googleIcon}</span> : null}
                {signinWithGoogleButtonText}
              </button>
            </>
          ) : null}
        </div>
      </form>
      {after ? <div className={classNames.after}>{after}</div> : null}
    </section>
  );
}
