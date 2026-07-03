import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import YAML from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("CI npm audit configuration (Phase 4.3)", () => {
  it("package-lock.json exists", () => {
    const actualPath = resolve(__dirname, "../package-lock.json");
    expect(() => statSync(actualPath)).not.toThrow();
  });

  it("package-lock.json is not empty", () => {
    const actualPath = resolve(__dirname, "../package-lock.json");
    const stats = statSync(actualPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it("CI workflow runs npm audit at high or critical level", () => {
    const ciYamlPath = resolve(__dirname, "../.github/workflows/CI.yaml");
    const content = readFileSync(ciYamlPath, "utf-8");
    const ci = YAML.load(content) as Record<string, unknown>;

    expect(ci.jobs).toBeDefined();
    const jobs = ci.jobs as Record<string, unknown>;
    expect(jobs.security).toBeDefined();

    const securityJob = jobs.security as Record<string, unknown>;
    const steps = securityJob.steps as Array<Record<string, unknown>>;

    const auditStep = steps.find((step) => {
      const run = step.run as string | undefined;
      return run && run.includes("npm audit");
    });

    expect(auditStep).toBeDefined();
    expect(auditStep?.run).toMatch(/npm audit.*--audit-level=h(igh|critical)/);
  });

  it("dependency install precedes npm audit in CI workflow", () => {
    const ciYamlPath = resolve(__dirname, "../.github/workflows/CI.yaml");
    const content = readFileSync(ciYamlPath, "utf-8");
    const ci = YAML.load(content) as Record<string, unknown>;

    const jobs = ci.jobs as Record<string, unknown>;
    const securityJob = jobs.security as Record<string, unknown>;
    const steps = securityJob.steps as Array<Record<string, unknown>>;

    const installStepIndex = steps.findIndex((step) => {
      const run = step.run as string | undefined;
      return run && run.includes("npm ci");
    });

    const auditStepIndex = steps.findIndex((step) => {
      const run = step.run as string | undefined;
      return run && run.includes("npm audit");
    });

    expect(installStepIndex).toBeGreaterThanOrEqual(0);
    expect(auditStepIndex).toBeGreaterThanOrEqual(0);
    expect(installStepIndex).toBeLessThan(auditStepIndex);
  });
});
