import { createClient } from "@supabase/supabase-js";
import { UserRole } from "@/lib/types";

export function isSupabaseServerConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getSupabaseAdminClient() {
  if (!isSupabaseServerConfigured()) {
    throw new Error("Supabase server configuration is missing.");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export function getSupabaseAnonServerClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase public configuration is missing.");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export type AuthorizedProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
};

export async function getAuthorizedProfile(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token.");
  }

  const accessToken = authorization.slice("Bearer ".length).trim();
  const supabase = getSupabaseAnonServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    throw new Error("Invalid session.");
  }

  // Verify the JWT with the public client, then load the matching profile
  // through the service-role client so RLS does not block server-side admin routes.
  const adminClient = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("app_profiles")
    .select("id, email, name, role, active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Profile not found.");
  }

  return profile as AuthorizedProfile;
}
