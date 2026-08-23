// Headless standalone smoke for the published tarball (`C12`).
//
// This file is compiled *and executed* against an installed
// `@mano8/astro-auth-m8`, in a throwaway directory that has no workspace
// checkout above it — which is the point: `STANDALONE-CHILD-USABILITY` says the
// child must work with nothing but its own tarball. It touches only the
// headless subpaths, so it needs no React, no Astro and no running service.
import {
  assertFaAuthM8Compatibility,
  getFaAuthM8Compatibility,
  FA_AUTH_M8_CONTRACT,
  FA_AUTH_M8_SERVICE_VERSION_RANGE
} from "@mano8/astro-auth-m8/compatibility";
import {
  RoleTypeSchema,
  UserPublicSchema,
  UpdatePasswordSchema
} from "@mano8/astro-auth-m8/schemas";
import {
  ORDERED_ROLES,
  hasMinimumRole,
  hasSuperuserPrivileges,
  privilegeClaimsAreConsistent
} from "@mano8/astro-auth-m8/authorization";
import { authUrl, configureAuth, getAuthConfig } from "@mano8/astro-auth-m8/client";
import { buildAuthRoutes } from "@mano8/astro-auth-m8/routes";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[tarball-consumer] ${message}`);
}

// The contract the package declares must match what package.json publishes, or
// a consumer's compatibility check is asserting against a stale constant.
assert(
  FA_AUTH_M8_CONTRACT === "fa-auth-m8@2.0",
  `unexpected contract: ${FA_AUTH_M8_CONTRACT}`
);
assert(
  FA_AUTH_M8_SERVICE_VERSION_RANGE === ">=2.0.0 <3.0.0",
  `unexpected service range: ${FA_AUTH_M8_SERVICE_VERSION_RANGE}`
);

// A service inside the supported range is blessed; one outside it is named
// rather than tolerated.
assert(
  assertFaAuthM8Compatibility({ version: "2.0.0" }).status === "compatible",
  "a service inside the supported range was not judged compatible"
);
assert(
  getFaAuthM8Compatibility({ version: "3.0.0" }).status === "incompatible",
  "a service past the supported major was not rejected"
);

// The role vocabulary and the ordered floor survive the build. This is the
// comparison `D-C2`'s admin floor is read through, so it has to be right in the
// installed package and not only in the repository.
assert(ORDERED_ROLES.length > 0, "the ordered role vocabulary is empty");
assert(RoleTypeSchema.safeParse("admin").success, "`admin` is not in the role vocabulary");
assert(hasMinimumRole("admin", "admin"), "an admin does not meet the admin floor");
assert(!hasMinimumRole("user", "admin"), "a user meets the admin floor");

// Superuser needs dual evidence; a role claim alone is not enough.
assert(
  !hasSuperuserPrivileges("admin", false),
  "an admin without the superuser flag was granted superuser privileges"
);
assert(
  !privilegeClaimsAreConsistent("user", true),
  "a user carrying the superuser flag was treated as consistent"
);

// Public response models only: a secret field must not survive a parse.
const parsed = UserPublicSchema.parse({
  id: "00000000-0000-0000-0000-000000000000",
  email: "someone@example.com",
  is_active: true,
  is_superuser: false,
  role: "user"
});
assert(!("hashed_password" in parsed), "the public user model exposes a secret field");
assert(
  !UpdatePasswordSchema.safeParse({ current_password: "x" }).success,
  "a password update without the new password was accepted"
);

// The seam: an untouched install must address the paths fa-auth-m8 mounts.
// `authUrl` resolves to an absolute URL, so the base is checked on the path.
const accessTokenUrl = authUrl("/login/access-token");
assert(
  new URL(accessTokenUrl).pathname === `${getAuthConfig().apiBase}/login/access-token`,
  `default install does not address the auth API base: ${accessTokenUrl}`
);

// The starter route map is buildable from the installed package and does not
// collide with itself.
const routes = buildAuthRoutes();
const patterns = Object.values(routes).filter(
  (pattern): pattern is string => typeof pattern === "string"
);
assert(patterns.length > 0, "the installed route builder produced no routes");
assert(
  new Set(patterns).size === patterns.length,
  `the default route map collides with itself: ${patterns.join(", ")}`
);

console.log("[tarball-consumer] installed package passed the headless smoke");
