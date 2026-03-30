import { NextResponse } from "next/server";
import { sendProjectChatEmail } from "@/lib/gmail-mailer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId: string;
      projectTitle: string;
      projectCode: string;
      authorName: string;
      authorEmail: string;
      body: string;
      history?: Array<{
        authorName: string;
        body: string;
        sentAt: string;
        direction: "App" | "Email";
      }>;
      to: string[];
      cc: string[];
    };

    await sendProjectChatEmail(payload);

    return NextResponse.json({
      ok: true,
      message: "Email sent successfully."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Email sending failed."
      },
      { status: 500 }
    );
  }
}
