const PLACEHOLDER_SUPABASE_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_SUPABASE_ANON_KEY = "placeholder-anon-key";
const PLACEHOLDER_SUPABASE_SERVICE_ROLE_KEY = "placeholder-service-role-key";

function resolveEnvValue(
  value: string | undefined,
  fallback: string
): string {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : fallback;
}

export function getSupabaseUrl(): string {
  return resolveEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    PLACEHOLDER_SUPABASE_URL
  );
}

export function getSupabaseAnonKey(): string {
  return resolveEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    PLACEHOLDER_SUPABASE_ANON_KEY
  );
}

export function getSupabaseServiceRoleKey(): string {
  return resolveEnvValue(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    PLACEHOLDER_SUPABASE_SERVICE_ROLE_KEY
  );
}
