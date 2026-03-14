function clean(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getSupabaseUrl() {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? clean(process.env.SUPABASE_URL);
}

export function getSupabaseAnonKey() {
  return (
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
    clean(process.env.NEXT_PUBLIC_PUBLISHABLE_KEY) ??
    clean(process.env.SUPABASE_ANON_KEY) ??
    clean(process.env.SUPABASE_KEY)
  );
}
