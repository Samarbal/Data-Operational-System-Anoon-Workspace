import { NextRequest, NextResponse } from "next/server";
import { callProcessRequest } from "@/lib/apps-script-runtime";
import { READ_HEAVY_ACTIONS, MUTATING_ACTIONS } from "@/lib/actions";
import { canAccessAction, getSessionFromRequest } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";
import { cache } from "@/lib/cache";

type ProcessBody = {
  action?: string;
  data?: unknown;
};

function buildKey(action: string, data: unknown): string {
  return `read-heavy:${action}:${JSON.stringify(data ?? {})}`;
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody<ProcessBody>(req);
  const action = String(body.action ?? "").trim();
  const data = body.data ?? {};

  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  if (!canAccessAction(session.role, action)) {
    return NextResponse.json({ error: "Forbidden action for this role" }, { status: 403 });
  }

  if (READ_HEAVY_ACTIONS.has(action)) {
    const key = buildKey(action, data);
    const cached = cache.get<unknown>(key);
    if (cached !== null) {
      return NextResponse.json(cached);
    }

    const result = await callProcessRequest(action, data);
    cache.set(key, result, 120);
    return NextResponse.json(result);
  }

  const result = await callProcessRequest(action, data);
  const success = !(result && typeof result === "object" && "success" in (result as Record<string, unknown>) && (result as Record<string, unknown>).success === false);

  if (success && MUTATING_ACTIONS.has(action)) {
    cache.clearByPrefix("read-heavy:");
    cache.clearByPrefix("gas:");
  }

  return NextResponse.json(result);
}

