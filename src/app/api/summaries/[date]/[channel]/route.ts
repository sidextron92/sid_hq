import { NextResponse } from "next/server";
import { buildRemoteSummaryUrl, getSummariesBaseUrl, getSummaryAuthHeaders, isSummaryChannel, isSummaryDate, sanitizeSummaryHtml } from "@/lib/summaries";

const FALLBACK_HTML: Record<string, string> = {
  slack: "<h2>Slack Summary</h2><p>Remote summaries are not connected yet. This is placeholder content from the app.</p>",
  email: "<h2>Email Summary</h2><p>Remote summaries are not connected yet. This is placeholder content from the app.</p>",
  whatsapp: "<h2>WhatsApp Summary</h2><p>Remote summaries are not connected yet. This is placeholder content from the app.</p>",
};

export async function GET(_request: Request, context: RouteContext<"/api/summaries/[date]/[channel]">) {
  const { date, channel } = await context.params;

  if (!isSummaryDate(date) || !isSummaryChannel(channel)) {
    return NextResponse.json({ error: "Invalid summary path" }, { status: 400 });
  }

  const baseUrl = getSummariesBaseUrl();

  if (!baseUrl) {
    return NextResponse.json({ html: FALLBACK_HTML[channel], source: "dummy" });
  }

  try {
    const response = await fetch(buildRemoteSummaryUrl(date, channel), {
      headers: getSummaryAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { html: FALLBACK_HTML[channel], source: "dummy", error: `Remote summary returned ${response.status}` },
        { status: 200 }
      );
    }

    const html = sanitizeSummaryHtml(await response.text());
    return NextResponse.json({ html, source: "remote" });
  } catch (error) {
    return NextResponse.json(
      { html: FALLBACK_HTML[channel], source: "dummy", error: error instanceof Error ? error.message : "Failed to fetch remote summary" },
      { status: 200 }
    );
  }
}
