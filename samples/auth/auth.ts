// Sanitized portfolio sample from 18Birds.
// Demonstrates authentication, session handling, profile hydration,
// admin-context resolution, error normalization, and Supabase-backed auth flows.

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig, hasSupabaseConfig } from "./supabase";
import { isPublicSignupEnabled } from "./runtimeConfig";
import {
  normalizeEmailInput,
  normalizeLoginIdentifier,
  normalizeNameInput,
  normalizeUsernameInput,
} from "./inputValidation";
import { emitSecurityEvent } from "./securityEvents";
import { removeStorageKey } from "./browserStorage";
import { STORAGE_POLICY } from "./storagePolicy";
import { throwIfResponseNotOk } from "./transport";

const SESSION_KEY = STORAGE_POLICY.authSession.key;
const INVALID_CREDENTIALS_MESSAGE = "Invalid email, phone, or password.";
const AUTH_UNAVAILABLE_MESSAGE =
  "Authentication is currently unavailable. Please try again later.";

export const PASSWORD_POLICY_MIN_LENGTH = 12;

type SupabaseAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
  };
};

type Profile = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  handicap: number;
};

type AdminAuthorityScope = "none" | "tenant" | "global";

type AdminAuthContextPayload = {
  is_admin?: boolean;
  admin_scope?: string;
  admin_tenant_ids?: unknown;
};

type SupabaseErrorPayload = {
  code?: string;
  error_code?: string;
  msg?: string;
  message?: string;
  error_description?: string;
};

export type AuthUser = {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  handicap: number;
  isAdmin: boolean;
  adminScope: AdminAuthorityScope;
  adminTenantIds: string[];
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  provider: "supabase";
  user: AuthUser;
};

