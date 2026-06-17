# astro-auth-m8

Astro integration and headless runtime client for `fa-auth-m8`.

## Backend contract

This package targets the `fa-auth-m8@0.9` API contract and was tested against `fa-auth-m8` service version `0.9.8`. Supported backend service versions are `>=0.9.8 <0.10.0` (the floor is the first release exposing the discovery route).

Compatibility helpers are exported from `@fa-m8/astro-auth-m8/compatibility`. `fa-auth-m8` (≥ 0.9.8) exposes a public `GET {API_PREFIX}/meta` route returning a `ServiceMeta` payload — pass it straight to the assert:

```ts
import { assertFaAuthM8Compatibility } from "@fa-m8/astro-auth-m8/compatibility";

const meta = await fetch(`${base}/user/meta`).then((r) => r.json());
// meta = { service, version, api_version, contract: { name, version, range } }
assertFaAuthM8Compatibility(meta); // reads nested contract.version + version
```

The helper also accepts flat fields (`auth_contract_version` / `contract_version` / `service_version`) for backends that surface metadata elsewhere.

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
