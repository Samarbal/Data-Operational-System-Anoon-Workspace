import { NextRequest, NextResponse } from "next/server";

export async function readJsonBody<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function errorJson(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