let inMemorySession: AuthSession | null = null;
let sharedSupabaseAuthClient: ReturnType<typeof createClient> | null = null;
let sharedSupabaseAuthClientKey: string | null = null;

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_POLICY_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_POLICY_MIN_LENGTH} characters.`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character.";
  }

  return null;
}

function parseSupabaseErrorPayload(raw: string): SupabaseErrorPayload | null {
  try {
    return JSON.parse(raw) as SupabaseErrorPayload;
  } catch {
    return null;
  }
}

function getFriendlyAuthErrorMessage(args: {
  rawText: string;
  fallback: string;
}): string {
  const payload = parseSupabaseErrorPayload(args.rawText);
  const code = payload?.error_code ?? payload?.code ?? "";

  if (code === "invalid_credentials") {
    return INVALID_CREDENTIALS_MESSAGE;
  }
  if (code === "email_not_confirmed") {
    return "Please confirm your email address before signing in.";
  }
  if (code === "over_email_send_rate_limit") {
    return "Too many email requests. Please wait a few minutes and try again.";
  }

  return args.fallback;
}

function getFriendlyAuthErrorMessageFromError(args: {
  error: { code?: string; message?: string; name?: string; status?: number };
  fallback: string;
}): string {
  const normalizedMessage = (args.error.message ?? "").trim().toLowerCase();

  if (
    normalizedMessage === "invalid login credentials" ||
    normalizedMessage === "invalid credentials" ||
    normalizedMessage.includes("invalid login credentials")
  ) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  return getFriendlyAuthErrorMessage({
    rawText: JSON.stringify({
      error_code: args.error.code,
      message: args.error.message,
    }),
    fallback: args.fallback,
  });
}

function createSupabaseAuthClient() {
  const { url, anonKey } = getSupabaseConfig();
  const clientKey = `${url}|${anonKey}`;

  if (sharedSupabaseAuthClient && sharedSupabaseAuthClientKey === clientKey) {
    return sharedSupabaseAuthClient;
  }

  sharedSupabaseAuthClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch,
    },
  });

  sharedSupabaseAuthClientKey = clientKey;
  return sharedSupabaseAuthClient;
}

function normalizeAdminScope(value: unknown): AdminAuthorityScope {
  if (value === "global" || value === "tenant") return value;
  return "none";
}

function normalizeAdminTenantIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function clearPersistedSessionArtifacts(): void {
  removeStorageKey("session", SESSION_KEY);
  removeStorageKey("local", SESSION_KEY);
}

export function clearAuthSession(): void {
  inMemorySession = null;
  clearPersistedSessionArtifacts();
}

export function loadAuthSession(): AuthSession | null {
  return inMemorySession;
}

function saveAuthSession(session: AuthSession): void {
  // Tokens are kept in memory only in this sample.
  // This avoids browser persistence for sensitive session state.
  inMemorySession = {
    ...session,
    user: {
      ...session.user,
      isAdmin: Boolean(session.user.isAdmin),
      adminScope: normalizeAdminScope(session.user.adminScope),
      adminTenantIds: normalizeAdminTenantIds(session.user.adminTenantIds),
    },
  };

  clearPersistedSessionArtifacts();
}

async function fetchCurrentAdminAuthContext(accessToken: string): Promise<{
  isAdmin: boolean;
  adminScope: AdminAuthorityScope;
  adminTenantIds: string[];
}> {
  const { url, anonKey } = getSupabaseConfig();

  const response = await fetch(
    `${url}/rest/v1/rpc/current_admin_auth_context`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );

  await throwIfResponseNotOk({
    response,
    fallback: "Could not determine account access. Please sign in again.",
  });

  const payload = (await response.json()) as AdminAuthContextPayload;

  return {
    isAdmin: Boolean(payload?.is_admin),
    adminScope: normalizeAdminScope(payload?.admin_scope),
    adminTenantIds: normalizeAdminTenantIds(payload?.admin_tenant_ids),
  };
}

async function fetchProfile(
  userId: string,
  accessToken: string,
): Promise<AuthUser> {
  const { url, anonKey } = getSupabaseConfig();

  const query = new URLSearchParams({
    select: "id,username,first_name,last_name,handicap",
    id: `eq.${userId}`,
    limit: "1",
  });

  const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  await throwIfResponseNotOk({
    response,
    fallback: "Could not load your profile. Please sign in again.",
  });

  const rows = (await response.json()) as Profile[];
  const profile = rows[0];

  if (!profile) {
    throw new Error("Profile not found for this account.");
  }

  let adminContext: {
    isAdmin: boolean;
    adminScope: AdminAuthorityScope;
    adminTenantIds: string[];
  };

  try {
    adminContext = await fetchCurrentAdminAuthContext(accessToken);
  } catch (error) {
    emitSecurityEvent({
      name: "auth.admin_context_unavailable",
      severity: "warn",
      account: profile.username,
      context: {
        userId: profile.id,
        username: profile.username,
        adminAuthorityFallbackApplied: true,
        message: error instanceof Error ? error.message : "unknown error",
      },
    });

    adminContext = {
      isAdmin: false,
      adminScope: "none",
      adminTenantIds: [],
    };
  }

  return {
    id: profile.id,
    username: profile.username,
    firstName: profile.first_name,
    lastName: profile.last_name,
    handicap: profile.handicap,
    isAdmin: adminContext.isAdmin,
    adminScope: adminContext.adminScope,
    adminTenantIds: adminContext.adminTenantIds,
  };
}

async function requestPasswordLogin(
  identifier: { value: string; type: "email" | "phone" },
  password: string,
  captchaToken?: string,
): Promise<SupabaseAuthSession> {
  try {
    const client = createSupabaseAuthClient();

    const { data, error } = await client.auth.signInWithPassword({
      ...(identifier.type === "email"
        ? { email: identifier.value }
        : { phone: identifier.value }),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error) {
      if (error.status === 0 || error.message === "Failed to fetch") {
        emitSecurityEvent({
          name: "auth.login.network_error",
          severity: "warn",
          account: identifier.value,
          context: {
            endpoint: "auth/v1/token",
            identifier: identifier.value,
          },
        });

        throw new Error(
          "Could not sign in right now. Check your network and configuration, then try again.",
        );
      }

      throw new Error(
        getFriendlyAuthErrorMessageFromError({
          error,
          fallback: "Could not sign in right now. Please try again in a moment.",
        }),
      );
    }

    if (!data.session) {
      throw new Error(
        "Could not sign in right now. Please try again in a moment.",
      );
    }

    return data.session as SupabaseAuthSession;
  } catch (error) {
    if (
      error instanceof Error &&
      [
        INVALID_CREDENTIALS_MESSAGE,
        "Please confirm your email address before signing in.",
        "Too many email requests. Please wait a few minutes and try again.",
        "Could not sign in right now. Please try again in a moment.",
        "Could not sign in right now. Check your network and configuration, then try again.",
      ].includes(error.message)
    ) {
      throw error;
    }

    emitSecurityEvent({
      name: "auth.login.network_error",
      severity: "warn",
      account: identifier.value,
      context: {
        endpoint: "auth/v1/token",
        identifier: identifier.value,
      },
    });

    throw new Error(
      "Could not sign in right now. Check your network and configuration, then try again.",
    );
  }
}

async function requestRefreshSession(
  refreshToken: string,
): Promise<SupabaseAuthSession> {
  const { url, anonKey } = getSupabaseConfig();

  const response = await fetch(
    `${url}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );

  await throwIfResponseNotOk({
    response,
    fallback: "Session expired. Please sign in again.",
  });

  return (await response.json()) as SupabaseAuthSession;
}

