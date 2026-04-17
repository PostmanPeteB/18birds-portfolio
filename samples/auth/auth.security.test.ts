// Sanitized portfolio sample from 18Birds.
// Demonstrates security-focused regression coverage for authentication flows,
// including friendly error handling, fail-closed authorization behavior,
// in-memory-only session handling, and captcha propagation.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  hasSupabaseConfig: vi.fn(),
  getSupabaseConfig: vi.fn(),
}));

import {
  clearAuthSession,
  loginUser,
  loadAuthSession,
  registerUser,
  requestPasswordReset,
  validatePasswordPolicy,
} from "./auth";
import { getSupabaseConfig, hasSupabaseConfig } from "./supabase";

const SESSION_KEY = "one-shot.auth.session.v1";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function asJsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function asAdminContextResponse(args: {
  isAdmin: boolean;
  adminScope?: "none" | "tenant" | "global";
  adminTenantIds?: string[];
}): Response {
  return asJsonResponse(
    {
      is_admin: args.isAdmin,
      admin_scope: args.adminScope ?? (args.isAdmin ? "tenant" : "none"),
      admin_tenant_ids: args.adminTenantIds ?? [],
    },
    200,
  );
}

function setWindow(windowLike: unknown): void {
  Object.defineProperty(globalThis, "window", {
    value: windowLike,
    configurable: true,
  });
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function installFetchHandler(
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
  handler: (url: string) => Response | Promise<Response>,
): void {
  fetchMock.mockImplementation(async (input) => {
    const url = getRequestUrl(input);
    return handler(url);
  });
}

describe("auth security regression coverage", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const mockedHasSupabaseConfig = vi.mocked(hasSupabaseConfig);
  const mockedGetSupabaseConfig = vi.mocked(getSupabaseConfig);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    mockedHasSupabaseConfig.mockReset();
    mockedGetSupabaseConfig.mockReset();

    mockedHasSupabaseConfig.mockReturnValue(true);
    mockedGetSupabaseConfig.mockReturnValue({
      url: "https://example.supabase.co",
      anonKey: "sb_publishable_test",
    });

    setWindow({
      sessionStorage: new MemoryStorage(),
      localStorage: new MemoryStorage(),
      location: { origin: "https://dev.18birds.com" },
    });

    clearAuthSession();
  });

  it("maps invalid credentials to a friendly auth error", async () => {
    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=password")) {
        return asJsonResponse({ error_code: "invalid_credentials" }, 400);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(
      loginUser({ identifier: "admin@example.com", password: "WrongPass123!" }),
    ).rejects.toThrow("Invalid email, phone, or password.");
  });

  it("maps message-only invalid login errors to the same friendly auth error", async () => {
    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=password")) {
        return asJsonResponse({ message: "Invalid login credentials" }, 400);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(
      loginUser({ identifier: "admin@example.com", password: "WrongPass123!" }),
    ).rejects.toThrow("Invalid email, phone, or password.");
  });

  it("blocks login when auth configuration is unavailable", async () => {
    mockedHasSupabaseConfig.mockReturnValue(false);

    await expect(
      loginUser({ identifier: "admin@example.com", password: "AnyPass123!" }),
    ).rejects.toThrow(
      "Authentication is currently unavailable. Please try again later.",
    );
  });

  it("keeps non-credential auth failures on a neutral fallback", async () => {
    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=password")) {
        return asJsonResponse({ message: "service unavailable" }, 503);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(
      loginUser({ identifier: "admin@example.com", password: "AnyPass123!" }),
    ).rejects.toThrow(
      "Could not sign in right now. Please try again in a moment.",
    );
  });

  it("maps network-level login failures to friendly guidance", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=password")) {
        throw new TypeError("Failed to fetch");
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(
      loginUser({ identifier: "admin@example.com", password: "AnyPass123!" }),
    ).rejects.toThrow(
      "Could not sign in right now. Check your network and configuration, then try again.",
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("blocks registration when auth configuration is unavailable", async () => {
    mockedHasSupabaseConfig.mockReturnValue(false);

    await expect(
      registerUser({
        firstName: "Rate",
        lastName: "Limited",
        username: "rate.limited",
        email: "rate.limited@example.com",
        phone: "0401000000",
        handicap: 10,
        password: "ValidPass123!",
      }),
    ).rejects.toThrow(
      "Authentication is currently unavailable. Please try again later.",
    );
  });

  it("forwards the captcha token to password login requests", async () => {
    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=password")) {
        return asJsonResponse(
          {
            access_token: "token-success",
            refresh_token: "refresh-success",
            expires_in: 3600,
            token_type: "bearer",
            user: { id: "user-success" },
          },
          200,
        );
      }

      if (url.includes("/rest/v1/profiles?")) {
        return asJsonResponse(
          [
            {
              id: "user-success",
              username: "tester-1",
              first_name: "Pete",
              last_name: "Tester",
              handicap: 9.5,
            },
          ],
          200,
        );
      }

      if (url.includes("/rest/v1/rpc/current_admin_auth_context")) {
        return asAdminContextResponse({ isAdmin: false });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    await loginUser({
      identifier: "admin@example.com",
      password: "ValidPass123!",
      captchaToken: "captcha-login-token",
    });

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      gotrue_meta_security?: { captcha_token?: string };
    };

    expect(body.gotrue_meta_security?.captcha_token).toBe(
      "captcha-login-token",
    );
  });

  it("keeps a successful login in memory only and avoids browser storage persistence", async () => {
    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=password")) {
        return asJsonResponse(
          {
            access_token: "token-success",
            refresh_token: "refresh-success",
            expires_in: 3600,
            token_type: "bearer",
            user: { id: "user-success" },
          },
          200,
        );
      }

      if (url.includes("/rest/v1/profiles?")) {
        return asJsonResponse(
          [
            {
              id: "user-success",
              username: "tester-1",
              first_name: "Pete",
              last_name: "Tester",
              handicap: 9.5,
            },
          ],
          200,
        );
      }

      if (url.includes("/rest/v1/rpc/current_admin_auth_context")) {
        return asAdminContextResponse({
          isAdmin: false,
          adminScope: "none",
          adminTenantIds: [],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const session = await loginUser({
      identifier: "tester@example.com",
      password: "ValidPass123!",
    });

    expect(session.accessToken).toBe("token-success");
    expect(loadAuthSession()?.accessToken).toBe("token-success");
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("hydrates admin authority from the role helper rather than profile flags", async () => {
    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=password")) {
        return asJsonResponse(
          {
            access_token: "token-role-admin",
            refresh_token: "refresh-role-admin",
            expires_in: 3600,
            token_type: "bearer",
            user: { id: "role-admin-user" },
          },
          200,
        );
      }

      if (url.includes("/rest/v1/profiles?")) {
        return asJsonResponse(
          [
            {
              id: "role-admin-user",
              username: "role-admin",
              first_name: "Role",
              last_name: "Admin",
              handicap: 5,
              is_admin: false,
            },
          ],
          200,
        );
      }

      if (url.includes("/rest/v1/rpc/current_admin_auth_context")) {
        return asAdminContextResponse({
          isAdmin: true,
          adminScope: "tenant",
          adminTenantIds: ["tenant-7"],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const session = await loginUser({
      identifier: "role-admin@example.com",
      password: "ValidPass123!",
    });

    expect(session.user.isAdmin).toBe(true);
    expect(session.user.adminScope).toBe("tenant");
    expect(session.user.adminTenantIds).toEqual(["tenant-7"]);
  });

  it("fails closed for admin authority when the admin-context RPC is unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=password")) {
        return asJsonResponse(
          {
            access_token: "token-fallback",
            refresh_token: "refresh-fallback",
            expires_in: 3600,
            token_type: "bearer",
            user: { id: "fallback-user" },
          },
          200,
        );
      }

      if (url.includes("/rest/v1/profiles?")) {
        return asJsonResponse(
          [
            {
              id: "fallback-user",
              username: "fallback-admin",
              first_name: "Fallback",
              last_name: "Admin",
              handicap: 4,
              is_admin: true,
            },
          ],
          200,
        );
      }

      if (url.includes("/rest/v1/rpc/current_admin_auth_context")) {
        return asJsonResponse({ message: "rpc unavailable" }, 503);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const session = await loginUser({
      identifier: "fallback-admin@example.com",
      password: "ValidPass123!",
    });

    expect(session.user.isAdmin).toBe(false);
    expect(session.user.adminScope).toBe("none");
    expect(session.user.adminTenantIds).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("normalizes missing isAdmin in in-memory sessions to false", async () => {
    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=password")) {
        return asJsonResponse(
          {
            access_token: "token-3",
            refresh_token: "refresh-3",
            expires_in: 3600,
            token_type: "bearer",
            user: { id: "u3" },
          },
          200,
        );
      }

      if (url.includes("/rest/v1/profiles?")) {
        return asJsonResponse(
          [
            {
              id: "u3",
              username: "member",
              first_name: "Member",
              last_name: "User",
              handicap: 18,
            },
          ],
          200,
        );
      }

      if (url.includes("/rest/v1/rpc/current_admin_auth_context")) {
        return asAdminContextResponse({
          isAdmin: false,
          adminScope: "none",
          adminTenantIds: [],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    await loginUser({
      identifier: "member@example.com",
      password: "ValidPass123!",
    });

    expect(loadAuthSession()?.user.isAdmin).toBe(false);
  });

  it("clears the in-memory session on logout", async () => {
    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=password")) {
        return asJsonResponse(
          {
            access_token: "logout-token",
            refresh_token: "logout-refresh",
            expires_in: 3600,
            token_type: "bearer",
            user: { id: "logout-user" },
          },
          200,
        );
      }

      if (url.includes("/rest/v1/profiles?")) {
        return asJsonResponse(
          [
            {
              id: "logout-user",
              username: "logout-user",
              first_name: "Logout",
              last_name: "User",
              handicap: 4,
            },
          ],
          200,
        );
      }

      if (url.includes("/rest/v1/rpc/current_admin_auth_context")) {
        return asAdminContextResponse({
          isAdmin: false,
          adminScope: "none",
          adminTenantIds: [],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    await loginUser({
      identifier: "logout@example.com",
      password: "ValidPass123!",
    });

    clearAuthSession();
    expect(loadAuthSession()).toBeNull();
  });

  it("enforces password policy with success and failure cases", () => {
    expect(validatePasswordPolicy("ValidPass123!")).toBeNull();
    expect(validatePasswordPolicy("short")).toBe(
      "Password must be at least 12 characters.",
    );
  });

  it("maps reset rate-limit failures to a friendly message", async () => {
    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/recover")) {
        return asJsonResponse(
          { error_code: "over_email_send_rate_limit" },
          429,
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(
      requestPasswordReset({
        email: "member@example.com",
        redirectTo: "https://dev.18birds.com/reset-password",
      }),
    ).rejects.toThrow(
      "Too many email requests. Please wait a few minutes and try again.",
    );
  });

  it("forwards the captcha token to password reset requests", async () => {
    installFetchHandler(fetchMock, async (url) => {
      if (url.includes("/auth/v1/recover")) {
        return asJsonResponse({}, 200);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    await requestPasswordReset({
      email: "member@example.com",
      redirectTo: "https://dev.18birds.com/reset-password",
      captchaToken: "captcha-reset-token",
    });

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      gotrue_meta_security?: { captcha_token?: string };
    };

    expect(body.gotrue_meta_security?.captcha_token).toBe(
      "captcha-reset-token",
    );
  });
});
