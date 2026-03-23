import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getAdminHtml } from "@/lib/legacy-html";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return new NextResponse(getAdminHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

