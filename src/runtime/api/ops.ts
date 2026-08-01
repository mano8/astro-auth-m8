import { request } from "../client.js";
import { HealthSchema, JwksSchema, ServiceMetaSchema, type Health, type Jwks, type ServiceMeta } from "../schemas.js";

export function getAuthHealth(): Promise<Health> {
  return request({ method: "GET", path: "/health/", schema: HealthSchema, skipRefresh: true });
}

export function getJwks(): Promise<Jwks> {
  return request({ method: "GET", path: "/.well-known/jwks.json", schema: JwksSchema, skipRefresh: true });
}

// Public, unauthenticated (AA-16/AA-22): backs the compatibility preflight
// wired into installFaAuthBrowserAdapter (T11).
export function getServiceMeta(): Promise<ServiceMeta> {
  return request({ method: "GET", path: "/meta", schema: ServiceMetaSchema, skipRefresh: true });
}
