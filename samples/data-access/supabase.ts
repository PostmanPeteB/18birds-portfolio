// Sanitized portfolio sample from 18Birds.
// Demonstrates frontend-safe Supabase configuration validation,
// runtime URL resolution, shared request helpers, and representative
// read/write data-access patterns for core application entities.

import { Course, RoundState } from "../contracts";
import { isDisallowedExternalHost } from "./networkPolicy";
import { throwIfResponseNotOk } from "./transport";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;
const APP_ENV = import.meta.env.VITE_APP_ENV as string | undefined;

const ROUNDS_TABLE = "rounds";
const ACTIVE_ROUNDS_TABLE = "active_rounds";

type SupabaseRoundPlayer = {
  id: string;
  name: string;
  handicap: number;
  strokesTotal: number;
  toPar: number;
  holesCounted: number;
};

type SupabaseRoundSnapshot = {
  players: RoundState["players"];
  scores: RoundState["scores"];
};

export type RemoteRound = {
  id: string;
  owner_user_id: string;
  course_id: string;
  course_name: string;
  tee_set_id: string;
  started_at_iso: string;
  completed_at_iso: string;
  players: SupabaseRoundPlayer[];
  round_snapshot?: SupabaseRoundSnapshot | null;
};

export type ActiveRoundRow = {
  id: string;
  owner_user_id: string;
  course_id: string;
  course_name: string;
  tee_set_id: string;
  status: "active" | "paused" | "completed" | "abandoned";
  started_at_iso: string;
  last_event_at_iso: string;
  current_hole: number;
  players: RoundState["players"];
  scores: RoundState["scores"];
  updated_at: string;
};

export function hasSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function mapSupabaseResponseErrorForUser(args: {
  responseText: string;
  fallback: string;
}): string {
  const lower = args.responseText.toLowerCase();

  if (lower.includes("jwt expired") || lower.includes("pgrst303")) {
    return "JWT expired";
  }

  return args.fallback;
}

