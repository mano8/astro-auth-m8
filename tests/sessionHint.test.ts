// The session hint's storage guards (W3.2).
//
// These run in the default node environment, which has no `localStorage` at
// all - the same shape as a non-DOM consumer importing the API wrappers. The
// guards are load-bearing rather than defensive decoration: the hint is
// written from `login`, `logout` and `refreshToken`, so a throw here would
// take out signing in itself. Each accessor must degrade to "no hint" and
// never propagate.

import { afterEach, describe, expect, it, vi } from "vitest";
import { isSessionKnownAbsent, markSessionAbsent, markSessionPresent } from "../src/runtime/sessionHint.js";

const HINT_KEY = "fa-auth-m8:no-session";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("session hint storage guards", () => {
  it("reports no hint and stays silent when the runtime has no localStorage", () => {
    expect(typeof localStorage).toBe("undefined");
    // "Unknown" must read as *not* known-absent, so the caller still attempts
    // the refresh - the behaviour that predates this hint.
    expect(isSessionKnownAbsent()).toBe(false);
    expect(() => markSessionAbsent()).not.toThrow();
    expect(() => markSessionPresent()).not.toThrow();
  });

  it("round-trips through a working store", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (k: string, v: string) => store.set(k, v),
      getItem: (k: string) => store.get(k) ?? null,
      removeItem: (k: string) => store.delete(k)
    });

    expect(isSessionKnownAbsent()).toBe(false);
    markSessionAbsent();
    expect(store.get(HINT_KEY)).toBe("1");
    expect(isSessionKnownAbsent()).toBe(true);
    markSessionPresent();
    expect(store.has(HINT_KEY)).toBe(false);
    expect(isSessionKnownAbsent()).toBe(false);
  });

  it("swallows a store that refuses every access", () => {
    // Storage disabled in an embedded frame: the property exists but throws
    // on use. Losing the optimisation is acceptable; losing the sign-in is
    // not, so nothing here may propagate.
    const refuse = () => {
      throw new Error("storage is disabled");
    };
    vi.stubGlobal("localStorage", { getItem: refuse, setItem: refuse, removeItem: refuse });

    expect(isSessionKnownAbsent()).toBe(false);
    expect(() => markSessionAbsent()).not.toThrow();
    expect(() => markSessionPresent()).not.toThrow();
  });
});
