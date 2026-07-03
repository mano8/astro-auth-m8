import { request } from "../client.js";
import { UsersActivitySchema, type UsersActivity } from "../schemas.js";

export function getUserActivity(): Promise<UsersActivity> {
  return request({ method: "GET", path: "/dashboard/users/activity/current/", schema: UsersActivitySchema, auth: true });
}

export function getGlobalActivity(): Promise<UsersActivity> {
  return request({ method: "GET", path: "/dashboard/users/activity/", schema: UsersActivitySchema, auth: true });
}
