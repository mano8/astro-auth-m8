import { request } from "../client.js";
import { ResponseMessageSchema, TokenSchema, UserPublicSchema, type ResponseMessage, type Token, type UserPublic } from "../schemas.js";
import { clearToken, setToken } from "../tokenStore.js";

export async function login(username: string, password: string): Promise<Token> {
  const token = await request({
    method: "POST",
    path: "/login/access-token",
    form: { username, password },
    schema: TokenSchema,
    skipRefresh: true
  });
  setToken(token.access_token);
  return token;
}

export async function refreshToken(): Promise<Token> {
  const token = await request({
    method: "POST",
    path: "/login/refresh-token/",
    schema: TokenSchema,
    skipRefresh: true
  });
  setToken(token.access_token);
  return token;
}

export async function logout(): Promise<ResponseMessage> {
  const message = await request({
    method: "POST",
    path: "/login/logout/",
    schema: ResponseMessageSchema,
    auth: true,
    skipRefresh: true
  });
  clearToken();
  return message;
}

export function testToken(): Promise<UserPublic> {
  return request({
    method: "POST",
    path: "/login/test-token/",
    schema: UserPublicSchema,
    auth: true
  });
}