function hasJwtServiceRoleClaim(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const payloadB64 = parts[1];
  try {
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    const decoded = atob(padded);
    const payload = JSON.parse(decoded) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

export function validateClientSupabaseConfig(args: {
  url: string;
  anonKey: string;
  appEnv?: string;
}): { url: string; anonKey: string } {
  const anonKey = args.anonKey.trim();
  const appEnv = (args.appEnv ?? "").trim().toLowerCase();
  const allowPrivateHost = appEnv === "development" || appEnv === "test";

  let parsed: URL;
  let isLocalOrPrivateHost = false;

  try {
    parsed = new URL(args.url);
    isLocalOrPrivateHost = isDisallowedExternalHost(parsed.hostname);
  } catch {
    throw new Error("VITE_SUPABASE_URL must be a valid URL.");
  }

  if (
    parsed.protocol !== "https:" &&
    !(allowPrivateHost && parsed.protocol === "http:" && isLocalOrPrivateHost)
  ) {
    throw new Error(
      "VITE_SUPABASE_URL must use HTTPS (HTTP allowed only in development/test for local hosts).",
    );
  }

  if (isLocalOrPrivateHost && !allowPrivateHost) {
    throw new Error(
      "VITE_SUPABASE_URL host is not allowed outside development/test.",
    );
  }

  if (
    anonKey.startsWith("sb_secret_") ||
    anonKey.toLowerCase().includes("service_role") ||
    hasJwtServiceRoleClaim(anonKey)
  ) {
    throw new Error(
      "VITE_SUPABASE_ANON_KEY must be a publishable/anon key, not a secret key.",
    );
  }

  return {
    url: parsed.origin,
    anonKey,
  };
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

export function resolveRuntimeSupabaseUrl(
  configuredUrl: string,
  pageHostname?: string,
): string {
  const parsed = new URL(configuredUrl);

  if (!pageHostname || !isLoopbackHostname(parsed.hostname)) {
    return parsed.origin;
  }

  const normalizedPageHostname = pageHostname.trim().toLowerCase();

  if (
    !normalizedPageHostname ||
    isLoopbackHostname(normalizedPageHostname) ||
    !isDisallowedExternalHost(normalizedPageHostname)
  ) {
    return parsed.origin;
  }

  parsed.hostname = normalizedPageHostname;
  return parsed.origin;
}

export function getSupabaseTargetLabelForUrl(url: string): string {
  const hostname = new URL(url).hostname;
  return isDisallowedExternalHost(hostname)
    ? "LOCAL SUPABASE"
    : "LIVE SUPABASE";
}

export function getSupabaseTargetLabel(): string {
  if (!hasSupabaseConfig()) return "SUPABASE NOT CONFIGURED";
  const { url } = getSupabaseConfig();
  return getSupabaseTargetLabelForUrl(url);
}

export function getSupabaseConfig(): { url: string; anonKey: string } {
  if (!SUPABASE_URL) {
    throw new Error("Missing VITE_SUPABASE_URL in .env.local");
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error("Missing VITE_SUPABASE_ANON_KEY in .env.local");
  }

  const validated = validateClientSupabaseConfig({
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    appEnv: APP_ENV,
  });

  return {
    ...validated,
    url: resolveRuntimeSupabaseUrl(
      validated.url,
      typeof window !== "undefined" ? window.location.hostname : undefined,
    ),
  };
}

function getHeaders(accessToken: string): HeadersInit {
  const { anonKey } = getSupabaseConfig();

  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function getRoundsBaseUrl(): string {
  const { url } = getSupabaseConfig();
  return `${url}/rest/v1/${ROUNDS_TABLE}`;
}

function getActiveRoundsBaseUrl(): string {
  const { url } = getSupabaseConfig();
  return `${url}/rest/v1/${ACTIVE_ROUNDS_TABLE}`;
}

function mapSupabaseErrorMessage(rawText: string, fallback: string): string {
  return mapSupabaseResponseErrorForUser({
    responseText: rawText,
    fallback,
  });
}

export async function fetchRemoteRounds(args: {
  accessToken: string;
  ownerUserId: string;
}): Promise<RemoteRound[]> {
  const query = new URLSearchParams({
    owner_user_id: `eq.${args.ownerUserId}`,
    order: "started_at_iso.desc",
    select:
      "id,owner_user_id,course_id,course_name,tee_set_id,started_at_iso,completed_at_iso,players,round_snapshot",
  });

  const response = await fetch(`${getRoundsBaseUrl()}?${query.toString()}`, {
    method: "GET",
    headers: getHeaders(args.accessToken),
  });

  await throwIfResponseNotOk({
    response,
    fallback: "Could not load rounds.",
    mapErrorMessage: mapSupabaseErrorMessage,
  });

  return (await response.json()) as RemoteRound[];
}

export async function updateRemoteRound(args: {
  id: string;
  players: SupabaseRoundPlayer[];
  roundSnapshot: SupabaseRoundSnapshot;
  accessToken: string;
  ownerUserId: string;
}): Promise<void> {
  const query = new URLSearchParams({
    id: `eq.${args.id}`,
    owner_user_id: `eq.${args.ownerUserId}`,
  });

  const response = await fetch(`${getRoundsBaseUrl()}?${query.toString()}`, {
    method: "PATCH",
    headers: {
      ...getHeaders(args.accessToken),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      players: args.players,
      round_snapshot: args.roundSnapshot,
    }),
  });

  await throwIfResponseNotOk({
    response,
    fallback: "Could not update round.",
    mapErrorMessage: mapSupabaseErrorMessage,
  });
}

export async function deleteRemoteRound(args: {
  id: string;
  accessToken: string;
  ownerUserId: string;
}): Promise<void> {
  const query = new URLSearchParams({
    id: `eq.${args.id}`,
    owner_user_id: `eq.${args.ownerUserId}`,
  });

  const response = await fetch(`${getRoundsBaseUrl()}?${query.toString()}`, {
    method: "DELETE",
    headers: {
      ...getHeaders(args.accessToken),
      Prefer: "return=minimal",
    },
  });

  await throwIfResponseNotOk({
    response,
    fallback: "Could not delete round.",
    mapErrorMessage: mapSupabaseErrorMessage,
  });
}

export async function createActiveRound(args: {
  round: RoundState;
  course: Course;
  accessToken: string;
  ownerUserId: string;
}): Promise<ActiveRoundRow> {
  const payload = {
    owner_user_id: args.ownerUserId,
    course_id: args.course.id,
    course_name: args.course.name,
    tee_set_id: args.round.teeSetId,
    status: "active",
    started_at_iso: args.round.startedAtISO,
    last_event_at_iso: new Date().toISOString(),
    current_hole: args.round.activeHole,
    players: args.round.players,
    scores: args.round.scores,
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(getActiveRoundsBaseUrl(), {
    method: "POST",
    headers: {
      ...getHeaders(args.accessToken),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  await throwIfResponseNotOk({
    response,
    fallback: "Could not create active round.",
    mapErrorMessage: mapSupabaseErrorMessage,
  });

  const rows = (await response.json()) as ActiveRoundRow[];
  return rows[0];
}

export async function fetchLatestActiveRound(args: {
  accessToken: string;
  ownerUserId: string;
}): Promise<ActiveRoundRow | null> {
  const query = new URLSearchParams({
    owner_user_id: `eq.${args.ownerUserId}`,
    status: "eq.active",
    order: "started_at_iso.desc",
    limit: "1",
    select:
      "id,owner_user_id,course_id,course_name,tee_set_id,status,started_at_iso,last_event_at_iso,current_hole,players,scores,updated_at",
  });

  const response = await fetch(
    `${getActiveRoundsBaseUrl()}?${query.toString()}`,
    {
      method: "GET",
      headers: getHeaders(args.accessToken),
    },
  );

  await throwIfResponseNotOk({
    response,
    fallback: "Could not load the active round.",
    mapErrorMessage: mapSupabaseErrorMessage,
  });

  const rows = (await response.json()) as ActiveRoundRow[];
  return rows[0] ?? null;
}
