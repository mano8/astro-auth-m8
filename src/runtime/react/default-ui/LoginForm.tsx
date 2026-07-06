import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../AuthProvider.js";
import { LoginFormSchema, type LoginForm as LoginFormData } from "../../schemas.js";

const defaultInputClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";
const defaultLabelClassName =
  "flex items-center gap-2 pb-2 text-sm leading-none font-medium select-none";
const defaultRootClassName =
  "not-content fa-auth-panel mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/70 bg-card/95 p-6 text-card-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90";
const defaultHeaderClassName = "space-y-2";
const defaultTitleClassName = "text-3xl font-semibold tracking-tight text-foreground";
const defaultDescriptionClassName = "text-sm text-muted-foreground";
const defaultFormClassName = "space-y-5";
const defaultContentClassName = "space-y-4";
const defaultErrorClassName =
  "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive";
const defaultFieldClassName = "space-y-2";
const defaultFieldErrorClassName = "text-sm text-destructive";
const defaultFooterClassName = "space-y-3";
const defaultSubmitButtonClassName =
  "inline-flex min-h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50";
const defaultDividerClassName = "relative flex items-center py-1";
const defaultDividerTextClassName =
  "mx-auto bg-card px-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground";
const defaultGoogleButtonClassName =
  "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50";
const defaultGoogleIconClassName = "inline-flex items-center";
const defaultAfterClassName = "text-sm text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline";

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
    <section className={classNames.root ?? defaultRootClassName}>
      <div className={classNames.header ?? defaultHeaderClassName}>
        <h1 className={classNames.title ?? defaultTitleClassName}>{loginTitle}</h1>
        {loginDescription ? <p className={classNames.description ?? defaultDescriptionClassName}>{loginDescription}</p> : null}
      </div>
      <form className={classNames.form ?? defaultFormClassName} onSubmit={handleSubmit}>
        <div className={classNames.content ?? defaultContentClassName}>
          {apiError ? (
            <div className={classNames.error ?? defaultErrorClassName} role="alert">
              {apiError}
            </div>
          ) : null}

          <div className={classNames.field ?? defaultFieldClassName}>
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
              <p className={classNames.fieldError ?? defaultFieldErrorClassName}>{formErrors.username}</p>
            ) : null}
          </div>

          <div className={classNames.field ?? defaultFieldClassName}>
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
              <p className={classNames.fieldError ?? defaultFieldErrorClassName}>{formErrors.password}</p>
            ) : null}
          </div>
        </div>

        <div className={classNames.footer ?? defaultFooterClassName}>
          <button className={classNames.submitButton ?? defaultSubmitButtonClassName} disabled={isSubmitting} type="submit">
            {isSubmitting ? signinLabel : signInButtonText}
          </button>

          {googleEnabled ? (
            <>
              <div className={classNames.divider ?? defaultDividerClassName}>
                <span className={classNames.dividerText ?? defaultDividerTextClassName}>{orText}</span>
              </div>
              <button className={classNames.googleButton ?? defaultGoogleButtonClassName} type="button" onClick={handleGoogleLogin}>
                {googleIcon ? <span className={classNames.googleIcon ?? defaultGoogleIconClassName}>{googleIcon}</span> : null}
                {signinWithGoogleButtonText}
              </button>
            </>
          ) : null}
        </div>
      </form>
      {after ? <div className={classNames.after ?? defaultAfterClassName}>{after}</div> : null}
    </section>
  );
}
