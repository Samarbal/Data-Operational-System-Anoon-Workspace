import { NextRequest, NextResponse } from "next/server";
import { callSocialProcessRequest } from "@/lib/apps-script-runtime";
import { canAccessAction, getSessionFromRequest } from "@/lib/auth";
import { cache } from "@/lib/cache";
import { readJsonBody } from "@/lib/api-utils";

type SocialBody = {
  action?: string;
  data?: unknown;
};

function readKey(action: string, data: unknown): string {
  return `read-heavy:social:${action}:${JSON.stringify(data ?? {})}`;
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "social" && session.role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody<SocialBody>(req);
  const action = String(body.action ?? "").trim();
  const data = body.data ?? {};
  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const prefixed = action.startsWith("social_") ? action : `social_${action}`;
  if (!canAccessAction(session.role, prefixed)) {
    return NextResponse.json({ error: "Forbidden action for this role" }, { status: 403 });
  }

  if (action === "getDashboard" || action === "getHallBookings") {
    const key = readKey(action, data);
    const cached = cache.get<unknown>(key);
    if (cached !== null) return NextResponse.json(cached);
    const result = await callSocialProcessRequest(action, data);
    cache.set(key, result, 120);
    return NextResponse.json(result);
  }

  const result = await callSocialProcessRequest(action, data);
  const success = !(result && typeof result === "object" && "success" in (result as Record<string, unknown>) && (result as Record<string, unknown>).success === false);

  if (success) {
    cache.clearByPrefix("read-heavy:");
    cache.clearByPrefix("gas:");
  }

  return NextResponse.json(result);
}

