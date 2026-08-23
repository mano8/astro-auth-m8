import eslintJs from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tseslintParser from "@typescript-eslint/parser";
import security from "eslint-plugin-security";
import globals from "globals";

export default [
  {
    ignores: [
      "coverage/",
      "dist/",
      "fixtures/",
      "node_modules/",
      "registry/r/",
      ".tmp/",
      ".astro/",
      ".vite/"
    ]
  },
  {
    // Registry skins are linted with the runtime: they are published source, and
    // scoping ESLint to `src/**` left them unread by any gate (`C12`).
    files: ["src/**/*.{ts,tsx}", "registry/blocks/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslintParser,
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      "@typescript-eslint": tseslintPlugin,
      "@eslint-react": eslintReact,
      security
    },
    rules: {
      ...eslintJs.configs.recommended.rules,
      ...tseslintPlugin.configs.recommended.rules,
      ...eslintReact.configs["recommended-typescript"].rules,
      ...security.configs.recommended.rules,
      // TypeScript resolves DOM types such as BodyInit; ESLint's core rule does not.
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "error",
      // This package supports React 18 and 19, so React 19-only API preferences
      // cannot be enforced on its public provider surface.
      "@eslint-react/no-context-provider": "off",
      "@eslint-react/no-use-context": "off",
      // Existing effects intentionally establish initial asynchronous auth state.
      "@eslint-react/set-state-in-effect": "off",
      // These generic heuristics do not model the bounded semver parser or the
      // keyof-constrained route map; security rules remain enabled otherwise.
      "security/detect-object-injection": "off",
      "security/detect-unsafe-regex": "off"
    }
  }
];
