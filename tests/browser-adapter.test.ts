import { afterEach, describe, expect, it, vi } from "vitest";

const authApi = vi.hoisted(() => ({ refreshToken: vi.fn() }));
const profileApi = vi.hoisted(() => ({ getProfile: vi.fn() }));
const config = vi.hoisted(() => ({ configureAuth: vi.fn() }));
const tokenStore = vi.hoisted(() => ({ getToken: vi.fn() }));
const opsApi = vi.hoisted(() => ({ getServiceMeta: vi.fn() }));

vi.mock("../src/runtime/api/auth.js", () => authApi);
vi.mock("../src/runtime/api/profile.js", () => profileApi);
vi.mock("../src/runtime/config.js", () => config);
vi.mock("../src/runtime/tokenStore.js", () => tokenStore);
vi.mock("../src/runtime/api/ops.js", () => opsApi);

import { installFaAuthBrowserAdapter } from "../src/runtime/browserAdapter.js";

// compatible per the current fa-auth-m8@2.0 contract.
const COMPATIBLE_META = { contract: { version: "2.0" }, version: "2.0.0" };

async function flushPreflight() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  delete (globalThis as { __M8_FA_AUTH_ADAPTER__?: unknown }).__M8_FA_AUTH_ADAPTER__;
  vi.resetAllMocks();
});

describe("installFaAuthBrowserAdapter", () => {
  it("owns auth configuration and exposes only the adapter contract", async () => {
    tokenStore.getToken.mockReturnValue("access-token");
    authApi.refreshToken.mockResolvedValue({ access_token: "fresh-token" });
    profileApi.getProfile.mockResolvedValue({ id: "user-1", role: "admin", is_superuser: false });
    opsApi.getServiceMeta.mockResolvedValue(COMPATIBLE_META);

    const adapter = installFaAuthBrowserAdapter({ apiBase: "https://auth.example.test/user" });

    expect(config.configureAuth).toHaveBeenCalledWith({ apiBase: "https://auth.example.test/user" });
    expect(adapter.getAccessToken()).toBe("access-token");
    await expect(adapter.refresh()).resolves.toBe("fresh-token");
    await expect(adapter.getCurrentUser()).resolves.toEqual({
      id: "user-1",
      role: "admin",
      is_superuser: false
    });
    expect((globalThis as { __M8_FA_AUTH_ADAPTER__?: unknown }).__M8_FA_AUTH_ADAPTER__).toBe(adapter);
  });

  // T11 (AA-16/AA-22): a compatibility preflight runs at install time — warn,
  // never throw, and never block adapter setup on the network round trip.
  describe("compatibility preflight (T11)", () => {
    it("does not warn when the backend reports a compatible contract", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      opsApi.getServiceMeta.mockResolvedValue(COMPATIBLE_META);

      installFaAuthBrowserAdapter({ apiBase: "https://auth.example.test/user" });
      await flushPreflight();

      expect(opsApi.getServiceMeta).toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it("warns once, without throwing or blocking adapter install, on an incompatible contract", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      opsApi.getServiceMeta.mockResolvedValue({ contract: { version: "9.9" }, version: "9.9.9" });

      const adapter = installFaAuthBrowserAdapter({ apiBase: "https://auth.example.test/user" });
      expect(adapter).toBeDefined();
      await flushPreflight();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("fa-auth-m8@2.0");
    });

    it("warns at most once for an unrecognized (unknown) /meta payload, even across repeated installs", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      opsApi.getServiceMeta.mockResolvedValue({});

      installFaAuthBrowserAdapter({ apiBase: "https://auth.example.test/user" });
      await flushPreflight();
      installFaAuthBrowserAdapter({ apiBase: "https://auth.example.test/user" });
      await flushPreflight();

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it("swallows a /meta fetch failure silently and still installs the adapter", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      opsApi.getServiceMeta.mockRejectedValue(new Error("network down"));
      tokenStore.getToken.mockReturnValue(null);

      const adapter = installFaAuthBrowserAdapter({ apiBase: "https://auth.example.test/user" });
      await flushPreflight();

      expect(adapter).toBeDefined();
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
