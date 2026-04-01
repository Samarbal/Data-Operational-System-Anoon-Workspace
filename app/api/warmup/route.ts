import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets";
import { cache } from "@/lib/cache";

export async function POST() {
  // TEMPORARY: Skip Google Sheets warming to fix 19-second delay
  // TODO: Re-enable once Google Sheets connectivity is restored
  return NextResponse.json({ ok: true });
}


