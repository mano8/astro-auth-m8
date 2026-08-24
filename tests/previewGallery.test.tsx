// @vitest-environment jsdom
//
// `A-C2`: the dev-only `/_preview` gallery.
//
// `npm run preview:build` proves the gallery *compiles*. That is exactly the
// kind of green light this plan keeps finding pointed at the wrong thing — the
// shared package's own gallery compiled for months while every `table-page`
// sibling import was unresolved, because nothing ever ran it. So this suite
// mounts the gallery and asserts it renders: the views, hooks, api wrappers and
// Zod schemas are the shipped ones, and only `fetch` is replaced.
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getStubSession,
  installServiceStub,
  setStubSession
} from "../fixtures/preview/src/service-stub.js";
import { PreviewApp } from "../fixtures/preview/src/preview-app.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let restoreFetch: typeof globalThis.fetch;
const mounted: Array<() => void> = [];

beforeEach(() => {
  restoreFetch = installServiceStub();
  setStubSession("user");
});

afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.();
  globalThis.fetch = restoreFetch;
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

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
  throw lastError;
}

describe("preview gallery", () => {
  it("mounts the login island against the stub service", () => {
    const container = render(<PreviewApp />);

    expect(container.textContent).toContain("astro-auth-m8 /_preview");
    // The login island renders its form rather than the boundary fallback.
    expect(container.querySelector('[data-auth-error-boundary="fallback"]')).toBeNull();
    expect(container.querySelector("form, input")).not.toBeNull();
  });

  it("renders the account island for the stubbed signed-in profile", async () => {
    const container = render(<PreviewApp />);

    click(container, "Account");

    await waitFor(() => {
      // The email only appears if the whole path worked: the view mounted, the
      // provider bootstrapped, the api wrapper built a request, the stub
      // answered it, and the Zod schema accepted the answer.
      expect(container.textContent).toContain("reader@example.test");
    });
  });

  it("remounts the island when the stubbed session changes", async () => {
    const container = render(<PreviewApp />);

    click(container, "Account");
    await waitFor(() => expect(container.textContent).toContain("reader@example.test"));

    click(container, "superuser");
    await waitFor(() => expect(container.textContent).toContain("admin@example.test"));
  });

  it("catches a throw in the boundary panel rather than blanking the gallery", async () => {
    const container = render(<PreviewApp />);

    click(container, "Error boundary");
    click(container, "Break the probe");

    await waitFor(() => {
      expect(container.querySelector('[data-auth-error-boundary="fallback"]')).not.toBeNull();
    });
    // The gallery shell itself survives, which is the property the boundary
    // exists to give an island's host page.
    expect(container.textContent).toContain("astro-auth-m8 /_preview");
  });
});

describe("gallery service stub", () => {
  it("reports the selected session and fails the refresh when anonymous", async () => {
    setStubSession("anonymous");
    expect(getStubSession()).toBe("anonymous");

    const refresh = await fetch("/auth-api/login/refresh-token/", { method: "POST" });
    expect(refresh.status).toBe(401);

    setStubSession("superuser");
    const profile = await fetch("/auth-api/profile/get/me/");
    const body = (await profile.json()) as { email: string; is_superuser: boolean };
    expect(body.email).toBe("admin@example.test");
    expect(body.is_superuser).toBe(true);
  });

  it("404s an unstubbed path instead of hanging", async () => {
    const response = await fetch("/auth-api/not-a-real-route");
    expect(response.status).toBe(404);
  });
});
