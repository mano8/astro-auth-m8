import { z } from "zod";

// Declared from highest to lowest privilege: `runtime/authorization.ts` reads
// this order as the canonical role hierarchy. Do not reorder.
export const RoleTypeSchema = z.enum(["superadmin", "admin", "writer", "reader", "user"]);
export type RoleType = z.infer<typeof RoleTypeSchema>;

export const AuthProviderTypeSchema = z.enum(["password", "google"]);
export type AuthProviderType = z.infer<typeof AuthProviderTypeSchema>;

const isoDate = z.string();
const nullableIsoDate = isoDate.nullable();

export const TokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string().default("bearer")
}).strict();
export type Token = z.infer<typeof TokenSchema>;

export const MessageSchema = z.object({
  message: z.string()
}).strict();
export type Message = z.infer<typeof MessageSchema>;

export const ResponseMessageSchema = z.object({
  success: z.boolean(),
  msg: z.string()
}).strict();
export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;

export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  provider: AuthProviderTypeSchema.default("password"),
  email: z.string().email(),
  full_name: z.string().max(100).nullable().default(null),
  avatar: z.string().max(255).url().nullable().default(null),
  is_active: z.boolean().default(true),
  email_verified: z.boolean().default(false),
  is_superuser: z.boolean().default(false),
  role: RoleTypeSchema.default("user"),
  created_at: isoDate.optional(),
  updated_at: isoDate.optional()
}).strict();
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const UserAuthorizationUpdateSchema = UserPublicSchema.extend({
  auth_generation: z.number().int(),
  revocation_enqueued: z.boolean()
}).strict();
export type UserAuthorizationUpdate = z.infer<typeof UserAuthorizationUpdateSchema>;

export const ResponseUserSchema = z.object({
  success: z.boolean(),
  user: UserPublicSchema
}).strict();
export type ResponseUser = z.infer<typeof ResponseUserSchema>;

export const UsersPublicSchema = z.object({
  data: z.array(UserPublicSchema),
  count: z.number().int().nonnegative()
}).strict();
export type UsersPublic = z.infer<typeof UsersPublicSchema>;

export const UserRegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  full_name: z.string().max(100).nullable().optional()
}).strict();
export type UserRegister = z.infer<typeof UserRegisterSchema>;

const userCreateBase = z.object({
  provider: AuthProviderTypeSchema.default("password"),
  email: z.string().email().max(255),
  full_name: z.string().max(100).nullable().optional(),
  avatar: z.string().max(255).url().nullable().optional(),
  is_active: z.boolean().optional(),
  email_verified: z.boolean().optional(),
  role: RoleTypeSchema.optional(),
  password: z.string().min(8).max(128).nullable().optional(),
  oauth_user_id: z.string().max(256).nullable().optional()
}).strict();

export const UserCreateSchema = userCreateBase.superRefine((value, ctx) => {
  if (value.provider === "password") {
    if (!value.password) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Password required for password provider" });
    }
    if (value.oauth_user_id != null) {
      ctx.addIssue({ code: "custom", path: ["oauth_user_id"], message: "oauth_user_id is only supported for Google users" });
    }
  }
  if (value.provider === "google") {
    if (!value.oauth_user_id) {
      ctx.addIssue({ code: "custom", path: ["oauth_user_id"], message: "oauth_user_id required for Google provider" });
    }
    if (value.password != null) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "password is not supported for Google users" });
    }
  }
});
export type UserCreate = z.infer<typeof UserCreateSchema>;

export const UserUpdateSchema = z.object({
  email: z.string().email().max(255).nullable().optional(),
  full_name: z.string().max(100).nullable().optional(),
  avatar: z.string().max(255).url().nullable().optional(),
  password: z.string().min(8).max(128).nullable().optional(),
  oauth_user_id: z.string().max(256).nullable().optional(),
  role: RoleTypeSchema.nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  provider: AuthProviderTypeSchema.nullable().optional()
}).strict().superRefine((value, ctx) => {
  if (value.provider === "password" && value.oauth_user_id != null) {
    ctx.addIssue({ code: "custom", path: ["oauth_user_id"], message: "oauth_user_id is not supported for password users" });
  }
  if (value.provider === "google" && value.password != null) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "password is not supported for Google users" });
  }
});
export type UserUpdate = z.infer<typeof UserUpdateSchema>;

export const UserUpdateMeSchema = z.object({
  email: z.string().email().max(255).nullable().optional(),
  full_name: z.string().max(100).nullable().optional(),
  avatar: z.string().max(255).url().nullable().optional()
}).strict();
export type UserUpdateMe = z.infer<typeof UserUpdateMeSchema>;

export const UpdatePasswordSchema = z.object({
  current_password: z.string().min(8).max(128),
  new_password: z.string().min(8).max(128)
}).strict();
export type UpdatePassword = z.infer<typeof UpdatePasswordSchema>;

