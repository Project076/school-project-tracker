import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Project, User, UserRole } from "@/lib/types";

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProjectRow = {
  id: string;
  payload: Project;
  updated_at?: string | null;
};

type Database = {
  public: {
    Tables: {
      app_profiles: {
        Row: ProfileRow;
        Insert: ProfileRow;
        Update: Partial<ProfileRow>;
      };
      app_projects: {
        Row: ProjectRow;
        Insert: ProjectRow;
        Update: Partial<ProjectRow>;
      };
    };
  };
};

let browserClient: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  if (!browserClient) {
    browserClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  return browserClient;
}

export function mapProfileRowToUser(profile: ProfileRow): User {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    active: profile.active
  };
}

