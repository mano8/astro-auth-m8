import { request } from "../client.js";
import {
  ClientSessionPublicSchema,
  ClientSessionsPublicSchema,
  MessageSchema,
  type ClientSessionPublic,
  type ClientSessionsPublic,
  type ClientSessionUpdateExternal,
  type Message
} from "../schemas.js";

export function getCurrentSession(): Promise<ClientSessionPublic> {
  return request({ method: "GET", path: "/sessions/get-current/", schema: ClientSessionPublicSchema, auth: true });
}

export function updateCurrentExternalSession(body: ClientSessionUpdateExternal): Promise<ClientSessionPublic> {
  return request({ method: "POST", path: "/sessions/refresh-google-tokens/", body, schema: ClientSessionPublicSchema, auth: true });
}

export function listSessions(skip = 0, limit = 100): Promise<ClientSessionsPublic> {
  return request({ method: "GET", path: "/sessions/", query: { skip, limit }, schema: ClientSessionsPublicSchema, auth: true });
}

export function getSession(id: string): Promise<ClientSessionPublic> {
  return request({ method: "GET", path: `/sessions/get/${encodeURIComponent(id)}/`, schema: ClientSessionPublicSchema, auth: true });
}

export function getSessionByUser(userId: string): Promise<ClientSessionPublic> {
  return request({ method: "GET", path: `/sessions/get-by-user/${encodeURIComponent(userId)}/`, schema: ClientSessionPublicSchema, auth: true });
}

export function revokeSession(id: string): Promise<Message> {
  return request({ method: "DELETE", path: `/sessions/delete/${encodeURIComponent(id)}/`, schema: MessageSchema, auth: true });
}

export function revokeSessionsByUser(userId: string): Promise<Message> {
  return request({ method: "DELETE", path: `/sessions/delete-by-user/${encodeURIComponent(userId)}/`, schema: MessageSchema, auth: true });
}
