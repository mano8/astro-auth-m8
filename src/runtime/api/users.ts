import { request } from "../client.js";
import {
  MessageSchema,
  UserAuthorizationUpdateSchema,
  UserPublicSchema,
  UsersPublicSchema,
  type Message,
  type UserAuthorizationUpdate,
  type UserCreate,
  type UserPublic,
  type UserRegister,
  type UserUpdate,
  type UsersPublic
} from "../schemas.js";

export function listUsers(skip = 0, limit = 100): Promise<UsersPublic> {
  return request({ method: "GET", path: "/users/", query: { skip, limit }, schema: UsersPublicSchema, auth: true });
}

export function createUser(body: UserCreate): Promise<UserPublic> {
  return request({ method: "POST", path: "/users/new_user/", body, schema: UserPublicSchema, auth: true });
}

export function signupUser(body: UserRegister): Promise<UserPublic> {
  return request({ method: "POST", path: "/users/signup/", body, schema: UserPublicSchema, auth: true });
}

export function getUser(id: string): Promise<UserPublic> {
  return request({ method: "GET", path: `/users/get/${encodeURIComponent(id)}/`, schema: UserPublicSchema, auth: true });
}

export function updateUser(id: string, body: UserUpdate): Promise<UserAuthorizationUpdate> {
  return request({ method: "PATCH", path: `/users/update/${encodeURIComponent(id)}/`, body, schema: UserAuthorizationUpdateSchema, auth: true });
}

export function deleteUser(id: string): Promise<Message> {
  return request({ method: "DELETE", path: `/users/delete/${encodeURIComponent(id)}/`, schema: MessageSchema, auth: true });
}
