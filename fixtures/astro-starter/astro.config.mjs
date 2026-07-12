import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import faAuth from "@mano8/astro-auth-m8";

export default defineConfig({
  integrations: [
    react(),
    faAuth({
      mode: "starter",
      apiBase: "/user",
      routes: {
        signup: "/auth/signup"
      }
    })
  ]
});