// Immutable operation-category cap chosen at issuance (APIKEY-MODE-01); never
// changed afterward - issuing a replacement key is the only way to widen it.
export const ApiKeyAccessModeSchema = z.enum(["read_only", "read_write"]);
export type ApiKeyAccessMode = z.infer<typeof ApiKeyAccessModeSchema>;

export const ApiKeyPublicSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(100),
  expires_at: nullableIsoDate,
  revoked: z.boolean().default(false),
  last_used_at: nullableIsoDate.default(null),
  created_at: isoDate.optional(),
  updated_at: isoDate.optional(),
  access_mode: ApiKeyAccessModeSchema.default("read_only"),
  audiences: z.array(z.string()).default([])
}).strict();
export type ApiKeyPublic = z.infer<typeof ApiKeyPublicSchema>;

export const ApiKeyCreateSchema = z.object({
  name: z.string().min(3).max(100).nullable().optional(),
  ttl_hours: z.number().int().positive().default(24),
  access_mode: ApiKeyAccessModeSchema.default("read_only"),
  audiences: z.array(z.string()).nullable().optional()
}).strict();
export type ApiKeyCreate = z.infer<typeof ApiKeyCreateSchema>;

export const ApiKeyCreatedSchema = ApiKeyPublicSchema.extend({
  plaintext: z.string()
}).strict();
export type ApiKeyCreated = z.infer<typeof ApiKeyCreatedSchema>;

export const ClientSessionPublicSchema = z.object({
  id: z.string(),
  provider: AuthProviderTypeSchema,
  jwt_jti: z.string(),
  jwt_expires_at: isoDate,
  refresh_expires_at: isoDate,
  revoked: z.boolean(),
  external_token_expires_at: nullableIsoDate.default(null),
  created_at: isoDate.optional(),
  updated_at: isoDate.optional()
}).strict();
export type ClientSessionPublic = z.infer<typeof ClientSessionPublicSchema>;

export const ClientSessionsPublicSchema = z.object({
  data: z.array(ClientSessionPublicSchema),
  count: z.number().int().nonnegative()
}).strict();
export type ClientSessionsPublic = z.infer<typeof ClientSessionsPublicSchema>;

export const ClientSessionUpdateExternalSchema = z.object({
  external_access_token: z.string().max(2048).optional(),
  external_refresh_token: z.string().max(2048).optional(),
  external_token_expires_at: isoDate.optional()
}).strict();
export type ClientSessionUpdateExternal = z.infer<typeof ClientSessionUpdateExternalSchema>;

export const ActivityCounterSchema = z.object({
  model: z.string(),
  updated: z.number(),
  added: z.number()
}).strict();
export type ActivityCounter = z.infer<typeof ActivityCounterSchema>;

export const ActivityStatsSchema = z.object({
  min: z.number(),
  max: z.number(),
  activity: z.array(ActivityCounterSchema)
}).strict();
export type ActivityStats = z.infer<typeof ActivityStatsSchema>;

export const UsersActivitySchema = z.object({
  nb_users: z.number(),
  activity: ActivityStatsSchema
}).strict();
export type UsersActivity = z.infer<typeof UsersActivitySchema>;

export const HealthSchema = z.object({
  status: z.string(),
  token_mode: z.string(),
  effective_mode: z.string(),
  redis: z.unknown(),
  circuit_breaker: z.unknown(),
  database: z.unknown(),
  revocation_available: z.boolean(),
  rate_limiting_available: z.boolean(),
  degraded_since: z.string().nullable(),
  degradation_modes: z.record(z.string(), z.string())
}).passthrough();
export type Health = z.infer<typeof HealthSchema>;

export const JwkSchema = z.object({
  kty: z.string()
}).passthrough();

export const JwksSchema = z.object({
  keys: z.array(JwkSchema)
}).passthrough();
export type Jwks = z.infer<typeof JwksSchema>;

export const GoogleLoginUrlResponseSchema = z.object({
  url: z.string().url()
}).strict();
export type GoogleLoginUrlResponse = z.infer<typeof GoogleLoginUrlResponseSchema>;

export const GoogleExchangeResponseSchema = z.object({
  version: z.union([z.string(), z.number()]),
  auth_provider: z.string(),
  access_token: z.string(),
  expires_at: z.number(),
  user: z.object({
    name: z.string().nullable().optional(),
    email: z.string().email(),
    avatar: z.string().url().nullable().optional()
  }).strict()
}).strict();
export type GoogleExchangeResponse = z.infer<typeof GoogleExchangeResponseSchema>;

export const LoginFormSchema = z.object({
  username: z.string().email(),
  password: z.string().min(1)
}).strict();
export type LoginForm = z.infer<typeof LoginFormSchema>;
