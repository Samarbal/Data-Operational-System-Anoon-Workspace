import { NextRequest, NextResponse } from "next/server";
import { callLegacyMethod } from "@/lib/apps-script-runtime";
import { getSessionCookieName, signSession } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";

type LoginResult = {
  success?: boolean;
  name?: string;
  role?: "admin" | "social";
  error?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody<{ name?: string }>(req);
    const name = String(body.name ?? "").trim();
    const result = (await callLegacyMethod("loginByName", name)) as LoginResult;
    if (!result?.success) {
      return NextResponse.json(result ?? { success: false, error: "Login failed" }, { status: 200 });
    }

    const role = result.role === "social" ? "social" : "admin";
    const token = signSession({
      name: result.name || name,
      role
    });

    const response = NextResponse.json({
      success: true,
      name: result.name || name,
      role
    });

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected login error"
      },
      { status: 500 }
    );
  }
}
