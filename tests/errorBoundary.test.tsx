// @vitest-environment jsdom
//
// `A-C3`: the island-root error boundary.
//
// The `island-error-boundary` gate in `scripts/verify-fleet-gates.mjs` proves
// every island root is *wrapped*; these tests prove the wrapper does something —
// that a render throw is caught rather than propagated, that the caught message
// never reaches the DOM, and that both recovery paths work.
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `StarterLogoutPage` mounts `AuthProvider`, which bootstraps a session on
// mount. Stubbed so this suite stays about the boundary rather than the network.
const authApi = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(() => Promise.reject(new Error("no session")))
}));
const profileApi = vi.hoisted(() => ({
  deleteProfile: vi.fn(),
  getProfile: vi.fn(() => Promise.resolve(null)),
  updatePassword: vi.fn(),
  updateProfile: vi.fn()
}));
vi.mock("../src/runtime/api/auth.js", () => authApi);
vi.mock("../src/runtime/api/profile.js", () => profileApi);

import { AuthErrorBoundary } from "../src/runtime/react/AuthErrorBoundary.js";
import { SignupView } from "../src/runtime/react/default-ui/SignupView.js";
import { StarterLogoutPage } from "../src/runtime/react/default-ui/StarterLogoutPage.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React logs every caught render throw regardless of what the boundary does.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const mounted: Array<() => void> = [];

afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.();
  consoleError.mockRestore();
});

function render(element: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<>{element}</>);
  });
  mounted.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

