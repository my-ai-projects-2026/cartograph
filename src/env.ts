// Imported by next.config.ts, so a missing value stops `next dev` / `next build`
// on boot instead of surfacing later as a confusing auth or network error.
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing environment variable ${name}. Set it in .env.local.`);
  }
  return value;
}

export const env = {
  clerkPublishableKey: required("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  clerkSecretKey: required("CLERK_SECRET_KEY"),
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
};
