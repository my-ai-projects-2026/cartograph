import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { Database } from "./types";

// The Clerk session token rides along on every request, so policies read the
// organization claim straight off it. Without it, requests arrive as `anon`
// and every policy quietly returns nothing.
//
// auth() is awaited here rather than inside the callback: inside, it runs in
// supabase-js's fetch path, which swallows Next's dynamic-rendering signal.
export async function createServerDb() {
  const { getToken } = await auth();
  return createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    accessToken: () => getToken(),
  });
}
