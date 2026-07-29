import { afterEach, describe, expect, it, vi } from "vitest";

const authApi = vi.hoisted(() => ({ refreshToken: vi.fn() }));
const profileApi = vi.hoisted(() => ({ getProfile: vi.fn() }));
const config = vi.hoisted(() => ({ configureAuth: vi.fn() }));
const tokenStore = vi.hoisted(() => ({ getToken: vi.fn() }));

vi.mock("../src/runtime/api/auth.js", () => authApi);
vi.mock("../src/runtime/api/profile.js", () => profileApi);
vi.mock("../src/runtime/config.js", () => config);
vi.mock("../src/runtime/tokenStore.js", () => tokenStore);

import { installFaAuthBrowserAdapter } from "../src/runtime/browserAdapter.js";

afterEach(() => {
  delete (globalThis as { __M8_FA_AUTH_ADAPTER__?: unknown }).__M8_FA_AUTH_ADAPTER__;
  vi.resetAllMocks();
});

describe("installFaAuthBrowserAdapter", () => {
  it("owns auth configuration and exposes only the adapter contract", async () => {
    tokenStore.getToken.mockReturnValue("access-token");
    authApi.refreshToken.mockResolvedValue({ access_token: "fresh-token" });
    profileApi.getProfile.mockResolvedValue({ id: "user-1", role: "admin", is_superuser: false });

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
});
