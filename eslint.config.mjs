import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Non-project directories (sandbox scaffolding, downloads, tooling)
    "skills/**",
    "download/**",
    "tool-results/**",
    "upload/**",
    "scripts/**",
  ]),
  {
    rules: {
      // Next.js Route Handlers need to declare `req: NextRequest` in
      // the function signature even when unused, because Next.js
      // detects the route by the parameter arity (0/1/2 args). The
      // `_req` underscore prefix is the standard convention for
      // "intentionally unused", so don't flag it.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
