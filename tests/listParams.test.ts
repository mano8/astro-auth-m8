import { describe, expect, it } from "vitest";
import { makeListSchema, mergeAndNormalize, parseListUrlParams, stringifyListUrlParams } from "../src/runtime/listParams.js";

const userListSchema = () => makeListSchema({
  allowedSorts: ["created_at", "email", "role"],
  allowedPageSizes: [10, 25, 50],
  defaultSort: "created_at",
  defaultOrder: "desc",
  defaultPage: 1,
  defaultPageSize: 25
});

describe("list params helpers", () => {
  it("parses URLSearchParams with normalized search, numeric values, sorting, and order", () => {
    const params = new URLSearchParams({
      page: "3",
      pageSize: "50",
      q: "  ada   lovelace  ",
      sort: "email",
      order: "ASC"
    });

    expect(parseListUrlParams(userListSchema(), params)).toEqual({
      page: 3,
      pageSize: 50,
      q: "ada lovelace",
      sort: "email",
      order: "asc"
    });
  });

  it("falls back to Zod-backed defaults for invalid URL values", () => {
    const params = new URLSearchParams({
      page: "0",
      pageSize: "11",
      q: "   ",
      sort: "name",
      order: "sideways"
    });

    expect(parseListUrlParams(userListSchema(), params)).toEqual({
      page: 1,
      pageSize: 25,
      q: "",
      sort: "created_at",
      order: "desc"
    });
  });

  it("parses plain objects and uses the first non-null array value", () => {
    expect(parseListUrlParams(userListSchema(), {
      page: 2,
      pageSize: [null, 10],
      q: ["", "ignored"],
      sort: "role",
      order: "asc"
    })).toEqual({
      page: 2,
      pageSize: 10,
      q: "",
      sort: "role",
      order: "asc"
    });
  });

  it("merges URLSearchParams with plain object patches and normalizes the result", () => {
    const current = new URLSearchParams({
      page: "4",
      pageSize: "25",
      q: "ada",
      sort: "email",
      order: "desc"
    });

    expect(mergeAndNormalize(userListSchema(), current, {
      page: 1,
      q: "  grace   hopper ",
      order: "asc"
    })).toEqual({
      page: 1,
      pageSize: 25,
      q: "grace hopper",
      sort: "email",
      order: "asc"
    });
  });

  it("stringifies list params in a stable order and omits an empty search", () => {
    const params = parseListUrlParams(userListSchema(), {
      page: 1,
      pageSize: 25,
      q: "",
      sort: "created_at",
      order: "desc"
    });

    expect(stringifyListUrlParams(params)).toBe("page=1&pageSize=25&sort=created_at&order=desc");
    expect(stringifyListUrlParams({ ...params, q: "ada lovelace" })).toBe("page=1&pageSize=25&q=ada+lovelace&sort=created_at&order=desc");
  });

  it("supports implicit defaults from the first allowed sort and page size", () => {
    const schema = makeListSchema({
      allowedSorts: ["email", "role"],
      allowedPageSizes: [10, 20]
    });

    expect(parseListUrlParams(schema, {})).toEqual({
      page: 1,
      pageSize: 10,
      q: "",
      sort: "email",
      order: "desc"
    });
  });

  it("rejects invalid helper defaults at construction time", () => {
    expect(() => makeListSchema({
      allowedSorts: ["email", "role"],
      allowedPageSizes: [10, 20],
      defaultSort: "created_at" as "email"
    })).toThrow("defaultSort must be one of allowedSorts");

    expect(() => makeListSchema({
      allowedSorts: ["email", "role"],
      allowedPageSizes: [10, 20],
      defaultPageSize: 25
    })).toThrow("defaultPageSize must be one of allowedPageSizes");

    expect(() => makeListSchema({
      allowedSorts: ["email", "role"],
      allowedPageSizes: [10, 20],
      defaultPage: 0
    })).toThrow("defaultPage must be a positive integer");
  });
});
