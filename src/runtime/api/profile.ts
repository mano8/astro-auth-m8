import { request } from "../client.js";
import {
  MessageSchema,
  ResponseUserSchema,
  UserPublicSchema,
  type Message,
  type ResponseUser,
  type UpdatePassword,
  type UserPublic,
  type UserUpdateMe
} from "../schemas.js";

export function getProfile(): Promise<UserPublic> {
  return request({ method: "GET", path: "/profile/get/me/", schema: UserPublicSchema, auth: true });
}

export function updateProfile(body: UserUpdateMe): Promise<ResponseUser> {
  return request({ method: "PATCH", path: "/profile/update/me/", body, schema: ResponseUserSchema, auth: true });
}

export function updatePassword(body: UpdatePassword): Promise<Message> {
  return request({ method: "PATCH", path: "/profile/me/password/", body, schema: MessageSchema, auth: true });
}

export function deleteProfile(): Promise<Message> {
  return request({ method: "DELETE", path: "/profile/delete/me/", schema: MessageSchema, auth: true });
}
