import { NextResponse } from "next/server";
import { getRepliesForProject, syncInboundRepliesFromGmail } from "@/lib/gmail-inbound";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        {
          ok: false,
          error: "projectId is required."
        },
        { status: 400 }
      );
    }

    await syncInboundRepliesFromGmail();
    const replies = await getRepliesForProject(projectId);

    return NextResponse.json({
      ok: true,
      replies
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Inbound email sync failed."
      },
      { status: 500 }
    );
  }
}
