# astro-auth-m8

Astro integration and headless runtime client for `fa-auth-m8`.

## Backend contract

This package targets the `fa-auth-m8@0.9` API contract and was built against `fa-auth-m8` service version `0.9.7`. Supported backend service versions are `>=0.9.0 <0.10.0`.

Compatibility helpers are exported from `@fa-m8/astro-auth-m8/compatibility`:

```ts
import { assertFaAuthM8Compatibility } from "@fa-m8/astro-auth-m8/compatibility";

assertFaAuthM8Compatibility({ service_version: "0.9.7" });
```

When `fa-auth-m8` exposes explicit contract metadata, prefer passing `auth_contract_version` or `contract_version` from the backend health/openapi metadata.

## Modes

- `headless`: exports typed schemas, API wrappers, token handling, React provider/hooks, and route helpers without injecting pages.
- `starter`: injects small default login, logout, callback, and account routes with `injectRoute()`.
- `scaffold`: copies editable Astro/React/CSS files into a consumer app with `astro-auth-m8 scaffold --views --target src/auth`.

```ts
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import faAuth from "@fa-m8/astro-auth-m8";

export default defineConfig({
  integrations: [
    react(),
    faAuth({
      apiBase: "/user",
      mode: "starter",
      routes: { base: "/[locale]" }
    })
  ]
});
```

The runtime keeps access tokens in memory only, sends refresh requests with `credentials: "include"`, and models public backend responses without secret session fields.