function click(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text)
  );
  if (!button) throw new Error(`No button matching ${text}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function Boom({ throws, message = "render exploded" }: { throws: boolean; message?: string }) {
  if (throws) throw new Error(message);
  return <p>healthy child</p>;
}

describe("AuthErrorBoundary", () => {
  it("renders children while nothing throws", () => {
    const container = render(
      <AuthErrorBoundary>
        <Boom throws={false} />
      </AuthErrorBoundary>
    );

    expect(container.textContent).toContain("healthy child");
    expect(container.querySelector("[data-auth-error-boundary]")).toBeNull();
  });

  it("catches a render throw and renders the plugin error surface", () => {
    const container = render(
      <AuthErrorBoundary>
        <Boom throws />
      </AuthErrorBoundary>
    );

    expect(container.querySelector('[data-auth-error-boundary="fallback"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain("This view stopped responding");
    expect(container.textContent).not.toContain("healthy child");
  });

  it("never renders the caught message, which on this surface can carry credentials", () => {
    const container = render(
      <AuthErrorBoundary>
        <Boom throws message="login failed for admin@example.com token=super-secret-value" />
      </AuthErrorBoundary>
    );

    expect(container.textContent).not.toContain("super-secret-value");
    expect(container.textContent).not.toContain("admin@example.com");
  });

  it("reports through onError and normalizes a non-Error throw", () => {
    const onError = vi.fn();

    function ThrowString(): React.ReactNode {
      throw "thrown as a string";
    }
    function ThrowObject(): React.ReactNode {
      throw { code: 401 };
    }

    render(
      <AuthErrorBoundary onError={onError}>
        <ThrowString />
      </AuthErrorBoundary>
    );
    render(
      <AuthErrorBoundary onError={onError}>
        <ThrowObject />
      </AuthErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(2);
    const [stringError, stringInfo] = onError.mock.calls[0] as [
      Error,
      { componentStack: string }
    ];
    const [objectError] = onError.mock.calls[1] as [Error];
    expect(stringError).toBeInstanceOf(Error);
    expect(stringError.message).toBe("thrown as a string");
    expect(typeof stringInfo.componentStack).toBe("string");
    expect(objectError.message).toBe("The view failed to render.");
  });

  it("accepts host label overrides and keeps unspecified defaults", () => {
    const container = render(
      <AuthErrorBoundary labels={{ title: "Acceso no disponible", retry: "Reintentar" }}>
        <Boom throws />
      </AuthErrorBoundary>
    );

    expect(container.textContent).toContain("Acceso no disponible");
    expect(container.textContent).toContain("Reintentar");
    expect(container.textContent).toContain(
      "The page hit an unexpected error and could not finish rendering."
    );
  });

  it("renders a custom fallback with the error and a working reset", () => {
    function Harness() {
      const [throws, setThrows] = React.useState(true);
      return (
        <AuthErrorBoundary
          fallback={({ error, reset }) => (
            <button
              type="button"
              onClick={() => {
                setThrows(false);
                reset();
              }}
            >
              custom: {error.message}
            </button>
          )}
        >
          <Boom throws={throws} message="custom path" />
        </AuthErrorBoundary>
      );
    }

    const container = render(<Harness />);
    expect(container.textContent).toContain("custom: custom path");

    click(container, "custom: custom path");
    expect(container.textContent).toContain("healthy child");
  });

  it("recovers through the default retry button", () => {
    function Harness() {
      const [throws, setThrows] = React.useState(true);
      return (
        <>
          <button type="button" onClick={() => setThrows(false)}>
            fix the child
          </button>
          <AuthErrorBoundary>
            <Boom throws={throws} />
          </AuthErrorBoundary>
        </>
      );
    }

    const container = render(<Harness />);
    click(container, "fix the child");
    click(container, "Reload this view");
    expect(container.textContent).toContain("healthy child");
  });

  it("clears on a resetKeys change and holds while the keys are equal", () => {
    function Harness() {
      const [step, setStep] = React.useState("login");
      return (
        <>
          <button type="button" onClick={() => setStep("account")}>
            next step
          </button>
          <button type="button" onClick={() => setStep("login")}>
            same step
          </button>
          <AuthErrorBoundary resetKeys={[step]}>
            <Boom throws={step === "login"} />
          </AuthErrorBoundary>
        </>
      );
    }

    const container = render(<Harness />);
    expect(container.textContent).toContain("This view stopped responding");

    click(container, "same step");
    expect(container.textContent).toContain("This view stopped responding");

    click(container, "next step");
    expect(container.textContent).toContain("healthy child");
  });

  it("treats a changed resetKeys length as a change", () => {
    function Harness() {
      const [keys, setKeys] = React.useState<string[]>(["a"]);
      const [throws, setThrows] = React.useState(true);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setThrows(false);
              setKeys(["a", "b"]);
            }}
          >
            grow keys
          </button>
          <AuthErrorBoundary resetKeys={keys}>
            <Boom throws={throws} />
          </AuthErrorBoundary>
        </>
      );
    }

    const container = render(<Harness />);
    expect(container.textContent).toContain("This view stopped responding");

    click(container, "grow keys");
    expect(container.textContent).toContain("healthy child");
  });

  it("tolerates a null componentStack from React", () => {
    // React types `componentStack` as nullable and the boundary defaults it to
    // "". Driving `componentDidCatch` directly is the only way to reach that
    // default: React itself always supplies a string.
    const onError = vi.fn();
    const boundary = new AuthErrorBoundary({ children: null, onError });

    boundary.componentDidCatch(new Error("direct"), { componentStack: null });

    expect(onError).toHaveBeenCalledWith(expect.any(Error), { componentStack: "" });
  });

  it("holds the fallback across a re-render when no resetKeys are given", () => {
    function Harness() {
      const [tick, setTick] = React.useState(0);
      return (
        <>
          <button type="button" onClick={() => setTick(tick + 1)}>
            re-render
          </button>
          <AuthErrorBoundary>
            <Boom throws />
          </AuthErrorBoundary>
        </>
      );
    }

    const container = render(<Harness />);
    click(container, "re-render");
    expect(container.textContent).toContain("This view stopped responding");
  });
});

describe("island roots", () => {
  it("still renders a wrapped view normally", () => {
    // `SignupView` is what `signup.astro` mounts with `client:load`, and it is
    // now wrapped in place rather than at the route. The wrapper must be
    // invisible when nothing throws.
    const container = render(<SignupView />);

    expect(container.querySelector('[data-auth-error-boundary="fallback"]')).toBeNull();
    expect(container.textContent).toContain("Signup unavailable");
  });

  it("passes the logout route's slot content through the boundary and provider", () => {
    // `logout.astro` authors its sign-out form as markup and hands it to this
    // component as children, so the pass-through is the contract under test.
    const container = render(
      <StarterLogoutPage config={{ apiBase: "https://auth.example.test" }}>
        <p>sign out form</p>
      </StarterLogoutPage>
    );

    expect(container.textContent).toContain("sign out form");
    expect(container.querySelector('[data-auth-error-boundary="fallback"]')).toBeNull();
  });

  it("catches a throw raised inside the logout island", () => {
    const container = render(
      <StarterLogoutPage config={{ apiBase: "https://auth.example.test" }}>
        <Boom throws />
      </StarterLogoutPage>
    );

    expect(container.querySelector('[data-auth-error-boundary="fallback"]')).not.toBeNull();
  });
});
