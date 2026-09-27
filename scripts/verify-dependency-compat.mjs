#!/usr/bin/env node
// Dependency compatibility gate: every installed package must satisfy every
// range declared on it.
//
// `.npmrc` sets `legacy-peer-deps=true` in each of the fleet's npm packages, so
// neither `npm install` nor Dependabot ever refuses to resolve on a peer
// conflict. An update that breaks a peer range must arrive as a pull request
// whose CI goes red. It must not be dropped silently by Dependabot's resolver,
// and it must not stop a lock regeneration. The price of that setting is that
// npm stops checking peer ranges when it installs. That is how `fa-ui-m8`
// carried a `lucide-react` outside `@mano8/astro-ui-m8`'s peer range, and how
// its CI passed Dependabot pull requests for `@astrojs/react` 7 and for an
// `@typescript-eslint/eslint-plugin` its parser did not match. This script puts
// the check back after `npm ci`.
//
// It reads `npm ls --all --json --long` (peer edges forced on with
// `--legacy-peer-deps=false`). It exits non-zero and names the requirer, the
// edge type, the declared range and the installed version for:
//
//   * an installed package outside a range declared on it (`invalid`) by a
//     dependency, optional dependency, dev dependency or peer. Optional peers
//     count too, because an optional peer that is present gets used;
//   * a required dependency or peer that is not installed (`missing`), unless
//     its requirer is itself installed only as an optional dependency (the
//     per-platform native binaries, which npm may legitimately skip);
//   * any other problem `npm ls` reports (for example `extraneous`);
//   * a waiver that no longer matches anything, or a waiver file that is not
//     well formed.
//
// A waiver in `dependency-compat.waivers.json` (beside `package.json`,
// optional) excuses one third-party *optional peer* edge, with a written
// reason. It can never excuse a required edge, nor an edge declared by this
// package or by an `@mano8/*` package: those ranges are ours to fix.
//
// Dependency-free. Byte-identical in astro-auth-m8, astro-media-m8,
// astro-prompt-m8, astro-reparto-m8, astro-ui-m8 and fa-ui-m8 (`app/scripts/`):
// change all six together.
//
// Usage: node scripts/verify-dependency-compat.mjs [--tree <npm-ls.json>] [--waivers <file>]
// (default: run `npm ls` in the folder above `scripts/`, and read the waivers
// file there if it exists).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FLEET_SCOPE = "@mano8/";
export const NPM_LS_ARGS = ["ls", "--all", "--json", "--long", "--legacy-peer-deps=false"];

const ROOT = "";
const ROOT_LABEL = "the root project";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const entriesOf = (value) => (isObject(value) ? Object.entries(value) : []);

/**
 * Where a node sits relative to the root, in npm's own `node_modules/a/node_modules/b` form.
 *
 * @param {string} rootPath
 * @param {string} nodePath
 * @returns {string}
 */
function locationOf(rootPath, nodePath) {
  return relative(rootPath, nodePath).replace(/\\/g, "/");
}

/**
 * Every installed node of an `npm ls --long` tree, keyed by location (`""` is the root).
 *
 * @param {Record<string, any>} tree
 * @returns {Map<string, Record<string, any>>}
 */
export function indexNodes(tree) {
  const nodes = new Map([[ROOT, tree]]);
  const visit = (node) => {
    for (const [, child] of entriesOf(node.dependencies)) {
      if (!isObject(child) || typeof child.path !== "string") continue;
      const location = locationOf(tree.path, child.path);
      if (!nodes.has(location)) nodes.set(location, child);
      visit(child);
    }
  };
  visit(tree);
  return nodes;
}

/**
 * The edge `node` declares on `name`, with npm's precedence: a later type
 * replaces an earlier one (peer, then prod, then optional, then dev at the root).
 *
 * @param {Record<string, any>} node
 * @param {string} name
 * @param {boolean} isRoot
 * @returns {{ type: string, spec: string | undefined }}
 */
export function edgeOf(node, name, isRoot) {
  let edge = { type: "unknown", spec: undefined };
  const peer = node.peerDependencies?.[name];
  if (peer !== undefined) {
    edge = { type: node.peerDependenciesMeta?.[name]?.optional ? "peerOptional" : "peer", spec: peer };
  }
  const prod = node._dependencies?.[name];
  if (prod !== undefined) edge = { type: "prod", spec: prod };
  const optional = node.optionalDependencies?.[name];
  if (optional !== undefined) edge = { type: "optional", spec: optional };
  const dev = isRoot ? node.devDependencies?.[name] : undefined;
  if (dev !== undefined) edge = { type: "dev", spec: dev };
  return edge;
}

