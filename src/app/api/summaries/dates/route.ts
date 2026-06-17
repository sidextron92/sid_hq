import { NextResponse } from "next/server";
import { getSummariesBaseUrl, buildRemoteIndexUrl, getSummaryAuthHeaders, normalizeSummaryDates } from "@/lib/summaries";

export async function GET() {
  const baseUrl = getSummariesBaseUrl();

  if (!baseUrl) {
    return NextResponse.json({ dates: [], source: "dummy", error: "Remote summaries are not configured" });
  }

  try {
    const response = await fetch(buildRemoteIndexUrl(), {
      headers: getSummaryAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { dates: [], source: "dummy", error: `Remote index returned ${response.status}` },
        { status: 200 }
      );
    }

    const data = await response.json();
    const dates = normalizeSummaryDates(data);
    return NextResponse.json({ dates, source: "remote" });
  } catch (error) {
    return NextResponse.json(
      { dates: [], source: "dummy", error: error instanceof Error ? error.message : "Failed to fetch remote dates" },
      { status: 200 }
    );
  }
}
