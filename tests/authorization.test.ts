import { describe, expect, it } from "vitest";
import {
  hasMinimumRole,
  hasSuperuserPrivileges,
  ORDERED_ROLES,
  privilegeClaimsAreConsistent
} from "../src/runtime/authorization.js";
import type { RoleType } from "../src/runtime/schemas.js";

// A role a newer backend could send that this build does not recognise. Typed
// call sites cannot produce it; the wire and JavaScript consumers can.
const UNKNOWN_ROLE = "root" as unknown as RoleType;

// The canonical truth table: one row per valid role/flag state. `superuser`
// records whether the row grants superuser authority.
const TRUTH_TABLE: ReadonlyArray<{ role: RoleType; is_superuser: boolean; superuser: boolean }> = [
  { role: "user", is_superuser: false, superuser: false },
  { role: "reader", is_superuser: false, superuser: false },
  { role: "writer", is_superuser: false, superuser: false },
  { role: "admin", is_superuser: false, superuser: false },
  { role: "superadmin", is_superuser: true, superuser: true }
];

describe("canonical role hierarchy", () => {
  it("orders roles from highest to lowest privilege", () => {
    // Locks the order in: reordering RoleTypeSchema would otherwise silently
    // invert every hierarchy decision in the package.
    expect(ORDERED_ROLES).toEqual(["superadmin", "admin", "writer", "reader", "user"]);
  });

  it("admits a role that meets or exceeds the requirement", () => {
    for (const [index, currentRole] of ORDERED_ROLES.entries()) {
      for (const requiredRole of ORDERED_ROLES.slice(index)) {
        expect(hasMinimumRole(currentRole, requiredRole)).toBe(true);
      }
    }
  });

  it("denies a role below the requirement", () => {
    for (const [index, currentRole] of ORDERED_ROLES.entries()) {
      for (const requiredRole of ORDERED_ROLES.slice(0, index)) {
        expect(hasMinimumRole(currentRole, requiredRole)).toBe(false);
      }
    }
  });

  it("is reflexive and antisymmetric across every ordered pair", () => {
    for (const [leftIndex, left] of ORDERED_ROLES.entries()) {
      for (const [rightIndex, right] of ORDERED_ROLES.entries()) {
        // Both directions hold only for the same role; otherwise exactly one
        // direction holds, so the hierarchy is a strict order, not membership.
        const forward = hasMinimumRole(left, right);
        const backward = hasMinimumRole(right, left);
        expect(forward && backward).toBe(leftIndex === rightIndex);
        expect(forward || backward).toBe(true);
      }
    }
  });

  it("admits a superadmin for an admin requirement", () => {
    // AA-05 regression: exact membership hid admin surfaces from a superadmin.
    expect(hasMinimumRole("superadmin", "admin")).toBe(true);
    expect(hasMinimumRole("admin", "superadmin")).toBe(false);
  });

  it("denies an unrecognised role in either position", () => {
    for (const role of ORDERED_ROLES) {
      expect(hasMinimumRole(UNKNOWN_ROLE, role)).toBe(false);
      expect(hasMinimumRole(role, UNKNOWN_ROLE)).toBe(false);
    }
    expect(hasMinimumRole(UNKNOWN_ROLE, UNKNOWN_ROLE)).toBe(false);
  });
});

describe("privilege claim consistency", () => {
  it("accepts every row of the canonical truth table", () => {
    for (const row of TRUTH_TABLE) {
      expect(privilegeClaimsAreConsistent(row.role, row.is_superuser)).toBe(true);
    }
  });

  it("rejects every row with its flag inverted", () => {
    for (const row of TRUTH_TABLE) {
      expect(privilegeClaimsAreConsistent(row.role, !row.is_superuser)).toBe(false);
    }
  });

  it("rejects an unrecognised role with either flag", () => {
    expect(privilegeClaimsAreConsistent(UNKNOWN_ROLE, true)).toBe(false);
    expect(privilegeClaimsAreConsistent(UNKNOWN_ROLE, false)).toBe(false);
  });
});

describe("dual-evidence superuser predicate", () => {
  it("grants only for the canonical superadmin row", () => {
    for (const row of TRUTH_TABLE) {
      expect(hasSuperuserPrivileges(row.role, row.is_superuser)).toBe(row.superuser);
    }
  });

  it("denies every inconsistent pair", () => {
    for (const row of TRUTH_TABLE) {
      expect(hasSuperuserPrivileges(row.role, !row.is_superuser)).toBe(false);
    }
  });

  it("denies a stray is_superuser on a non-superadmin role", () => {
    // AA-04 regression: the flag alone never grants, in either direction.
    expect(hasSuperuserPrivileges("admin", true)).toBe(false);
    expect(hasSuperuserPrivileges("user", true)).toBe(false);
    expect(hasSuperuserPrivileges("superadmin", false)).toBe(false);
  });

  it("denies an unrecognised role with either flag", () => {
    expect(hasSuperuserPrivileges(UNKNOWN_ROLE, true)).toBe(false);
    expect(hasSuperuserPrivileges(UNKNOWN_ROLE, false)).toBe(false);
  });
});
