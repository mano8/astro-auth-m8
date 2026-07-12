import { describe, expect, it } from "vitest";
import {
  assertFaAuthM8Compatibility,
  FA_AUTH_M8_CONTRACT,
  FA_AUTH_M8_CONTRACT_VERSION,
  FA_AUTH_M8_SERVICE_VERSION_RANGE,
  FA_AUTH_M8_TESTED_SERVICE_VERSION,
  getFaAuthM8Compatibility,
  isFaAuthM8ServiceVersionCompatible
} from "../src/runtime/compatibility.js";

describe("fa-auth-m8 compatibility contract", () => {
  it("exports the tested contract metadata", () => {
    expect(FA_AUTH_M8_CONTRACT).toBe("fa-auth-m8@1.0");
    expect(FA_AUTH_M8_CONTRACT_VERSION).toBe("1.0");
    expect(FA_AUTH_M8_TESTED_SERVICE_VERSION).toBe("1.1.0");
    expect(FA_AUTH_M8_SERVICE_VERSION_RANGE).toBe(">=1.0.0 <2.0.0");
  });

  it("checks service version ranges", () => {
    expect(isFaAuthM8ServiceVersionCompatible("1.0.0")).toBe(true);
    expect(isFaAuthM8ServiceVersionCompatible("1.0.1+build.1")).toBe(true);
    expect(isFaAuthM8ServiceVersionCompatible("1.1.0")).toBe(true);
    expect(isFaAuthM8ServiceVersionCompatible("1.9.9")).toBe(true);
    expect(isFaAuthM8ServiceVersionCompatible("0.9.9")).toBe(false);
    expect(isFaAuthM8ServiceVersionCompatible("2.0.0")).toBe(false);
    expect(isFaAuthM8ServiceVersionCompatible("not-semver")).toBe(false);
  });

  it("accepts matching contract or service metadata", () => {
    expect(getFaAuthM8Compatibility({ auth_contract_version: "1.0" })).toMatchObject({ status: "compatible", contractVersion: "1.0" });
    expect(getFaAuthM8Compatibility({ contract_version: "fa-auth-m8@1.0" })).toMatchObject({ status: "compatible", contractVersion: "fa-auth-m8@1.0" });
    expect(getFaAuthM8Compatibility({ fa_auth_m8_version: "1.0.0" })).toMatchObject({ status: "compatible", serviceVersion: "1.0.0" });
    expect(getFaAuthM8Compatibility({ service_version: "1.0.1" })).toMatchObject({ status: "compatible", serviceVersion: "1.0.1" });
    expect(getFaAuthM8Compatibility({ version: "1.0.0" })).toMatchObject({ status: "compatible", serviceVersion: "1.0.0" });
  });

  it("reads the GET /meta payload shape (nested contract + version)", () => {
    const meta = {
      service: "fa-auth-m8",
      version: "1.0.0",
      api_version: "v1",
      contract: { name: "fa-auth-m8", version: "1.0", range: ">=1.0.0 <1.1.0" }
    };
    expect(getFaAuthM8Compatibility(meta)).toMatchObject({
      status: "compatible",
      contractVersion: "1.0",
      serviceVersion: "1.0.0"
    });
    // A nested contract whose version mismatches is rejected.
    expect(
      getFaAuthM8Compatibility({ version: "1.0.0", contract: { version: "1.1" } })
    ).toMatchObject({ status: "incompatible", contractVersion: "1.1" });
  });

  it("rejects mismatched contract and service metadata", () => {
    expect(getFaAuthM8Compatibility({ auth_contract: "0.8" })).toMatchObject({ status: "incompatible", contractVersion: "0.8" });
    expect(getFaAuthM8Compatibility({ contract: "fa-auth-m8@1.1" })).toMatchObject({ status: "incompatible", contractVersion: "fa-auth-m8@1.1" });
    expect(getFaAuthM8Compatibility({ fa_auth_m8_contract: "1.1" })).toMatchObject({ status: "incompatible", contractVersion: "1.1" });
    expect(getFaAuthM8Compatibility({ service_version: "2.0.0" })).toMatchObject({ status: "incompatible", serviceVersion: "2.0.0" });
  });

  it("reports unknown metadata and asserts based on policy", () => {
    expect(getFaAuthM8Compatibility({})).toMatchObject({ status: "unknown" });
    expect(() => assertFaAuthM8Compatibility({})).toThrow("No fa-auth-m8 contract or service version metadata was provided");
    expect(assertFaAuthM8Compatibility({}, false)).toMatchObject({ status: "unknown" });
    expect(assertFaAuthM8Compatibility({ service_version: "1.0.0" })).toMatchObject({ status: "compatible" });
    expect(assertFaAuthM8Compatibility({ service_version: "1.1.0" })).toMatchObject({ status: "compatible" });
    expect(() => assertFaAuthM8Compatibility({ service_version: "2.0.0" })).toThrow("Expected fa-auth-m8 service version");
    expect(() => assertFaAuthM8Compatibility({ auth_contract_version: "0.8" })).toThrow("Expected fa-auth-m8@1.0");
  });
});
