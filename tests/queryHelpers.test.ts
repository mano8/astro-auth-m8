import { describe, expect, it } from "vitest";
import { refetchOrThrow } from "../src/runtime/hooks/queryHelpers.js";

describe("refetchOrThrow", () => {
  it("returns the resolved data when refetch succeeds", async () => {
    await expect(refetchOrThrow(async () => ({ data: "value", error: null }) as never, "fallback")).resolves.toBe("value");
  });

  it("throws the query error when refetch reports one", async () => {
    const error = new Error("refetch failed");
    await expect(refetchOrThrow(async () => ({ data: undefined, error }) as never, "fallback")).rejects.toThrow("refetch failed");
  });

  it("returns the fallback when refetch succeeds without data", async () => {
    await expect(refetchOrThrow(async () => ({ data: undefined, error: null }) as never, "fallback")).resolves.toBe("fallback");
  });
});
