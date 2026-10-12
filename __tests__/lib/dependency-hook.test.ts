import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { hooks } = require("../../.pnpmfile.cjs");
describe("dependency installation policy", () => {
  it("preserves an operator's denied, allowed and empty build policy", () => {
    for (const policy of [{ ssh2: false, prisma: true }, {}]) {
      const config = { allowBuilds: policy, registry: "https://synthetic.invalid", stateDir: "synthetic-state" };
      expect(hooks.updateConfig(config)).toEqual(config);
      expect(config.allowBuilds).toBe(policy);
    }
    const defaults = hooks.updateConfig({});
    expect(Object.keys(defaults.allowBuilds)).toHaveLength(7);
    expect(defaults.dangerouslyAllowAllBuilds).toBeUndefined();
  });

  it("patches the targeted graph without downgrading unrelated major lines", () => {
    const prisma = hooks.readPackage({ name: "@prisma/config", version: "6.19.3", dependencies: { "deepmerge-ts": "7.1.5" } });
    expect(prisma.dependencies["deepmerge-ts"]).toBe("8.0.0");
    const next = hooks.readPackage({ name: "next", version: "15.5.27", dependencies: { postcss: "8.4.31", nanoid: "^3.3.11", "source-map-js": "^1.2.1" } });
    expect(next.dependencies).toEqual({ postcss: "8.5.23", nanoid: "3.3.18", "source-map-js": "1.2.2" });
    const unrelated = { name: "other", version: "1.0.0", dependencies: { nanoid: "^5.0.0", "source-map-js": "^2.0.0" } };
    expect(hooks.readPackage(structuredClone(unrelated))).toEqual(unrelated);
  });
});
