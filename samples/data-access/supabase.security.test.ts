// Sanitized portfolio sample from 18Birds.
// Demonstrates security-focused regression coverage for frontend Supabase
// configuration validation, safe client-key usage, error normalization,
// and runtime URL resolution behavior.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSupabaseTargetLabelForUrl,
  mapSupabaseResponseErrorForUser,
  resolveRuntimeSupabaseUrl,
  validateClientSupabaseConfig,
} from "./supabase";

describe("validateClientSupabaseConfig", () => {
  const jwtHeader = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
  const anonPayload = "eyJyb2xlIjoiYW5vbiJ9";
  const serviceRolePayload = "eyJyb2xlIjoic2VydmljZV9yb2xlIn0";

  it("accepts https URL and publishable key", () => {
    const result = validateClientSupabaseConfig({
      url: "https://example.supabase.co",
      anonKey: "sb_publishable_abc123",
      appEnv: "production",
    });

    expect(result.url).toBe("https://example.supabase.co");
    expect(result.anonKey).toBe("sb_publishable_abc123");
  });

  it("rejects non-https URL in production", () => {
    expect(() =>
      validateClientSupabaseConfig({
        url: "http://example.supabase.co",
        anonKey: "sb_publishable_abc123",
        appEnv: "production",
      }),
    ).toThrow(
      "VITE_SUPABASE_URL must use HTTPS (HTTP allowed only in development/test for local hosts).",
    );
  });

  it("rejects localhost/private hosts for production config", () => {
    expect(() =>
      validateClientSupabaseConfig({
        url: "https://localhost:54321",
        anonKey: "sb_publishable_abc123",
        appEnv: "production",
      }),
    ).toThrow(
      "VITE_SUPABASE_URL host is not allowed outside development/test.",
    );
  });

  it("rejects bracketed IPv6 localhost for production config", () => {
    expect(() =>
      validateClientSupabaseConfig({
        url: "https://[::1]:54321",
        anonKey: "sb_publishable_abc123",
        appEnv: "production",
      }),
    ).toThrow(
      "VITE_SUPABASE_URL host is not allowed outside development/test.",
    );
  });

  it("allows localhost/private hosts in development", () => {
    const result = validateClientSupabaseConfig({
      url: "http://127.0.0.1:54321",
      anonKey: "sb_publishable_abc123",
      appEnv: "development",
    });

    expect(result.url).toBe("http://127.0.0.1:54321");
  });

  it("rejects public host over http even in development", () => {
    expect(() =>
      validateClientSupabaseConfig({
        url: "http://example.supabase.co",
        anonKey: "sb_publishable_abc123",
        appEnv: "development",
      }),
    ).toThrow(
      "VITE_SUPABASE_URL must use HTTPS (HTTP allowed only in development/test for local hosts).",
    );
  });

  it("does not treat public hostname prefixes as private ipv6 ranges", () => {
    const result = validateClientSupabaseConfig({
      url: "https://fd-example.com",
      anonKey: "sb_publishable_abc123",
      appEnv: "production",
    });

    expect(result.url).toBe("https://fd-example.com");
  });

  it("rejects secret/service-role style keys in client config", () => {
    expect(() =>
      validateClientSupabaseConfig({
        url: "https://example.supabase.co",
        anonKey: "sb_secret_abc123",
        appEnv: "production",
      }),
    ).toThrow(
      "VITE_SUPABASE_ANON_KEY must be a publishable/anon key, not a secret key.",
    );
  });

  it("accepts legacy anon JWT key format", () => {
    const result = validateClientSupabaseConfig({
      url: "https://example.supabase.co",
      anonKey: `${jwtHeader}.${anonPayload}.sig`,
      appEnv: "production",
    });

    expect(result.anonKey).toBe(`${jwtHeader}.${anonPayload}.sig`);
  });

  it("rejects legacy service-role JWT key format", () => {
    expect(() =>
      validateClientSupabaseConfig({
        url: "https://example.supabase.co",
        anonKey: `${jwtHeader}.${serviceRolePayload}.sig`,
        appEnv: "production",
      }),
    ).toThrow(
      "VITE_SUPABASE_ANON_KEY must be a publishable/anon key, not a secret key.",
    );
  });
});

describe("mapSupabaseResponseErrorForUser", () => {
  it("maps jwt-expired payloads to a stable token-expired message", () => {
    expect(
      mapSupabaseResponseErrorForUser({
        responseText: `{"code":"PGRST303","message":"JWT expired"}`,
        fallback: "Could not load active rounds.",
      }),
    ).toBe("JWT expired");
  });

  it("keeps a neutral fallback for unknown provider errors", () => {
    expect(
      mapSupabaseResponseErrorForUser({
        responseText: `{"message":"relation public.rounds does not exist"}`,
        fallback: "Could not load active rounds.",
      }),
    ).toBe("Could not load active rounds.");
  });
});

describe("getSupabaseTargetLabelForUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reports local Supabase for localhost config", () => {
    expect(getSupabaseTargetLabelForUrl("http://127.0.0.1:54321")).toBe(
      "LOCAL SUPABASE",
    );
  });

  it("reports live Supabase for hosted config", () => {
    expect(getSupabaseTargetLabelForUrl("https://example.supabase.co")).toBe(
      "LIVE SUPABASE",
    );
  });
});

describe("resolveRuntimeSupabaseUrl", () => {
  it("keeps loopback URL for same-machine localhost use", () => {
    expect(
      resolveRuntimeSupabaseUrl("http://127.0.0.1:54321", "127.0.0.1"),
    ).toBe("http://127.0.0.1:54321");
  });

  it("rewrites loopback Supabase URL to LAN host for mobile or LAN browser use", () => {
    expect(
      resolveRuntimeSupabaseUrl("http://127.0.0.1:54321", "192.168.0.120"),
    ).toBe("http://192.168.0.120:54321");
  });

  it("does not rewrite hosted Supabase URLs", () => {
    expect(
      resolveRuntimeSupabaseUrl("https://example.supabase.co", "192.168.0.120"),
    ).toBe("https://example.supabase.co");
  });
});
