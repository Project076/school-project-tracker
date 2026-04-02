import { NextResponse } from "next/server";
import {
  getAuthorizedProfile,
  getSupabaseAdminClient,
  isSupabaseServerConfigured,
  type AuthorizedProfile
} from "@/lib/supabase/admin";
import { UserRole } from "@/lib/types";

export const runtime = "nodejs";

async function ensureAdmin(request: Request): Promise<AuthorizedProfile> {
  const profile = await getAuthorizedProfile(request);

  if (profile.role !== "Admin" || profile.active === false) {
    throw new Error("Only active Admin users can manage users.");
  }

  return profile;
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseServerConfigured()) {
      throw new Error("Supabase is not configured.");
    }

    await ensureAdmin(request);
    const payload = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
    };

    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    const password = payload.password?.trim() ?? "";
    const role = payload.role ?? "Member";

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
    const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name
      }
    });

    if (createError || !createdUser.user) {
      throw createError ?? new Error("User could not be created.");
    }

    const { error: profileError } = await supabase.from("app_profiles").insert({
      id: createdUser.user.id,
      email,
      name,
      role,
      active: true
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(createdUser.user.id);
      throw profileError;
    }

    return NextResponse.json({
      ok: true,
      message: "User created."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "User creation failed."
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSupabaseServerConfigured()) {
      throw new Error("Supabase is not configured.");
    }

    const requester = await ensureAdmin(request);
    const payload = (await request.json()) as {
      userId?: string;
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
    };

    const userId = payload.userId?.trim() ?? "";
    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    const password = payload.password?.trim() ?? "";
    const role = payload.role;

    if (!userId || !name || !email || !role) {
      return NextResponse.json(
        {
          ok: false,
          error: "User id, name, email, and role are required."
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: profiles, error: profilesError } = await supabase
      .from("app_profiles")
      .select("id, role, active")
      .eq("active", true);

    if (profilesError) {
      throw profilesError;
    }

    const targetProfile = profiles?.find((profile) => profile.id === userId);
    const activeAdmins = profiles?.filter((profile) => profile.role === "Admin") ?? [];

    if (!targetProfile) {
      throw new Error("User not found.");
    }

    if (targetProfile.role === "Admin" && role !== "Admin" && activeAdmins.length === 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "Keep at least one active Admin account in the system."
        },
        { status: 400 }
      );
    }

    if (requester.id === userId && role !== "Admin" && activeAdmins.length === 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "You cannot remove the final Admin role from your own account."
        },
        { status: 400 }
      );
    }

    const updatePayload: {
      email?: string;
      password?: string;
      user_metadata: {
        name: string;
      };
    } = {
      email,
      user_metadata: {
        name
      }
    };

    if (password) {
      updatePayload.password = password;
    }

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, updatePayload);

    if (authUpdateError) {
      throw authUpdateError;
    }

    const { error: profileUpdateError } = await supabase
      .from("app_profiles")
      .update({
        name,
        email,
        role,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (profileUpdateError) {
      throw profileUpdateError;
    }

    return NextResponse.json({
      ok: true,
      message: "User updated."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "User update failed."
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSupabaseServerConfigured()) {
      throw new Error("Supabase is not configured.");
    }

    const requester = await ensureAdmin(request);
    const payload = (await request.json()) as {
      userId?: string;
    };

    const userId = payload.userId?.trim() ?? "";

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "userId is required."
        },
        { status: 400 }
      );
    }

    if (userId === requester.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "You cannot delete the account you are currently using."
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: profiles, error: profilesError } = await supabase
      .from("app_profiles")
      .select("id, role, active");

    if (profilesError) {
      throw profilesError;
    }

    const targetProfile = profiles?.find((profile) => profile.id === userId);

    if (!targetProfile) {
      throw new Error("User not found.");
    }

    const activeAdmins = (profiles ?? []).filter((profile) => profile.role === "Admin" && profile.active);
    if (targetProfile.role === "Admin" && targetProfile.active && activeAdmins.length === 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "Keep at least one active Admin account in the system."
        },
        { status: 400 }
      );
    }

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      throw deleteAuthError;
    }

    const { error: deleteProfileError } = await supabase.from("app_profiles").delete().eq("id", userId);
    if (deleteProfileError) {
      throw deleteProfileError;
    }

    return NextResponse.json({
      ok: true,
      message: "User deleted."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "User deletion failed."
      },
      { status: 500 }
    );
  }
}
