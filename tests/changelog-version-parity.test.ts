// Changelog/version parity — A32-changelog-version-parity.
//
// `fa-auth-m8` shipped `2.0.1`/`2.0.2`, `auth-sdk-m8` shipped `3.1.1`/`3.1.2`,
// and `imgtools_m8` shipped `2.1.0` — all tagged and released with no matching
// `CHANGELOG.md` entry. This locks the fix in place for `astro-auth-m8`: the
// current `package.json` version must head a changelog entry, and no two
// entries may claim the same version, so the next release cannot ship
// undocumented.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// astro-auth-m8's CHANGELOG.md headings are bare `## X.Y.Z` (no brackets),
// unlike the bracketed `## [X.Y.Z]` convention used by the fleet's Python
// repos. The `$` anchor keeps this from matching the non-version heading
// `## 1.5.0 and earlier`.
const HEADING_RE = /^## (\d+\.\d+\.\d+)$/gm;

function readChangelogHeadings(): string[] {
  const changelog = readFileSync(resolve(REPO_ROOT, "CHANGELOG.md"), "utf-8");
  return [...changelog.matchAll(HEADING_RE)].map((m) => m[1]);
}

function readPackageVersion(): string {
  const pkg = JSON.parse(
    readFileSync(resolve(REPO_ROOT, "package.json"), "utf-8"),
  ) as { version: string };
  return pkg.version;
}

describe("changelog/version parity (A32)", () => {
  it("CHANGELOG.md exists", () => {
    expect(() =>
      readFileSync(resolve(REPO_ROOT, "CHANGELOG.md"), "utf-8"),
    ).not.toThrow();
  });

  it("the current package.json version heads a CHANGELOG entry", () => {
    const version = readPackageVersion();
    const headings = readChangelogHeadings();
    expect(headings).toContain(version);
  });

  it("no two CHANGELOG entries claim the same version (the imgtools_m8 A32 finding)", () => {
    const headings = readChangelogHeadings();
    const duplicates = headings.filter(
      (v, i) => headings.indexOf(v) !== i,
    );
    expect(duplicates).toEqual([]);
  });
});
