import { describe, expect, it } from "vitest";
import { ApiError, describeApiError, messageFromDetail, normalizeFastApiError } from "../src/runtime/errors.js";

describe("describeApiError", () => {
  it("labels a 403 self-promotion error and passes through the backend's readable detail", () => {
    const error = new ApiError(403, "A user may not raise their own role");
    const result = describeApiError(error, "Update failed");

    expect(result.title).toBe("Not permitted");
    expect(result.description).toBe("A user may not raise their own role");
  });

  it("falls back to the caller's fallback for a 403 with a non-string detail", () => {
    const error = new ApiError(403, { code: "opaque" }, "Forbidden");
    const result = describeApiError(error, "Update failed");

    expect(result.title).toBe("Not permitted");
    expect(result.description).toBe("Update failed");
  });

  it("does not label a non-role 403 as a role change", () => {
    // A purge or audit-log read refused because the principal was demoted since
    // the page loaded is still a 403, and must not be titled as a role change.
    const error = new ApiError(403, "Not enough permissions");
    const result = describeApiError(error, "Purge failed");

    expect(result.title).toBe("Not permitted");
    expect(result.title).not.toContain("Role change");
    expect(result.description).toBe("Not enough permissions");
  });

  it("never surfaces the raw last_superuser_required token to the operator", () => {
    const error = new ApiError(409, "last_superuser_required");
    const result = describeApiError(error, "Update failed");

    expect(result.title).toBe("Last superuser required");
    expect(result.title).not.toContain("last_superuser_required");
    expect(result.description).not.toContain("last_superuser_required");
    expect(result.description).toBe(
      "This is the only remaining superuser account, so it can't be changed or removed."
    );
  });

  it("does not special-case a 409 for an unrelated conflict detail", () => {
    const error = new ApiError(409, "User with this email already exists");
    const result = describeApiError(error, "Update failed");

    expect(result.title).toBe("User with this email already exists");
    expect(result.description).toBeUndefined();
  });

  it("maps 429 to a retry-later message that does not imply auto-retry", () => {
    const error = new ApiError(429, "Too many requests. Try again later.");
    const result = describeApiError(error, "Action failed");

    expect(result.title).toBe("Too many requests");
    expect(result.description).toMatch(/try again later/i);
  });

  it("maps 503 to an unknown-outcome message distinct from a plain failure", () => {
    const error = new ApiError(503, "Rate limiting service temporarily unavailable");
    const result = describeApiError(error, "Action failed");

    expect(result.title).toBe("Temporarily unavailable");
    expect(result.description).toMatch(/outcome.*unknown/i);
  });

  it("surfaces a 400's free-text detail verbatim under a labelled heading", () => {
    const freeText = "Retention window must be at least 3m for this account tier";
    const error = new ApiError(400, freeText);
    const result = describeApiError(error, "Purge failed");

    expect(result.title).toBe("Rejected");
    expect(result.description).toBe(freeText);
  });

  it("falls back to the fallback for a 400 with no string detail", () => {
    const error = new ApiError(400, null, "Bad request");
    const result = describeApiError(error, "Purge failed");

    expect(result.title).toBe("Bad request");
    expect(result.description).toBeUndefined();
  });

  it("falls back to a plain Error's message for an unmapped status", () => {
    const error = new ApiError(500, "boom");
    const result = describeApiError(error, "Action failed");

    expect(result.title).toBe("boom");
    expect(result.description).toBeUndefined();
  });

  it("falls back to a non-ApiError Error's message", () => {
    const result = describeApiError(new Error("network down"), "Action failed");

    expect(result.title).toBe("network down");
    expect(result.description).toBeUndefined();
  });

  it("falls back to the caller's fallback for a non-Error value", () => {
    const result = describeApiError("not an error", "Action failed");

    expect(result.title).toBe("Action failed");
    expect(result.description).toBeUndefined();
  });

  it("falls back to the caller's fallback for an Error with an empty message", () => {
    const result = describeApiError(new Error(""), "Action failed");

    expect(result.title).toBe("Action failed");
    expect(result.description).toBeUndefined();
  });
});

describe("messageFromDetail / normalizeFastApiError (pre-existing, exercised for regression safety)", () => {
  it("still joins validation array details", () => {
    expect(messageFromDetail([{ msg: "field required" }])).toBe("field required");
  });

  it("still unwraps a FastAPI error body", () => {
    expect(normalizeFastApiError({ detail: "nope" })).toBe("nope");
  });
});