/**
 * Parse a node's `invalid` marker: `"^1.2.0" from node_modules/x` or `... from the root project`.
 *
 * @param {string} marker
 * @returns {{ spec: string, location: string } | null}
 */
function parseInvalid(marker) {
  const match = /^"(.*)" from (.+)$/s.exec(marker);
  if (!match) return null;
  return { spec: match[1], location: match[2] === ROOT_LABEL ? ROOT : match[2] };
}

/**
 * Check a waivers document's shape; returns the waivers and any shape problems.
 *
 * @param {unknown} document
 * @returns {{ waivers: { requirer: string, dependency: string, reason: string }[], errors: string[] }}
 */
export function parseWaivers(document) {
  if (document === undefined) return { waivers: [], errors: [] };
  if (!isObject(document) || !Array.isArray(document.waivers)) {
    return { waivers: [], errors: ['waivers file must be an object with a "waivers" array'] };
  }
  const waivers = [];
  const errors = [];
  document.waivers.forEach((waiver, index) => {
    const fields = ["requirer", "dependency", "reason"];
    const bad = fields.filter((field) => typeof waiver?.[field] !== "string" || waiver[field].trim() === "");
    if (bad.length > 0) {
      errors.push(`waiver #${index} needs a non-empty ${bad.join(", ")}`);
    } else if (waiver.requirer.startsWith(FLEET_SCOPE)) {
      errors.push(`waiver #${index} names ${waiver.requirer}: a fleet package's range is fixed, not waived`);
    } else {
      waivers.push({ requirer: waiver.requirer, dependency: waiver.dependency, reason: waiver.reason });
    }
  });
  return { waivers, errors };
}

/**
 * One human-readable line for a finding.
 *
 * @param {{ kind: string, dependency: string, version?: string, edge: { type: string, spec?: string }, requirer: string, location: string }} finding
 * @returns {string}
 */
export function describeFinding(finding) {
  const where = finding.location === ROOT ? ROOT_LABEL : `${finding.requirer} (${finding.location})`;
  const range = JSON.stringify(finding.edge.spec ?? "?");
  if (finding.kind === "missing") {
    return `${finding.dependency} is missing: ${where} requires ${range} (${finding.edge.type})`;
  }
  return `${finding.dependency}@${finding.version} is outside ${range}, the ${finding.edge.type} range of ${where}`;
}

/**
 * Every compatibility problem in an `npm ls --all --json --long` tree.
 *
 * @param {Record<string, any>} tree
 * @param {unknown} [waiverDocument] parsed `dependency-compat.waivers.json`, if any
 * @returns {{ packages: number, problems: string[], waived: string[], skipped: string[] }}
 */
