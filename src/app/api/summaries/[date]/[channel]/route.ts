import { NextResponse } from "next/server";
import { buildRemoteSummaryUrl, getSummariesBaseUrl, getSummaryAuthHeaders, isSummaryChannel, isSummaryDate, renderSummaryMarkdown } from "@/lib/summaries";

export async function GET(_request: Request, context: RouteContext<"/api/summaries/[date]/[channel]">) {
  const { date, channel } = await context.params;

  if (!isSummaryDate(date) || !isSummaryChannel(channel)) {
    return NextResponse.json({ error: "Invalid summary path" }, { status: 400 });
  }

  const baseUrl = getSummariesBaseUrl();

  if (!baseUrl) {
    return NextResponse.json({ markup: "", markdown: "", source: "dummy", error: "Remote summaries are not configured" });
  }

  try {
    const response = await fetch(buildRemoteSummaryUrl(date, channel), {
      headers: getSummaryAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { markup: "", markdown: "", source: "dummy", error: `Remote summary returned ${response.status}` },
        { status: 200 }
      );
    }

    const markdown = await response.text();
    return NextResponse.json({ markup: renderSummaryMarkdown(markdown), markdown, source: "remote" });
  } catch (error) {
    return NextResponse.json(
      { markup: "", markdown: "", source: "dummy", error: error instanceof Error ? error.message : "Failed to fetch remote summary" },
      { status: 200 }
    );
  }
}
