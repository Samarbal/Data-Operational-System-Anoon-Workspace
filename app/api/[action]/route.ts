import { NextRequest, NextResponse } from "next/server";
import { callLegacyMethod, callProcessRequest } from "@/lib/apps-script-runtime";
import { READ_HEAVY_ACTIONS, MUTATING_ACTIONS } from "@/lib/actions";
import { canAccessAction, getSessionFromRequest } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";
import { cache } from "@/lib/cache";

function cacheKey(action: string, data: unknown): string {
  return `read-heavy:direct:${action}:${JSON.stringify(data ?? {})}`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action } = await context.params;
  const body = await readJsonBody<Record<string, unknown>>(req);

  if (!canAccessAction(session.role, action)) {
    return NextResponse.json({ error: "Forbidden action for this role" }, { status: 403 });
  }

  if (action === "getAvailabilityData") {
    const result = await callLegacyMethod("getAvailabilityData");
    return NextResponse.json(result);
  }

  if (READ_HEAVY_ACTIONS.has(action)) {
    const key = cacheKey(action, body);
    const cached = cache.get<unknown>(key);
    if (cached !== null) return NextResponse.json(cached);
    const result = await callProcessRequest(action, body);
    cache.set(key, result, 120);
    return NextResponse.json(result);
  }

  const result = await callProcessRequest(action, body);
  const success = !(result && typeof result === "object" && "success" in (result as Record<string, unknown>) && (result as Record<string, unknown>).success === false);
  if (success && MUTATING_ACTIONS.has(action)) {
    cache.clearByPrefix("read-heavy:");
    cache.clearByPrefix("gas:");
  }

  return NextResponse.json(result);
}