export function findCompatProblems(tree, waiverDocument) {
  if (!isObject(tree) || typeof tree.path !== "string") {
    return { packages: 0, problems: ["the npm ls output is not a --long JSON tree"], waived: [], skipped: [] };
  }
  const nodes = indexNodes(tree);
  const { waivers, errors } = parseWaivers(waiverDocument);
  const used = new Set();
  const problems = [...errors];
  const waived = [];
  const skipped = [];
  const seen = new Set();

  const nameAt = (location, node) => (location === ROOT ? tree.name ?? ROOT_LABEL : node?.name ?? location);
  const report = (finding, requirerNode) => {
    const key = `${finding.kind}\0${finding.location}\0${finding.dependency}`;
    if (seen.has(key)) return;
    seen.add(key);
    const line = describeFinding(finding);
    const ours = finding.location === ROOT || finding.requirer.startsWith(FLEET_SCOPE);
    if (finding.kind === "missing" && requirerNode?.optional === true) {
      skipped.push(line);
      return;
    }
    const index = waivers.findIndex(
      (waiver) => waiver.requirer === finding.requirer && waiver.dependency === finding.dependency,
    );
    if (index >= 0) used.add(index);
    if (index >= 0 && !ours && finding.edge.type === "peerOptional") {
      waived.push(`${line} (waived: ${waivers[index].reason})`);
      return;
    }
    problems.push(index >= 0 ? `${line} (a waiver cannot excuse a ${finding.edge.type} edge)` : line);
  };

  const visit = (parent) => {
    const parentLocation = parent === tree ? ROOT : locationOf(tree.path, parent.path);
    for (const [name, child] of entriesOf(parent.dependencies)) {
      if (!isObject(child)) continue;
      if (child.missing === true) {
        const edge = edgeOf(parent, name, parent === tree);
        if (edge.type === "optional" || edge.type === "peerOptional") continue;
        const requirer = nameAt(parentLocation, parent);
        report({ kind: "missing", dependency: name, edge, requirer, location: parentLocation }, parent);
        continue;
      }
      // Not installed and not required (an unmet optional edge): nothing to check below it.
      if (typeof child.path !== "string") continue;
      if (typeof child.invalid === "string") {
        const parsed = parseInvalid(child.invalid);
        if (!parsed) {
          problems.push(`${name}@${child.version} is invalid (${child.invalid})`);
        } else {
          const requirerNode = nodes.get(parsed.location);
          const edge = requirerNode
            ? { ...edgeOf(requirerNode, name, parsed.location === ROOT), spec: parsed.spec }
            : { type: "unknown", spec: parsed.spec };
          const requirer = nameAt(parsed.location, requirerNode);
          report(
            { kind: "invalid", dependency: name, version: child.version, edge, requirer, location: parsed.location },
            requirerNode,
          );
        }
      }
      visit(child);
    }
  };
  visit(tree);

  const accounted = /^(invalid|missing): /;
  for (const problem of Array.isArray(tree.problems) ? tree.problems : []) {
    if (!accounted.test(problem)) problems.push(`npm ls: ${problem}`);
  }
  waivers.forEach((waiver, index) => {
    if (!used.has(index)) {
      problems.push(`waiver for ${waiver.requirer} -> ${waiver.dependency} matches nothing any more; remove it`);
    }
  });
  return { packages: nodes.size - 1, problems, waived, skipped };
}

/**
 * Run `npm ls` in `cwd`, through the npm that is running this script when there is one.
 *
 * @param {string} cwd
 * @returns {{ tree?: Record<string, any>, error?: string }}
 */
function runNpmLs(cwd) {
  const options = { cwd, encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 };
  const npmCli = process.env.npm_execpath;
  const run =
    npmCli && /\.c?js$/.test(npmCli)
      ? spawnSync(process.execPath, [npmCli, ...NPM_LS_ARGS], options)
      : // Outside `npm run` there is no npm-cli.js path; a shell finds `npm` (`npm.cmd`
        // on Windows). The arguments are the constants above, so nothing is interpolated.
        spawnSync(["npm", ...NPM_LS_ARGS].join(" "), { ...options, shell: true });
  try {
    return { tree: JSON.parse(run.stdout) };
  } catch {
    return { error: `npm ls produced no JSON (exit ${run.status}): ${String(run.stderr ?? run.error).trim()}` };
  }
}

/**
 * CLI entry: prints a verdict and returns the exit code.
 *
 * @param {string[]} argv
 * @returns {number}
 */
export function main(argv) {
  const option = (flag) => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const projectDir = fileURLToPath(new URL("..", import.meta.url));
  const treePath = option("--tree");
  const waiversPath = option("--waivers") ?? fileURLToPath(new URL("../dependency-compat.waivers.json", import.meta.url));

  let tree;
  let waiverDocument;
  try {
    if (treePath) {
      tree = JSON.parse(readFileSync(treePath, "utf8"));
    } else {
      const result = runNpmLs(projectDir);
      if (result.error) throw new Error(result.error);
      tree = result.tree;
    }
    if (existsSync(waiversPath)) waiverDocument = JSON.parse(readFileSync(waiversPath, "utf8"));
  } catch (error) {
    console.error(`dependency-compat: ${error.message}`);
    return 1;
  }

  const { packages, problems, waived, skipped } = findCompatProblems(tree, waiverDocument);
  for (const line of waived) console.log(`  waived: ${line}`);
  for (const line of skipped) console.log(`  skipped (optional install): ${line}`);
  if (problems.length > 0) {
    console.error(`dependency-compat: ${problems.length} problem(s) across ${packages} installed packages`);
    for (const line of problems) console.error(`  ${line}`);
    console.error(
      "Move the dependency into a range every requirer accepts. Where the requirer is an @mano8 " +
        "package, widen its range in that repository and release it first. A Dependabot pull request " +
        "that fails here is reporting a real incompatibility, not a flaky build.",
    );
    return 1;
  }
  console.log(`dependency-compat: ${packages} installed packages, every declared range satisfied`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
