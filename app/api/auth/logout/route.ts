import { NextRequest, NextResponse } from "next/server";
import { callLegacyMethod } from "@/lib/apps-script-runtime";
import { getSessionCookieName } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  await callLegacyMethod("logoutUser");

  const response = NextResponse.json({ success: true });
  response.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}

