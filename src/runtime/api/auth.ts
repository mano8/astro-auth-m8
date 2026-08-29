import { request } from "../client.js";
import { ResponseMessageSchema, TokenSchema, UserPublicSchema, type ResponseMessage, type Token, type UserPublic } from "../schemas.js";
import { markSessionAbsent, markSessionPresent } from "../sessionHint.js";
import { clearToken, setToken } from "../tokenStore.js";

let refreshTokenPromise: Promise<Token> | null = null;

export async function login(username: string, password: string): Promise<Token> {
  const token = await request({
    method: "POST",
    path: "/login/access-token",
    form: { username, password },
    schema: TokenSchema,
    skipRefresh: true
  });
  setToken(token.access_token);
  // Beside `setToken` on purpose: this is where a session starts existing for
  // this browser, whoever called it. A host with its own sign-in UI built on
  // these wrappers gets the same bookkeeping as `AuthProvider.login`.
  markSessionPresent();
  return token;
}

export async function refreshToken(): Promise<Token> {
  if (!refreshTokenPromise) {
    refreshTokenPromise = request({
      method: "POST",
      path: "/login/refresh-token/",
      schema: TokenSchema,
      skipRefresh: true
    })
      .then((token) => {
        setToken(token.access_token);
        // A refresh the service honoured proves the cookie is still good -
        // including one issued by a sibling plugin through
        // `installFaAuthBrowserAdapter`, which is the only auth call some of
        // them ever make. Clearing here lets any of those recover a hint left
        // by an earlier refusal.
        markSessionPresent();
        return token;
      })
      .finally(() => {
        refreshTokenPromise = null;
      });
  }

  return refreshTokenPromise;
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
  markSessionAbsent();
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
