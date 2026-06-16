import { request } from "../client.js";
import { ApiKeyCreatedSchema, ApiKeyPublicSchema, MessageSchema, type ApiKeyCreate, type ApiKeyCreated, type ApiKeyPublic, type Message } from "../schemas.js";
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
