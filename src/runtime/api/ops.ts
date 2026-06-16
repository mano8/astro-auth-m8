import { request } from "../client.js";
import { HealthSchema, JwksSchema, type Health, type Jwks } from "../schemas.js";

export function getAuthHealth(): Promise<Health> {
  return request({ method: "GET", path: "/health/", schema: HealthSchema, skipRefresh: true });
}

export function getJwks(): Promise<Jwks> {
  return request({ method: "GET", path: "/.well-known/jwks.json", schema: JwksSchema, skipRefresh: true });
}
