// Keep patches reproducible without rewriting an operator's workspace policy.
const requiredBuilds = {
  "@prisma/client": true,
  "@prisma/engines": true,
  "cpu-features": true,
  esbuild: true,
  prisma: true,
  ssh2: true,
  "unrs-resolver": true,
};

module.exports = {
  hooks: {
    updateConfig(config) {
      if (config.allowBuilds === undefined) config.allowBuilds = { ...requiredBuilds };
      return config;
    },
    readPackage(pkg) {
      for (const field of ["dependencies", "optionalDependencies"]) {
        const dependencies = pkg[field];
        if (!dependencies) continue;
        if (pkg.name === "next" && pkg.version?.startsWith("15.") && dependencies.postcss) {
          dependencies.postcss = "8.5.23";
        }
        if (pkg.name === "@prisma/config" && pkg.version === "6.19.3" && dependencies["deepmerge-ts"]) {
          dependencies["deepmerge-ts"] = "8.0.0";
        }
        if (/^[~^]?3\./.test(dependencies.nanoid || "")) dependencies.nanoid = "3.3.18";
        if (/^[~^]?1\./.test(dependencies["source-map-js"] || "")) dependencies["source-map-js"] = "1.2.2";
      }
      return pkg;
    },
  },
};
