import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_STORAGE_BUCKET = "aura-media";

declare global {
  // eslint-disable-next-line no-var
  var __auraSupabaseAdmin: SupabaseClient | undefined;
}

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  );
}

function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

export function getSupabaseStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_STORAGE_BUCKET;
}

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (globalThis.__auraSupabaseAdmin) {
    return globalThis.__auraSupabaseAdmin;
  }

  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  globalThis.__auraSupabaseAdmin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return globalThis.__auraSupabaseAdmin;
}

export async function uploadMediaToSupabaseStorage(
  buffer: Buffer,
  objectPath: string,
  contentType: string
): Promise<{ publicUrl: string; storagePath: string }> {
  const client = getSupabaseAdminClient();
  const bucket = getSupabaseStorageBucket();

  const { error } = await client.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
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
  if (!supabaseUrl || !publicUrl.startsWith(supabaseUrl)) {
    return null;
  }

  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;

  const rawPath = publicUrl.slice(idx + marker.length).split("?")[0];
  return rawPath ? decodeURIComponent(rawPath) : null;
}

export async function deleteMediaFromSupabaseStorage(
  publicUrl: string
): Promise<boolean> {
  if (!isSupabaseStorageConfigured()) return false;
  const objectPath = extractSupabaseStoragePath(publicUrl);
  if (!objectPath) return false;

  const client = getSupabaseAdminClient();
  const bucket = getSupabaseStorageBucket();
  const { error } = await client.storage.from(bucket).remove([objectPath]);
  if (error) {
    console.error("Supabase Storage delete error:", error.message);
    return false;
  }
  return true;
}
