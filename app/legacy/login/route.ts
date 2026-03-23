import { NextResponse } from "next/server";
import { getLoginHtml } from "@/lib/legacy-html";

export async function GET() {
  return new NextResponse(getLoginHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // PERF: allow short browser caching for faster repeat opens of login page.
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    }
  });
}
