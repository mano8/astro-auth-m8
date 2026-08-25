import * as React from "react";

/**
 * Island-root error boundary for the auth plugin (`A-C3`).
 *
 * Every auth view is mounted as an Astro island. A render throw anywhere inside
 * one unmounts the entire island tree, so the route is left with a blank region
 * and a console trace. On this plugin that lands harder than elsewhere: the
 * blanked island is the login form, and a user with no visible way to sign in
 * has no way to reach any other plugin either.
 *
 * A class on purpose: `getDerivedStateFromError`/`componentDidCatch` still have
 * no hook equivalent.
 *
 * The prop contract mirrors `@mano8/astro-ui-m8`'s canonical `error-boundary`
 * registry block deliberately, so the two can be collapsed onto one
 * implementation once that block is reachable from this package. It is not
 * reachable today: the block ships in an unpublished `astro-ui-m8`, and copied
 * registry items are consumer-side artifacts rather than package runtime.
 */
export interface AuthErrorBoundaryFallbackProps {
  error: Error;
  reset: () => void;
}

export interface AuthErrorBoundaryLabels {
  title: string;
  description: string;
  retry: string;
}

const DEFAULT_LABELS: AuthErrorBoundaryLabels = {
  title: "This view stopped responding",
  description: "The page hit an unexpected error and could not finish rendering.",
  retry: "Reload this view"
};

export interface AuthErrorBoundaryProps {
  children: React.ReactNode;
  /** Replaces the default surface. Receives the error and a `reset`. */
  fallback?: (props: AuthErrorBoundaryFallbackProps) => React.ReactNode;
  /** Reporting hook. The boundary never logs on its own. */
  onError?: (error: Error, info: { componentStack: string }) => void;
  /** Clears the boundary when any member changes, compared by `Object.is`. */
  resetKeys?: readonly unknown[];
  labels?: Partial<AuthErrorBoundaryLabels>;
}

interface AuthErrorBoundaryState {
  error: Error | null;
}

/** `throw "boom"` is legal, so normalize before handing anything on. */
function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  if (typeof thrown === "string") return new Error(thrown);
  return new Error("The view failed to render.");
}

function resetKeysChanged(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined
): boolean {
  if (previous === undefined || next === undefined) return false;
  if (previous.length !== next.length) return true;
  return previous.some((value, index) => !Object.is(value, next[index]));
}

export class AuthErrorBoundary extends React.Component<
  AuthErrorBoundaryProps,
  AuthErrorBoundaryState
> {
  override state: AuthErrorBoundaryState = { error: null };

  static getDerivedStateFromError(thrown: unknown): AuthErrorBoundaryState {
    return { error: toError(thrown) };
  }

  override componentDidCatch(thrown: unknown, info: React.ErrorInfo): void {
    this.props.onError?.(toError(thrown), {
      componentStack: info.componentStack ?? ""
    });
  }

  override componentDidUpdate(previous: AuthErrorBoundaryProps): void {
    if (this.state.error === null) return;
    if (!resetKeysChanged(previous.resetKeys, this.props.resetKeys)) return;
    this.reset();
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.reset });
    }

    const labels = { ...DEFAULT_LABELS, ...this.props.labels };

    // The caught message is deliberately not rendered. That matters more here
    // than in the other plugins: a throw on this surface can carry a username,
    // a token fragment or an API URL, and the login page is the one view an
    // unauthenticated stranger can always reach.
    return (
      <section
        className="not-content fa-auth-panel mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border/70 bg-card/95 p-6 text-card-foreground shadow-sm"
        data-auth-error-boundary="fallback"
      >
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{labels.title}</h1>
        <p role="alert" className="text-sm text-muted-foreground">
          {labels.description}
        </p>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          data-auth-error-boundary-retry=""
          onClick={this.reset}
        >
          {labels.retry}
        </button>
      </section>
    );
  }
}
