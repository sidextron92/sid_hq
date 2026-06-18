import MarkdownIt from "markdown-it";

export type SummaryChannel = "slack" | "email" | "whatsapp";

export type SummaryDate = {
  date: string;
  channels: SummaryChannel[];
};

export const SUMMARY_CHANNELS: SummaryChannel[] = ["slack", "email", "whatsapp"];

export const SUMMARY_CHANNEL_FOLDER: Record<SummaryChannel, string> = {
  slack: "Slack",
  email: "Email",
  whatsapp: "WhatsApp",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isSummaryChannel(value: string): value is SummaryChannel {
  return SUMMARY_CHANNELS.includes(value as SummaryChannel);
}

export function isSummaryDate(value: string) {
  return DATE_RE.test(value);
}

export function getSummariesBaseUrl() {
  return process.env.SUMMARIES_BASE_URL?.replace(/\/+$/, "") || "";
}

export function getReportsRoot() {
  return process.env.SUMMARIES_REPORTS_ROOT || "Daily Reports";
}

export function getSummaryAuthHeaders(): HeadersInit {
  const token = process.env.SUMMARIES_API_KEY;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function buildRemoteSummaryUrl(date: string, channel: SummaryChannel) {
  const explicit = process.env.SUMMARIES_SUMMARY_URL;
  if (explicit) {
    return explicit
      .replace(/\{date\}/g, encodeURIComponent(date))
      .replace(/\{channel\}/g, encodeURIComponent(channel));
  }

  const baseUrl = getSummariesBaseUrl();
  if (process.env.SUMMARIES_USE_FILE_PATHS !== "true") {
    return `${baseUrl}/api/summary/${encodeURIComponent(date)}/${encodeURIComponent(channel)}`;
  }

  const path = [getReportsRoot(), date, SUMMARY_CHANNEL_FOLDER[channel], "summary.md"]
    .map(encodeURIComponent)
    .join("/");
  return `${baseUrl}/${path}`;
}

export function buildRemoteIndexUrl() {
  const explicit = process.env.SUMMARIES_INDEX_URL;
  if (explicit) return explicit;

  const baseUrl = getSummariesBaseUrl();
  if (process.env.SUMMARIES_USE_FILE_PATHS !== "true") {
    return `${baseUrl}/api/dates`;
  }

  const path = [getReportsRoot(), "index.json"].map(encodeURIComponent).join("/");
  return `${baseUrl}/${path}`;
}

export function normalizeSummaryDates(input: unknown): SummaryDate[] {
  const rawDates = Array.isArray(input)
    ? input
    : input && typeof input === "object" && "dates" in input && Array.isArray(input.dates)
      ? input.dates
      : [];

  return rawDates
    .map((item): SummaryDate | null => {
      if (typeof item === "string") {
        return isSummaryDate(item) ? { date: item, channels: [...SUMMARY_CHANNELS] } : null;
      }

      if (!item || typeof item !== "object" || !("date" in item) || typeof item.date !== "string") {
        return null;
      }

      const itemChannels: unknown[] = "channels" in item && Array.isArray(item.channels)
        ? item.channels
        : [...SUMMARY_CHANNELS];
      const channels = itemChannels.filter(
        (channel): channel is SummaryChannel => typeof channel === "string" && isSummaryChannel(channel)
      );

      return isSummaryDate(item.date) ? { date: item.date, channels } : null;
    })
    .filter((item): item is SummaryDate => Boolean(item))
    .sort((a, b) => b.date.localeCompare(a.date));
}

const summaryMarkdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
});

export function renderSummaryMarkdown(markdown: string) {
  return summaryMarkdownRenderer.render(markdown);
}
