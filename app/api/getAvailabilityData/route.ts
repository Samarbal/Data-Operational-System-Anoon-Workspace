import { NextRequest, NextResponse } from "next/server";
import { callLegacyMethod } from "@/lib/apps-script-runtime";
import { getSessionFromRequest } from "@/lib/auth";
import { cache } from "@/lib/cache";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "admin" && session.role !== "social")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = "read-heavy:availability";
  const cached = cache.get<unknown>(key);
  if (cached !== null) {
    return NextResponse.json(cached);
  }

  const result = await callLegacyMethod("getAvailabilityData");
  cache.set(key, result, 120);
  return NextResponse.json(result);
}
