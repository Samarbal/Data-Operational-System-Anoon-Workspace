import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets";
import { cache } from "@/lib/cache";

export async function POST() {
  try {
    const client = getSheetsClient();

    // Warm the auth/session and sheet metadata cache without blocking UI render flows.
    await client.getSheetNames();

    const usersCacheKey = "auth:users:rows";
    if (!cache.get(usersCacheKey)) {
      // PERF: only first 3 columns are required for login bootstrap cache.
      const users = await client.getSheetRangeValues("المستخدمون", "A:C");
      cache.set(usersCacheKey, users, 300);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}


