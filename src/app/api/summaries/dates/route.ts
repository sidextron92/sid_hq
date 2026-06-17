import { NextResponse } from "next/server";
import { getSummariesBaseUrl, buildRemoteIndexUrl, getSummaryAuthHeaders, normalizeSummaryDates, type SummaryDate } from "@/lib/summaries";

const FALLBACK_DATES: SummaryDate[] = [
  { date: "2026-06-17", channels: ["slack", "email", "whatsapp"] },
  { date: "2026-06-16", channels: ["slack", "email", "whatsapp"] },
  { date: "2026-06-15", channels: ["slack", "email", "whatsapp"] },
];

export async function GET() {
  const baseUrl = getSummariesBaseUrl();

  if (!baseUrl) {
    return NextResponse.json({ dates: FALLBACK_DATES, source: "dummy" });
  }

  try {
    const response = await fetch(buildRemoteIndexUrl(), {
      headers: getSummaryAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { dates: FALLBACK_DATES, source: "dummy", error: `Remote index returned ${response.status}` },
        { status: 200 }
      );
    }

    const data = await response.json();
    const dates = normalizeSummaryDates(data);
    return NextResponse.json({ dates: dates.length ? dates : FALLBACK_DATES, source: dates.length ? "remote" : "dummy" });
  } catch (error) {
    return NextResponse.json(
      { dates: FALLBACK_DATES, source: "dummy", error: error instanceof Error ? error.message : "Failed to fetch remote dates" },
      { status: 200 }
    );
  }
}