async function requestSignup(args: {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
  handicap: number;
  captchaToken?: string;
}): Promise<SupabaseAuthSession> {
  const emailRedirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

  const client = createSupabaseAuthClient();
  const { data, error } = await client.auth.signUp({
    email: args.email,
    password: args.password,
    options: {
      emailRedirectTo,
      captchaToken: args.captchaToken,
      data: {
        username: args.username,
        first_name: args.firstName,
        last_name: args.lastName,
        handicap: args.handicap,
      },
    },
  });

  if (error) {
    throw new Error(
      error.code === "over_email_send_rate_limit"
        ? "Too many confirmation emails were requested. Please wait a few minutes, then try again or log in if the account was already created."
        : getFriendlyAuthErrorMessageFromError({
            error,
            fallback: "Could not create account.",
          }),
    );
  }

  if (!data.session) {
    throw new Error("Check your email to confirm your account, then log in.");
  }

  return data.session as SupabaseAuthSession;
}

export async function loginUser(args: {
  identifier: string;
  password: string;
  captchaToken?: string;
}): Promise<AuthSession> {
  if (!hasSupabaseConfig()) {
    clearAuthSession();
    throw new Error(AUTH_UNAVAILABLE_MESSAGE);
  }

  const normalizedIdentifier = normalizeLoginIdentifier(args.identifier);

  if (normalizedIdentifier.type === "username") {
    throw new Error("Please sign in with your email address or phone number.");
  }

  const auth = await requestPasswordLogin(
    {
      value: normalizedIdentifier.value,
      type: normalizedIdentifier.type,
    },
    args.password,
    args.captchaToken,
  );

  const user = await fetchProfile(auth.user.id, auth.access_token);

  const session: AuthSession = {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    provider: "supabase",
    user,
  };

  saveAuthSession(session);
  return session;
}

export async function registerUser(args: {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone?: string;
  handicap: number;
  password: string;
  captchaToken?: string;
}): Promise<AuthSession> {
  if (!isPublicSignupEnabled()) {
    throw new Error("Self-service signup is currently unavailable.");
  }

  if (!hasSupabaseConfig()) {
    throw new Error(AUTH_UNAVAILABLE_MESSAGE);
  }

  const normalizedUsername = normalizeUsernameInput(args.username);
  const normalizedEmail = normalizeEmailInput(args.email);
  const normalizedFirstName = normalizeNameInput(args.firstName, "First name");
  const normalizedLastName = normalizeNameInput(args.lastName, "Last name");

  const auth = await requestSignup({
    email: normalizedEmail,
    password: args.password,
    username: normalizedUsername,
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    handicap: args.handicap,
    captchaToken: args.captchaToken,
  });

  const user = await fetchProfile(auth.user.id, auth.access_token);

  const session: AuthSession = {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    provider: "supabase",
    user,
  };

  saveAuthSession(session);
  return session;
}

