import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets";
import { getSessionCookieName, signSession } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";
import { cache } from "@/lib/cache";

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
    const result = await loginByNameFast(name);
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

async function loginByNameFast(name: string): Promise<LoginResult> {
  if (!name) {
    return { success: false, error: "أدخل اسمك" };
  }

  const cacheKey = "auth:users:rows";
  let rows = cache.get<unknown[][]>(cacheKey);
  if (!rows) {
    const client = getSheetsClient();
    // PERF: login needs only Name/Role/Active columns.
    rows = await client.getSheetRangeValues("المستخدمون", "A:C");
    // Users list changes rarely; 5-minute cache removes repeated sheet reads on login.
    cache.set(cacheKey, rows, 300);
  }

  if (!rows || rows.length < 2) {
    return { success: false, error: "لا يوجد مستخدمون" };
  }

  const wanted = name.trim().toLowerCase();
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const rowName = String(row[0] ?? "").trim();
    const rowRoleRaw = String(row[1] ?? "admin").trim().toLowerCase();
    const rowActive = String(row[2] ?? "").trim();

    if (rowName.toLowerCase() !== wanted) continue;
    if (rowActive !== "نعم") return { success: false, error: "الحساب غير مفعّل" };

    const role: "admin" | "social" = rowRoleRaw === "social" ? "social" : "admin";
    return { success: true, name: rowName, role };
  }

  return { success: false, error: "الاسم غير موجود — تواصل مع المدير" };
}
