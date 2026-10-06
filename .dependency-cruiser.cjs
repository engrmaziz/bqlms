/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-cross-module-internal-imports",
      comment:
        "Cross-module imports are only allowed through the module's public index.ts",
      severity: "error",
      from: {
        path: "^src/modules/([^/]+)/",
      },
      to: {
        path: "^src/modules/([^/]+)/",
        pathNot: ["^src/modules/$1/", "^src/modules/[^/]+/index\\.ts$"],
      },
    },
    {
      name: "external-only-import-module-index",
      comment:
        "Code outside of a module must only import the module through its public index.ts or schema.ts",
      severity: "error",
      from: {
        path: "^src/(?!modules/)",
      },
      to: {
        path: "^src/modules/[^/]+/",
        pathNot: [
          "^src/modules/[^/]+/index\\.ts$",
          "^src/modules/[^/]+/schema\\.ts$",
          "^src/modules/[^/]+/actions\\.ts$",
        ],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
