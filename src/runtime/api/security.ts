import { request } from "../client.js";
import {
  PrivilegedActionAuditsPublicSchema,
  PurgeResponseSchema,
  type PrivilegedActionAuditsPublic,
  type PurgeRequest,
  type PurgeResponse
} from "../schemas.js";

// Wraps the three `/security/*` admin surfaces (AA-13, AA-19, AA-20).
// `GET /security/superuser-probe` is deliberately not wrapped — it is the
// security-tests-m8 harness canary, not a client surface. All three routes
// are `include_in_schema=False` on the backend, so fixtures for these must
// come from a recorded live/tested response, not the OpenAPI document.

export function getAuditLog(params: { skip?: number; limit?: number } = {}): Promise<PrivilegedActionAuditsPublic> {
  return request({
    method: "GET",
    path: "/security/audit-log",
    query: { skip: params.skip ?? 0, limit: params.limit ?? 100 },
    schema: PrivilegedActionAuditsPublicSchema,
    auth: true
  });
}

export function purgeAuditLog(body: PurgeRequest): Promise<PurgeResponse> {
  return request({ method: "POST", path: "/security/audit-log/purge", body, schema: PurgeResponseSchema, auth: true });
}

export function purgeApiKeys(body: PurgeRequest): Promise<PurgeResponse> {
  return request({ method: "POST", path: "/security/api-keys/purge", body, schema: PurgeResponseSchema, auth: true });
}
