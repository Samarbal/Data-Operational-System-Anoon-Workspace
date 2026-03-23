import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getSocialHtml } from "@/lib/legacy-html";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "admin" && session.role !== "social")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return new NextResponse(getSocialHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

