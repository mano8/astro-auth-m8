import { request } from "../client.js";
import { ApiKeyCreatedSchema, ApiKeyPublicSchema, ApiKeysAdminPublicSchema, MessageSchema, type ApiKeyCreate, type ApiKeyCreated, type ApiKeyPublic, type ApiKeysAdminPublic, type Message } from "../schemas.js";
import { z } from "zod";

const ApiKeysSchema = z.array(ApiKeyPublicSchema);

export function listApiKeys(): Promise<ApiKeyPublic[]> {
  return request({ method: "GET", path: "/profile/api-keys/", schema: ApiKeysSchema, auth: true });
}

export function createApiKey(body: ApiKeyCreate): Promise<ApiKeyCreated> {
  return request({ method: "POST", path: "/profile/api-keys/", body, schema: ApiKeyCreatedSchema, auth: true });
}

export function getApiKey(id: string): Promise<ApiKeyPublic> {
  return request({ method: "GET", path: `/profile/api-keys/${encodeURIComponent(id)}`, schema: ApiKeyPublicSchema, auth: true });
}

export function revokeApiKey(id: string): Promise<Message> {
  return request({ method: "DELETE", path: `/profile/api-keys/${encodeURIComponent(id)}`, schema: MessageSchema, auth: true });
}

export function verifyApiKey(apiKey: string): Promise<ApiKeyPublic> {
  return request({
    method: "GET",
    path: "/profile/api-keys/verify",
    headers: { "X-API-Key": apiKey },
    schema: ApiKeyPublicSchema,
    skipRefresh: true
  });
}

// Limited superadmin surface (AA-13, AA-17): list + revoke any user's keys,
// metadata only — never the raw or hashed key. No create/edit path exists.
export function adminListUserApiKeys(userId: string): Promise<ApiKeysAdminPublic> {
  return request({ method: "GET", path: `/api-keys/by-user/${encodeURIComponent(userId)}/`, schema: ApiKeysAdminPublicSchema, auth: true });
}

export function adminRevokeApiKey(keyId: string): Promise<Message> {
  return request({ method: "POST", path: `/api-keys/revoke/${encodeURIComponent(keyId)}/`, schema: MessageSchema, auth: true });
}
