import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const DEFAULT_STORAGE_BUCKET = "aura-media";

type StorageEnv = Record<string, unknown>;

function getWorkerEnv(): StorageEnv | null {
  try {
    return getCloudflareContext().env as StorageEnv;
  } catch {
    return null;
  }
}

export function isCloudflareStorageRuntime(): boolean {
  return getWorkerEnv() !== null;
}

function getStorageEnvValue(name: string): string {
  const workerValue = getWorkerEnv()?.[name];
  if (typeof workerValue === "string" && workerValue.trim()) return workerValue.trim();
  return process.env[name]?.trim() || "";
}

function getSupabaseUrl(): string {
  return getStorageEnvValue("SUPABASE_URL") || getStorageEnvValue("NEXT_PUBLIC_SUPABASE_URL");
}

function getSupabaseServiceRoleKey(): string {
  return getStorageEnvValue("SUPABASE_SERVICE_ROLE_KEY");
}

export function getSupabaseStorageBucket(): string {
  return getStorageEnvValue("SUPABASE_STORAGE_BUCKET") || DEFAULT_STORAGE_BUCKET;
}

export function getSupabaseStorageConfigurationStatus(): { urlConfigured: boolean; keyConfigured: boolean } {
  return { urlConfigured: Boolean(getSupabaseUrl()), keyConfigured: Boolean(getSupabaseServiceRoleKey()) };
}

export function isSupabaseStorageConfigured(): boolean {
  const status = getSupabaseStorageConfigurationStatus();
  return status.urlConfigured && status.keyConfigured;
}

export function getSupabaseAdminClient(options?: { timeoutMs?: number }): SupabaseClient {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    ...(options?.timeoutMs ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(options.timeoutMs!) }) } } : {}),
  });
}

export class MediaStorageError extends Error {
  constructor(
    public readonly category: "transport_or_unknown" | "missing_bucket" | "not_found" | "permission" | "storage" | "configuration",
    public readonly status?: number
  ) {
    super("Media storage upload failed");
  }
}

export async function uploadMediaToSupabaseStorage(
  buffer: Uint8Array,
  objectPath: string,
  contentType: string
): Promise<{ publicUrl: string; storagePath: string }> {
  let client: SupabaseClient;
  try {
    client = getSupabaseAdminClient();
  } catch {
    throw new MediaStorageError("configuration");
  }
  const bucket = getSupabaseStorageBucket();

  const { error } = await client.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    const status = typeof error.status === "number" && error.status >= 100 && error.status <= 599
      ? error.status : undefined;
    const code = "code" in error && typeof error.code === "string" ? error.code : "";
    const category = code === "NoSuchBucket" ? "missing_bucket"
      : status === 401 || status === 403 || code === "AccessDenied" ? "permission"
      : status === 404 ? "not_found"
      : error.name === "StorageUnknownError" ? "transport_or_unknown" : "storage";
    throw new MediaStorageError(category, status);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
  return {
    publicUrl: data.publicUrl,
    storagePath: objectPath,
  };
}

export function extractSupabaseStoragePath(publicUrl: string): string | null {
  const supabaseUrl = getSupabaseUrl().replace(/\/+$/, "");
  const bucket = getSupabaseStorageBucket();
  if (!supabaseUrl) return null;
  try {
    const base = new URL(supabaseUrl);
    const url = new URL(publicUrl);
    const prefix = `${base.pathname.replace(/\/+$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/`;
    if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) return null;
    const rawPath = url.pathname.slice(prefix.length);
    return rawPath ? decodeURIComponent(rawPath) : null;
  } catch {
    return null;
  }
}

export async function deleteMediaObjectFromSupabaseStorage(objectPath: string): Promise<boolean> {
  if (!isSupabaseStorageConfigured()) return false;
  const client = getSupabaseAdminClient();
  const bucket = getSupabaseStorageBucket();
  const { error } = await client.storage.from(bucket).remove([objectPath]);
  if (error) {
    console.error("Supabase Storage delete failed.");
    return false;
  }
  return true;
}

export async function deleteMediaFromSupabaseStorage(publicUrl: string): Promise<boolean> {
  const objectPath = extractSupabaseStoragePath(publicUrl);
  return objectPath ? deleteMediaObjectFromSupabaseStorage(objectPath) : false;
}

/** Idempotent and verified: a missing object is success, never a missing bucket or a permission error. */
export async function ensureSupabaseMediaAbsent(publicUrl: string): Promise<void> {
  const objectPath = extractSupabaseStoragePath(publicUrl);
  if (!objectPath || !isSupabaseStorageConfigured() || getSupabaseStorageBucket() !== DEFAULT_STORAGE_BUCKET) {
    throw new MediaStorageError("configuration");
  }
  const bucket = getSupabaseAdminClient({ timeoutMs: 8000 }).storage.from(getSupabaseStorageBucket());
  const result = await bucket.remove([objectPath]);
  if (result.error) throw new MediaStorageError("storage", result.error.status);
  // Even a successful remove response is not proof that the key is gone.
  // exists returns false only for a missing key; bucket/permission/transport errors throw.
  const after = await bucket.exists(objectPath);
  if (after.data) throw new MediaStorageError("storage");
}
