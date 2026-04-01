import { NextResponse } from "next/server";
import { getSupabaseAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { UserRole } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase is not configured."
        },
        { status: 500 }
      );
    }

    const payload = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };

    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    const password = payload.password?.trim() ?? "";

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Name, email, and password are required."
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { count, error: countError } = await supabase
      .from("app_profiles")
      .select("id", { count: "exact", head: true });

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Admin bootstrap is already complete."
        },
        { status: 409 }
      );
    }

    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name
      }
    });

    if (createUserError || !createdUser.user) {
      throw createUserError ?? new Error("Admin account could not be created.");
    }

    const role: UserRole = "Admin";
    const { error: profileError } = await supabase.from("app_profiles").insert({
      id: createdUser.user.id,
      email,
      name,
      role,
      active: true
    });

    if (profileError) {
      throw profileError;
    }

    return NextResponse.json({
      ok: true,
      message: "First admin created."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Admin bootstrap failed."
      },
      { status: 500 }
    );
  }
}