export async function updateUserHandicap(args: {
  session: AuthSession;
  handicap: number;
}): Promise<AuthSession> {
  if (
    !Number.isFinite(args.handicap) ||
    args.handicap < 0 ||
    args.handicap > 54
  ) {
    throw new Error("Handicap must be between 0 and 54.");
  }

  const { url, anonKey } = getSupabaseConfig();
  const query = new URLSearchParams({ id: `eq.${args.session.user.id}` });

  const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
    method: "PATCH",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${args.session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ handicap: args.handicap }),
  });

  await throwIfResponseNotOk({
    response,
    fallback: "Could not update handicap.",
  });

  const nextSession: AuthSession = {
    ...args.session,
    user: {
      ...args.session.user,
      handicap: args.handicap,
    },
  };

  saveAuthSession(nextSession);
  return nextSession;
}

export async function refreshSupabaseSession(args: {
  session: AuthSession;
}): Promise<AuthSession> {
  const auth = await requestRefreshSession(args.session.refreshToken);
  const user = await fetchProfile(auth.user.id, auth.access_token);

  const nextSession: AuthSession = {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    provider: "supabase",
    user,
  };

  saveAuthSession(nextSession);
  return nextSession;
}

export async function requestPasswordReset(args: {
  email: string;
  redirectTo: string;
  captchaToken?: string;
}): Promise<void> {
  const normalizedEmail = normalizeEmailInput(args.email);

  if (!hasSupabaseConfig()) {
    throw new Error(AUTH_UNAVAILABLE_MESSAGE);
  }

  const client = createSupabaseAuthClient();
  const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: args.redirectTo,
    captchaToken: args.captchaToken,
  });

  if (error) {
    throw new Error(
      getFriendlyAuthErrorMessageFromError({
        error,
        fallback: "Could not send password reset email.",
      }),
    );
  }
}

export async function changePasswordWithAccessToken(args: {
  accessToken: string;
  nextPassword: string;
}): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new Error("Password update requires Supabase configuration.");
  }

  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password: args.nextPassword,
    }),
  });

  await throwIfResponseNotOk({
    response,
    fallback: "Could not update password.",
    mapErrorMessage: (rawText, fallback) =>
      getFriendlyAuthErrorMessage({ rawText, fallback }),
  });
}

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  const tokenParts = accessToken.split(".");
  if (tokenParts.length < 2) return null;

  const payload = tokenParts[1]
    ?.replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil((tokenParts[1]?.length ?? 0) / 4) * 4, "=");

  if (!payload) return null;

  try {
    const decoded = atob(payload);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getUserEmailFromAccessToken(
  accessToken: string | null | undefined,
): string | null {
  if (!accessToken) return null;

  const payload = decodeJwtPayload(accessToken);
  const email = payload?.email;

  return typeof email === "string" && email.trim().length > 0
    ? email.trim().toLowerCase()
    : null;
}

export function getUserIdFromAccessToken(
  accessToken: string | null | undefined,
): string | null {
  if (!accessToken) return null;

  const payload = decodeJwtPayload(accessToken);
  const subject = payload?.sub;

  return typeof subject === "string" && subject.trim().length > 0
    ? subject.trim()
    : null;
}

export function isAccessTokenExpired(
  accessToken: string | null | undefined,
  leewayMs = 0,
): boolean {
  if (!accessToken) return true;

  const payload = decodeJwtPayload(accessToken);
  const expiresAt = payload?.exp;

  return typeof expiresAt === "number"
    ? expiresAt * 1000 <= Date.now() + Math.max(0, leewayMs)
    : false;
}
